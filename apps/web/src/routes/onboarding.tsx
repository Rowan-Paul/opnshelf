import {
	authControllerMeOptions,
	authControllerResendVerificationMutation,
	authControllerVerifyEmailMutation,
	traktError,
	traktSyncControllerConnectMutation,
	traktSyncControllerStatus,
	type UserDto,
	type UserProfileDto,
	usersControllerCompleteOnboarding,
	usersControllerDeleteMyAvatarMutation,
	usersControllerGetMyCurrentTraktImportOptions,
	usersControllerGetMySettingsOptions,
	usersControllerUpdateMyProfileMutation,
	usersControllerUpdateMySettingsMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeftRight,
	ArrowRight,
	Camera,
	Check,
	CheckCircle,
	Loader2,
	MailCheck,
	User,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import CountrySelector from "#/components/CountrySelector";
import Logo from "#/components/Logo";
import { FollowSuggestionsStep } from "#/components/onboarding/FollowSuggestionsStep";
import { WatchedSwipeStep } from "#/components/onboarding/WatchedSwipeStep";
import { WelcomeStep } from "#/components/onboarding/WelcomeStep";
import StreamingServicePicker, {
	sameServices,
	toggleService,
} from "#/components/StreamingServicePicker";
import { NotificationEmailSection } from "#/components/settings/NotificationEmailSection";
import { PrivacySection } from "#/components/settings/PrivacySection";
import TimezoneSelector from "#/components/TimezoneSelector";
import { TraktMark } from "#/components/TraktMark";
import { TraktImport } from "#/components/trakt/TraktImport";
import { SyncSettings } from "#/components/trakt/TraktSyncManager";
import { posthog } from "#/integrations/posthog/provider";
import { apiConfig } from "#/lib/api";
import { useAuth } from "#/lib/auth-context";
import { guessWatchCountry } from "#/lib/countries";
import {
	buildDisplayNameUpdate,
	extractErrorMessage,
	getResendLabel,
	markOnboardingCompleted,
	nextOnboardingStep,
	type OnboardingStep,
	RESEND_COOLDOWN_SECONDS,
	resolveOnboardingCountry,
	shouldResumeTraktImport,
} from "#/lib/onboarding-steps";

export const Route = createFileRoute("/onboarding")({
	head: () => ({
		meta: [{ title: "Welcome | Opnshelf" }],
	}),
	component: OnboardingPage,
});

function OnboardingPage() {
	const { user, isAuthenticated, isLoading: authLoading } = useAuth();
	const navigate = useNavigate();
	const [step, setStep] = useState<OnboardingStep>(() => {
		if (typeof window === "undefined") return "welcome";
		const search = new URLSearchParams(window.location.search);
		// Trakt authorization returns to the Trakt step.
		if (search.has("connection")) return "trakt";
		return sessionStorage.getItem("opnshelf-privacy-choice") ||
			search.has("privacyAuthorization")
			? "privacy"
			: "welcome";
	});
	const [importStarted, setImportStarted] = useState(false);
	const [followedAnyone, setFollowedAnyone] = useState(false);
	const [watchesAdded, setWatchesAdded] = useState(0);
	const initialCheckDone = useRef(false);

	// Check for an ongoing Trakt import so we can resume at the trakt step
	const { data: currentImport } = useQuery({
		...usersControllerGetMyCurrentTraktImportOptions(),
		enabled: isAuthenticated && !authLoading,
	});

	// Redirect unauthenticated users to login
	useEffect(() => {
		if (!authLoading && !isAuthenticated) {
			navigate({ to: "/login" });
		}
	}, [authLoading, isAuthenticated, navigate]);

	// Redirect already onboarded users to dashboard (only once after initial auth load)
	useEffect(() => {
		if (authLoading) return;
		if (initialCheckDone.current) return;
		initialCheckDone.current = true;
		if (isAuthenticated && !user?.needsOnboarding) {
			navigate({ to: "/" });
		}
	}, [authLoading, isAuthenticated, user?.needsOnboarding, navigate]);

	// Resume at the trakt step when there is an active import — but only once, on
	// initial load. Otherwise a background refetch (e.g. on window focus) would
	// keep yanking the user back here after they chose to continue while the
	// import runs in the background.
	const resumeChecked = useRef(false);
	useEffect(() => {
		if (authLoading) return;
		if (resumeChecked.current) return;
		// Wait for the query to resolve (undefined while loading; null = no job).
		if (currentImport === undefined) return;
		resumeChecked.current = true;
		if (shouldResumeTraktImport(currentImport)) {
			setStep("trakt");
		}
	}, [authLoading, currentImport]);

	// Every step hands off to its linear successor; the Trakt step's skip and
	// complete paths both land on suggestions.
	const goToNextStep = () => setStep((current) => nextOnboardingStep(current));

	if (authLoading) {
		return (
			<div className="container-app flex min-h-[calc(100vh-4rem)] items-center justify-center">
				<Loader2 className="size-8 animate-spin text-(--accent)" />
			</div>
		);
	}

	return (
		<div className="container-app flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
			<div className="w-full max-w-lg">
				{/* Gate: the account can't write any records (profile, lists) until
				    its email is verified, so this blocks every onboarding step until
				    it is. Verifying invalidates /auth/me, which re-renders this with
				    needsEmailVerification === false and falls through to the steps. */}
				{user?.needsEmailVerification ? (
					<VerifyEmailStep />
				) : (
					<>
						{step === "welcome" && <WelcomeStep onNext={goToNextStep} />}
						{step === "profile" && <ProfileStep onNext={goToNextStep} />}
						{step === "privacy" && (
							<PrivacySection onboarding onContinue={goToNextStep} />
						)}
						{step === "preferences" && (
							<PreferencesStep onNext={goToNextStep} />
						)}
						{step === "services" && <ServicesStep onNext={goToNextStep} />}
						{step === "notifications" && (
							<div className="card space-y-6 p-5 sm:p-7">
								<NotificationEmailSection onboarding />
								<button
									type="button"
									className="btn btn-primary w-full"
									onClick={goToNextStep}
								>
									Continue
								</button>
							</div>
						)}
						{step === "trakt" && (
							<TraktStep
								importExists={Boolean(currentImport?.id)}
								onImportStarted={() => setImportStarted(true)}
								onNext={goToNextStep}
								onSkip={goToNextStep}
							/>
						)}
						{step === "suggestions" && (
							<FollowSuggestionsStep
								onFollowed={() => setFollowedAnyone(true)}
								onNext={goToNextStep}
							/>
						)}
						{step === "watched" && (
							<WatchedSwipeStep
								onWatched={() => setWatchesAdded((count) => count + 1)}
								onNext={goToNextStep}
							/>
						)}
						{step === "done" && (
							<DoneStep
								followedAnyone={followedAnyone}
								importStarted={importStarted}
								watchesAdded={watchesAdded}
							/>
						)}
					</>
				)}
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------
   Step 0: Verify email (gate)

   New accounts on our PDS can't write records until their email is verified,
   so this blocks the rest of onboarding. createAccount already emailed the
   code; here the user enters it (resend available).
   ------------------------------------------------------------------ */
function VerifyEmailStep() {
	const { user } = useAuth();
	const [code, setCode] = useState("");
	const [cooldown, setCooldown] = useState(0);

	useEffect(() => {
		if (cooldown <= 0) return;
		const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
		return () => clearTimeout(timer);
	}, [cooldown]);

	const verifyMutation = useMutation({
		mutationKey: ["auth", "verify-email"],
		...authControllerVerifyEmailMutation(),
		onSuccess: async (result) => {
			posthog.capture("email_verified", { platform: "web" });
			// Native signup credentials are bootstrap-only. Continue through the
			// scoped Core OAuth flow before any repository seeding/onboarding.
			if (result.coreOAuthUrl) window.location.assign(result.coreOAuthUrl);
		},
		onError: (error) => {
			toast.error(
				extractErrorMessage(error, "Could not verify that code. Try again."),
			);
		},
	});

	const resendMutation = useMutation({
		mutationKey: ["auth", "resend-verification"],
		...authControllerResendVerificationMutation(),
		onSuccess: () => {
			setCooldown(RESEND_COOLDOWN_SECONDS);
			toast.success("We've sent a fresh code to your email.");
		},
		onError: (error) => {
			toast.error(
				extractErrorMessage(error, "Could not resend the code. Try again."),
			);
		},
	});

	const isSubmitting = verifyMutation.isPending;

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (isSubmitting) return;
		const trimmed = code.trim();
		if (!trimmed) return;
		verifyMutation.mutate({ body: { code: trimmed } });
	};

	return (
		<div className="card p-8">
			<div className="mb-6 flex justify-center">
				<div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-(--accent) text-[#3f2e00]">
					<MailCheck className="size-8" />
				</div>
			</div>
			<h1 className="mb-2 text-center text-display-2">Verify your email</h1>
			<p className="mx-auto mb-8 max-w-sm text-center text-(--foreground-muted)">
				We sent a verification code to the email you signed up with. Enter it
				below to finish setting up{" "}
				{user?.handle ? `@${user.handle}` : "your account"}.
			</p>

			<form onSubmit={handleSubmit} className="space-y-4">
				<div>
					<label
						htmlFor="verify-code"
						className="mb-1.5 block font-medium text-sm"
					>
						Verification code
					</label>
					<input
						id="verify-code"
						type="text"
						placeholder="Paste the code from your email"
						value={code}
						onChange={(e) => setCode(e.target.value)}
						className="input"
						autoComplete="one-time-code"
						disabled={isSubmitting}
					/>
				</div>

				<button
					type="submit"
					disabled={isSubmitting || !code.trim()}
					className="btn btn-primary w-full"
				>
					{isSubmitting ? (
						<>
							<Loader2 className="size-4 animate-spin" />
							Verifying...
						</>
					) : (
						<>
							Verify and continue
							<ArrowRight className="size-4" />
						</>
					)}
				</button>
			</form>

			<div className="mt-6 text-center text-(--foreground-muted) text-sm">
				<p>
					Didn&apos;t get it?{" "}
					<button
						type="button"
						onClick={() => resendMutation.mutate({})}
						disabled={resendMutation.isPending || cooldown > 0}
						className="text-(--accent) hover:underline disabled:cursor-not-allowed disabled:text-(--foreground-muted) disabled:no-underline"
					>
						{getResendLabel(cooldown, resendMutation.isPending)}
					</button>
				</p>
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------
   Step 1: Welcome lives in #/components/onboarding/WelcomeStep.
   ------------------------------------------------------------------ */

/* ------------------------------------------------------------------
   Step 2: Profile Setup
   ------------------------------------------------------------------ */
function ProfileStep({ onNext }: { onNext: () => void }) {
	const { user } = useAuth();
	const queryClient = useQueryClient();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [displayName, setDisplayName] = useState(user?.displayName ?? "");

	useEffect(() => {
		setDisplayName(user?.displayName ?? "");
	}, [user?.displayName]);

	const updateProfileMutation = useMutation({
		mutationKey: ["users", "me", "profile", "update"],
		...usersControllerUpdateMyProfileMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: authControllerMeOptions().queryKey,
			});
			toast.success("Display name updated");
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to update profile",
			);
		},
	});

	async function uploadAvatar(file: File): Promise<UserProfileDto> {
		const formData = new FormData();
		formData.append("avatar", file);

		const response = await fetch(
			`${apiConfig.baseUrl}/users/me/profile/avatar`,
			{
				method: "POST",
				body: formData,
				credentials: "include",
			},
		);

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({
				message: "Failed to upload avatar",
			}));
			throw new Error(errorData.message || "Failed to upload avatar");
		}

		return response.json();
	}

	const uploadAvatarMutation = useMutation({
		mutationKey: ["users", "me", "profile", "avatar", "upload"],
		mutationFn: uploadAvatar,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: authControllerMeOptions().queryKey,
			});
			toast.success("Profile photo updated");
		},
		onError: (error) => {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to upload profile photo",
			);
		},
	});

	const deleteAvatarMutation = useMutation({
		mutationKey: ["users", "me", "profile", "avatar", "delete"],
		...usersControllerDeleteMyAvatarMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: authControllerMeOptions().queryKey,
			});
			toast.success("Profile photo removed");
		},
		onError: (error) => {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to remove profile photo",
			);
		},
	});

	const handleAvatarUpload = (file: File) => {
		uploadAvatarMutation.mutate(file);
	};

	const isMutating =
		updateProfileMutation.isPending ||
		uploadAvatarMutation.isPending ||
		deleteAvatarMutation.isPending;

	return (
		<div className="card p-6">
			<div className="mb-6">
				<h2 className="text-display-3">Set Up Your Profile</h2>
				<p className="mt-1 text-(--foreground-muted) text-sm">
					Customize how you appear on Opnshelf
				</p>
			</div>

			<div className="space-y-5">
				{/* Avatar */}
				<div className="flex items-center gap-4">
					<button
						type="button"
						onClick={() => fileInputRef.current?.click()}
						aria-label="Upload profile photo"
						className="group relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-(--border) border-2 bg-(--background-subtle) transition-colors hover:border-(--accent) focus-visible:outline-none focus-visible:ring-(--accent) focus-visible:ring-2"
					>
						{user?.avatar ? (
							<img
								src={user.avatar}
								alt=""
								className="h-full w-full object-cover"
							/>
						) : (
							<User className="size-8 text-(--foreground-muted)" />
						)}
						<div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
							<Camera className="size-5 text-white" />
						</div>
						{uploadAvatarMutation.isPending && (
							<div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
								<Loader2 className="size-5 animate-spin text-white" />
							</div>
						)}
					</button>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/*"
						className="sr-only"
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (file) handleAvatarUpload(file);
							e.target.value = "";
						}}
					/>
					<div>
						<p className="font-medium text-sm">Profile photo</p>
						<p className="text-(--foreground-muted) text-sm">
							Click the avatar to upload a new photo
						</p>
						{user?.avatar && (
							<button
								type="button"
								onClick={() => deleteAvatarMutation.mutate({})}
								disabled={deleteAvatarMutation.isPending}
								className="mt-1 font-medium text-red-600 text-sm hover:text-red-700 disabled:opacity-50"
							>
								{deleteAvatarMutation.isPending ? "Removing…" : "Remove photo"}
							</button>
						)}
					</div>
				</div>

				{/* Display Name */}
				<div className="space-y-2">
					<label
						htmlFor="onboarding-display-name"
						className="font-medium text-sm"
					>
						Display name
					</label>
					<input
						id="onboarding-display-name"
						type="text"
						value={displayName}
						onChange={(e) => setDisplayName(e.target.value)}
						placeholder="Your display name"
						className="input"
					/>
				</div>

				{/* Handle */}
				<div className="space-y-2">
					<label htmlFor="onboarding-handle" className="font-medium text-sm">
						Handle
					</label>
					<input
						id="onboarding-handle"
						type="text"
						value={`@${user?.handle ?? ""}`}
						disabled
						className="input cursor-not-allowed bg-(--background-subtle)"
						readOnly
					/>
					<p className="text-(--foreground-muted) text-xs">
						Your handle is managed by your Bluesky account
					</p>
				</div>

				<button
					type="button"
					onClick={async () => {
						const update = buildDisplayNameUpdate(
							displayName,
							user?.displayName,
						);
						if (update) {
							try {
								await updateProfileMutation.mutateAsync({ body: update });
							} catch {
								// Error handled by mutation onError
								return;
							}
						}
						onNext();
					}}
					disabled={isMutating}
					className="btn btn-primary w-full"
				>
					{updateProfileMutation.isPending ? (
						<>
							<Loader2 className="size-4 animate-spin" />
							Saving…
						</>
					) : (
						<>
							Continue
							<ArrowRight className="size-4" />
						</>
					)}
				</button>
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------
   Step 3: Preferences
   ------------------------------------------------------------------ */
function PreferencesStep({ onNext }: { onNext: () => void }) {
	const queryClient = useQueryClient();
	const { data: settings, isLoading: settingsLoading } = useQuery({
		...usersControllerGetMySettingsOptions(),
	});
	const [country, setCountry] = useState("US");
	const [timezone, setTimezone] = useState(
		Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
	);

	useEffect(() => {
		if (!settings) return;
		setCountry(
			resolveOnboardingCountry(settings.watchCountry, guessWatchCountry),
		);
		setTimezone(settings.timezone);
	}, [settings]);

	const updateSettingsMutation = useMutation({
		mutationKey: ["users", "me", "settings", "update"],
		...usersControllerUpdateMySettingsMutation(),
		// Returned so the step's own onSuccess (which advances) waits for the
		// refetch: the next step reads the settings cache and must see this save.
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: usersControllerGetMySettingsOptions().queryKey,
			}),
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to save preferences",
			);
		},
	});

	function handleSave() {
		updateSettingsMutation.mutate(
			{ body: { watchCountry: country, timezone } },
			{ onSuccess: onNext },
		);
	}

	return (
		<div className="card p-8">
			<div className="mb-6 flex justify-center">
				<Logo className="size-16 rounded-2xl" />
			</div>
			<h1 className="mb-2 text-center text-display-2">Your Preferences</h1>
			<p className="mb-8 text-center text-(--foreground-muted)">
				Choose how watch dates are grouped and where streaming availability is
				shown.
			</p>

			<div className="space-y-5">
				<div className="space-y-2">
					<p className="font-medium text-sm">Timezone</p>
					<TimezoneSelector
						value={timezone}
						onChange={setTimezone}
						disabled={settingsLoading || updateSettingsMutation.isPending}
					/>
					<p className="text-(--foreground-subtle) text-xs">
						Used to group watches into the correct calendar day.
					</p>
				</div>

				<div className="space-y-2">
					<p className="font-medium text-sm">Streaming country</p>
					<CountrySelector
						value={country}
						onChange={setCountry}
						disabled={settingsLoading || updateSettingsMutation.isPending}
					/>
				</div>
				<p className="text-(--foreground-subtle) text-xs">
					You can change these at any time in Settings.
				</p>
			</div>

			<div className="mt-8">
				<button
					type="button"
					onClick={handleSave}
					disabled={settingsLoading || updateSettingsMutation.isPending}
					className="btn btn-primary w-full"
				>
					{updateSettingsMutation.isPending ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<>
							Continue
							<ArrowRight className="size-4" />
						</>
					)}
				</button>
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------
   Step 3b: My Services
   ------------------------------------------------------------------ */
const SERVICE_SKELETON_KEYS = Array.from(
	{ length: 12 },
	(_, i) => `service-skeleton-${i + 1}`,
);

function ServicesStep({ onNext }: { onNext: () => void }) {
	const queryClient = useQueryClient();
	const { data: settings, isLoading: settingsLoading } = useQuery({
		...usersControllerGetMySettingsOptions(),
	});
	const [selected, setSelected] = useState<number[]>([]);

	useEffect(() => {
		if (settings) setSelected(settings.streamingServiceIds);
	}, [settings]);

	const updateSettingsMutation = useMutation({
		mutationKey: ["users", "me", "settings", "update"],
		...usersControllerUpdateMySettingsMutation(),
		// Returned so the step's own onSuccess (which advances) waits for the
		// refetch: the next step reads the settings cache and must see this save.
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: usersControllerGetMySettingsOptions().queryKey,
			}),
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to save your services",
			);
		},
	});

	function handleSave() {
		// Nothing to save when the selection is untouched, and never save over
		// services that failed to load: that would replace them with an empty list.
		if (!settings || sameServices(selected, settings.streamingServiceIds)) {
			onNext();
			return;
		}
		updateSettingsMutation.mutate(
			{ body: { streamingServiceIds: selected } },
			{ onSuccess: onNext },
		);
	}

	return (
		<div className="card p-8">
			<div className="mb-6 flex justify-center">
				<Logo className="size-16 rounded-2xl" />
			</div>
			<h1 className="mb-2 text-center text-display-2">Your Services</h1>
			<p className="mb-8 text-center text-(--foreground-muted)">
				Pick the streaming services you pay for, so Up Next and Discover can
				show what you can actually watch.
			</p>

			{settingsLoading ? (
				<div className="grid grid-cols-4 gap-2 sm:grid-cols-6" aria-busy="true">
					{SERVICE_SKELETON_KEYS.map((key) => (
						<div
							key={key}
							className="h-[72px] animate-pulse rounded-xl bg-(--background-subtle)"
						/>
					))}
				</div>
			) : (
				<StreamingServicePicker
					country={settings?.watchCountry ?? "US"}
					value={selected}
					onToggle={(id) =>
						setSelected((current) => toggleService(current, id))
					}
					disabled={updateSettingsMutation.isPending}
				/>
			)}
			<p className="mt-4 text-(--foreground-subtle) text-xs">
				You can change these at any time in Settings.
			</p>

			<div className="mt-8 space-y-2">
				<button
					type="button"
					onClick={handleSave}
					disabled={settingsLoading || updateSettingsMutation.isPending}
					className="btn btn-primary w-full"
				>
					{updateSettingsMutation.isPending ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<>
							Continue
							<ArrowRight className="size-4" />
						</>
					)}
				</button>
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------
   Step 4: Trakt — Trakt Sync first, Trakt Import as the fallback
   ------------------------------------------------------------------ */
const traktStatusKey = ["trakt-sync", "status"];

function TraktStep({
	onNext,
	onSkip,
	onImportStarted,
	importExists,
}: {
	onNext: () => void;
	onSkip: () => void;
	onImportStarted: () => void;
	importExists: boolean;
}) {
	const queryClient = useQueryClient();
	// Trakt authorization returns here with ?connection=connected|cancelled|failed.
	const [connection] = useState(() =>
		typeof window === "undefined"
			? null
			: new URLSearchParams(window.location.search).get("connection"),
	);
	useEffect(() => {
		if (connection) window.history.replaceState(null, "", "/onboarding");
	}, [connection]);
	const status = useQuery({
		queryKey: traktStatusKey,
		queryFn: async ({ signal }) =>
			(await traktSyncControllerStatus({ signal, throwOnError: true })).data,
	});
	const connect = useMutation({
		...traktSyncControllerConnectMutation(),
		onSuccess: (data) => window.location.assign(data.url),
	});
	const refresh = () =>
		queryClient.invalidateQueries({ queryKey: traktStatusKey });

	const importPanel = (
		<TraktImport
			title="Import once"
			titleClassName="font-semibold text-base"
			description="Copy your public Trakt history by username. Nothing changes on Trakt."
			onComplete={onNext}
			onImportStarted={onImportStarted}
		/>
	);

	if (status.isPending) {
		return (
			<output
				aria-label="Loading Trakt"
				className="card block h-96 animate-pulse"
			/>
		);
	}

	const data = status.data;
	// Trakt Sync is unavailable (not set up, or its status failed to load):
	// offer the Import on its own.
	if (!data?.configured) {
		return (
			<div className="card p-6">
				<TraktImport
					title="Import from Trakt"
					description="Copy your public Trakt history by username."
					onSkip={onSkip}
					onComplete={onNext}
					onImportStarted={onImportStarted}
				/>
			</div>
		);
	}

	const connected =
		data.status !== "disconnected" && data.status !== "reconnect";

	if (connected) {
		const enabled = data.status === "active" || data.status === "preparing";
		return (
			<div className="card space-y-5 p-6">
				<div>
					<h2 className="text-display-3">
						{enabled ? "Trakt Sync is on" : "Choose what to sync"}
					</h2>
					<p className="mt-1 text-(--foreground-muted) text-sm">
						Connected as @{data.username}.{" "}
						{enabled
							? "We're comparing your history in the background. You can keep going."
							: "Pick what moves and in which direction, then confirm."}
					</p>
				</div>
				{!enabled && (
					<SyncSettings
						key={data.username}
						status={data}
						onSaved={refresh}
						className=""
						showHeading={false}
					/>
				)}
				<div className="flex items-center justify-between gap-3">
					<p className="text-(--foreground-subtle) text-xs">
						You can change this later in Settings.
					</p>
					{enabled ? (
						<button type="button" onClick={onNext} className="btn btn-primary">
							Continue
							<ArrowRight className="size-4" />
						</button>
					) : (
						<button
							type="button"
							onClick={onSkip}
							className="shrink-0 text-(--foreground-muted) text-sm hover:text-(--foreground)"
						>
							Skip
						</button>
					)}
				</div>
			</div>
		);
	}

	return (
		<div className="card p-6">
			<h2 className="text-display-3">Already on Trakt?</h2>
			<p className="mt-1 mb-5 text-(--foreground-muted) text-sm">
				Connect once and Opnshelf keeps your history in step with Trakt.
			</p>
			<div className="rounded-xl border border-(--accent)/30 bg-linear-to-br from-(--accent)/15 to-transparent p-5">
				<div className="mb-4 flex items-center justify-center gap-3">
					<img src="/icon.png" alt="" className="size-11 rounded-xl" />
					<ArrowLeftRight className="size-5 text-(--accent)" />
					<TraktMark className="size-11" />
				</div>
				<ul className="mb-5 space-y-1.5 text-(--foreground-muted) text-sm">
					{[
						"Bring over your Watch history and Ratings",
						"New Watches keep flowing, in the direction you choose",
						"Review every transfer before sync starts",
					].map((line) => (
						<li key={line} className="flex gap-2">
							<Check className="mt-0.5 size-4 shrink-0 text-(--accent)" />
							{line}
						</li>
					))}
				</ul>
				<button
					type="button"
					className="btn btn-primary w-full"
					disabled={connect.isPending}
					onClick={() =>
						connect.mutate({
							body: { platform: "web", returnTo: "onboarding" },
						})
					}
				>
					{connect.isPending
						? "Opening Trakt…"
						: data.status === "reconnect"
							? "Reconnect Trakt"
							: "Connect Trakt"}
				</button>
				{(connect.error || connection === "failed") && (
					<p role="alert" className="mt-3 text-(--destructive) text-sm">
						{connect.error
							? traktError(connect.error)
							: "Trakt could not connect. Try connecting again."}
					</p>
				)}
			</div>
			<details className="group mt-5" open={importExists}>
				<summary className="cursor-pointer list-none text-(--foreground-muted) text-sm hover:text-(--foreground)">
					Rather not log in?{" "}
					<span className="underline underline-offset-4">
						Import your public history once
					</span>
				</summary>
				<div className="mt-4">{importPanel}</div>
			</details>
			<div className="mt-5 flex justify-end">
				<button
					type="button"
					onClick={onSkip}
					className="text-(--foreground-muted) text-sm hover:text-(--foreground)"
				>
					Skip
				</button>
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------
   Step 7: Done
   ------------------------------------------------------------------ */
function DoneStep({
	importStarted,
	followedAnyone,
	watchesAdded,
}: {
	importStarted: boolean;
	followedAnyone: boolean;
	watchesAdded: number;
}) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { user } = useAuth();

	const completeOnboarding = useMutation({
		mutationKey: ["users", "me", "completeOnboarding"],
		mutationFn: async () => {
			const { data } = await usersControllerCompleteOnboarding({
				throwOnError: true,
			});
			return data;
		},
		onSuccess: (data) => {
			posthog.capture("onboarding_completed", {
				import_started: importStarted,
				followed_anyone: followedAnyone,
				watches_added: watchesAdded,
				platform: "web",
			});
			const meKey = authControllerMeOptions().queryKey;
			// Optimistically update auth cache so needsOnboarding becomes false
			queryClient.setQueryData(meKey, (old: UserDto | undefined) =>
				markOnboardingCompleted(old, data.onboardingCompletedAt),
			);
			// Trigger a background refetch to keep cache in sync
			queryClient.invalidateQueries({ queryKey: meKey });
		},
		onError: (error) => {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to complete onboarding",
			);
		},
	});

	useEffect(() => {
		// Auto-complete onboarding when this step mounts
		completeOnboarding.mutate();
	}, [completeOnboarding.mutate]);

	return (
		<div className="card p-8 text-center">
			<div className="mb-6 flex justify-center">
				<div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
					<CheckCircle className="size-8 text-green-500" />
				</div>
			</div>
			<h2 className="mb-2 text-display-2">You&apos;re all set!</h2>
			<p className="mx-auto mb-6 max-w-sm text-(--foreground-muted)">
				Welcome to Opnshelf{user?.displayName ? `, ${user.displayName}` : ""}.
				Start tracking what you watch and discover what your friends are into.
			</p>
			{completeOnboarding.isPending ? (
				<div className="flex items-center justify-center gap-2 text-(--foreground-muted) text-sm">
					<Loader2 className="size-4 animate-spin" />
					Finishing up...
				</div>
			) : (
				<button
					type="button"
					onClick={() => navigate({ to: "/" })}
					className="btn btn-primary inline-flex"
				>
					Go to Dashboard
					<ArrowRight className="size-4" />
				</button>
			)}
		</div>
	);
}
