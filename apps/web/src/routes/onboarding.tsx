import {
	authControllerMeOptions,
	authControllerResendVerificationMutation,
	authControllerVerifyEmailMutation,
	getTraktImportStatusMessage,
	getTraktImportStatusProgress,
	isActiveTraktImportStatus,
	isKnownTraktImportStatus,
	isTerminalTraktImportStatus,
	socialControllerFollowMutation,
	socialControllerGetSuggestionsOptions,
	type TraktImportStatusJob,
	type UserDto,
	type UserProfileDto,
	usersControllerCompleteOnboarding,
	usersControllerDeleteMyAvatarMutation,
	usersControllerFetchMyTraktPublicHistory,
	usersControllerGetMyCurrentTraktImportOptions,
	usersControllerStartMyTraktImport,
	usersControllerUpdateMyProfileMutation,
	usersControllerUpdateMySettingsMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	ArrowRight,
	Camera,
	CheckCircle,
	Film,
	Loader2,
	MailCheck,
	Tv,
	Upload,
	User,
	UserPlus,
	X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import CountrySelector from "#/components/CountrySelector";
import { UserAvatar } from "#/components/following/UserAvatar";
import Logo from "#/components/Logo";
import { apiConfig } from "#/lib/api";
import { useAuth } from "#/lib/auth-context";

export const Route = createFileRoute("/onboarding")({
	component: OnboardingPage,
});

type OnboardingStep =
	| "welcome"
	| "profile"
	| "preferences"
	| "trakt"
	| "suggestions"
	| "done";

function TraktAvatar({ url, name }: { url?: string; name: string }) {
	const [error, setError] = useState(false);

	if (!url || error) {
		return (
			<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--accent-subtle)">
				<Tv className="size-5 text-(--accent)" />
			</div>
		);
	}

	return (
		<img
			src={url}
			alt={name}
			className="h-10 w-10 shrink-0 rounded-full object-cover"
			referrerPolicy="no-referrer"
			onError={() => setError(true)}
		/>
	);
}

function OnboardingPage() {
	const { user, isAuthenticated, isLoading: authLoading } = useAuth();
	const navigate = useNavigate();
	const [step, setStep] = useState<OnboardingStep>("welcome");
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
			navigate({ to: "/dashboard" });
		}
	}, [authLoading, isAuthenticated, user?.needsOnboarding, navigate]);

	// Resume at the trakt step when there is an active import
	useEffect(() => {
		if (authLoading) return;
		if (
			currentImport?.id &&
			isKnownTraktImportStatus(currentImport.status) &&
			!isTerminalTraktImportStatus(currentImport.status)
		) {
			setStep("trakt");
		}
	}, [authLoading, currentImport]);

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
						{step === "welcome" && (
							<WelcomeStep onNext={() => setStep("profile")} />
						)}
						{step === "profile" && (
							<ProfileStep onNext={() => setStep("preferences")} />
						)}
						{step === "preferences" && (
							<PreferencesStep onNext={() => setStep("trakt")} />
						)}
						{step === "trakt" && (
							<TraktStep
								onNext={() => setStep("suggestions")}
								onSkip={() => setStep("suggestions")}
							/>
						)}
						{step === "suggestions" && (
							<FollowSuggestionsStep onNext={() => setStep("done")} />
						)}
						{step === "done" && <DoneStep />}
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
const RESEND_COOLDOWN_SECONDS = 60;

/** Pull a human-readable message out of a NestJS error body (string or string[]). */
function extractErrorMessage(error: unknown, fallback: string): string {
	if (error && typeof error === "object" && "message" in error) {
		const message = (error as { message?: unknown }).message;
		if (Array.isArray(message)) return message.join(", ");
		if (typeof message === "string" && message.length > 0) return message;
	}
	return fallback;
}

function VerifyEmailStep() {
	const { user } = useAuth();
	const queryClient = useQueryClient();
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
		onSuccess: async () => {
			// Flips needsEmailVerification to false; the parent re-renders into the
			// welcome step, which is where we greet them — no toast needed here.
			await queryClient.invalidateQueries({
				queryKey: authControllerMeOptions().queryKey,
			});
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
						{cooldown > 0
							? `Resend in ${cooldown}s`
							: resendMutation.isPending
								? "Sending..."
								: "Resend code"}
					</button>
				</p>
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------
   Step 1: Welcome
   ------------------------------------------------------------------ */
function WelcomeStep({ onNext }: { onNext: () => void }) {
	return (
		<div className="card p-8 text-center">
			<div className="mb-6 flex justify-center">
				<Logo className="size-16 rounded-2xl" />
			</div>
			<h1 className="mb-3 text-display-2">Welcome to OpnShelf</h1>
			<p className="mx-auto mb-8 max-w-sm text-(--foreground-muted)">
				Let&apos;s get you set up in just a few steps. You can import your watch
				history and connect with friends already here.
			</p>
			<button type="button" onClick={onNext} className="btn btn-primary w-full">
				Get Started
				<ArrowRight className="size-4" />
			</button>
		</div>
	);
}

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
					Customize how you appear on OpnShelf
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
						if (displayName !== (user?.displayName ?? "")) {
							try {
								await updateProfileMutation.mutateAsync({
									body: { displayName: displayName || undefined },
								});
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
	const { userSettings } = useAuth();
	const queryClient = useQueryClient();
	const [country, setCountry] = useState(userSettings?.watchCountry ?? "US");

	const updateSettingsMutation = useMutation({
		...usersControllerUpdateMySettingsMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["users", "me", "settings"] });
		},
	});

	function handleSave() {
		updateSettingsMutation.mutate(
			{ body: { watchCountry: country } },
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
				Tell us where you are so we can show streaming availability in your
				country.
			</p>

			<div className="space-y-2">
				<p className="font-medium text-sm">Streaming country</p>
				<CountrySelector
					value={country}
					onChange={setCountry}
					disabled={updateSettingsMutation.isPending}
				/>
				<p className="text-(--foreground-subtle) text-xs">
					You can change this at any time in Settings.
				</p>
			</div>

			<div className="mt-8">
				<button
					type="button"
					onClick={handleSave}
					disabled={updateSettingsMutation.isPending}
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
   Step 4: Trakt.tv Import
   ------------------------------------------------------------------ */
function TraktStep({
	onNext,
	onSkip,
}: {
	onNext: () => void;
	onSkip: () => void;
}) {
	const [username, setUsername] = useState("");
	const [previewData, setPreviewData] = useState<{
		profile: { username: string; name?: string; avatarUrl?: string };
		importableCount: number;
		previewItems: Array<{
			type: "movie" | "episode";
			title: string;
			subtitle?: string;
			watchedAt: string;
		}>;
	} | null>(null);
	const [jobData, setJobData] = useState<TraktImportStatusJob | null>(null);
	const [fetchError, setFetchError] = useState("");
	const queryClient = useQueryClient();

	const fetchPreview = useMutation({
		mutationFn: async (body: { username: string }) => {
			const { data } = await usersControllerFetchMyTraktPublicHistory({
				body,
				throwOnError: true,
			});
			return data;
		},
		onSuccess: (data) => {
			setPreviewData(data);
			setFetchError("");
		},
		onError: (error: unknown) => {
			const message =
				typeof error === "object" && error !== null && "message" in error
					? String((error as { message?: string }).message)
					: "Could not fetch Trakt history. Please check the username and try again.";
			setFetchError(message);
			toast.error(message);
		},
	});

	const startImport = useMutation({
		mutationFn: async (body: { username: string }) => {
			const { data } = await usersControllerStartMyTraktImport({
				body,
				throwOnError: true,
			});
			return data;
		},
		onSuccess: (data) => {
			toast.success("Import started");
			if (data.job) {
				setJobData({
					status: data.job.status,
					currentPage: data.job.currentPage,
					totalPages: data.job.totalPages,
					importedCount: data.job.importedCount,
					skippedCount: data.job.skippedCount,
					failedCount: data.job.failedCount,
					lastError: data.job.lastError,
				});
				// Force an immediate refetch of the import status
				queryClient.invalidateQueries({
					queryKey: usersControllerGetMyCurrentTraktImportOptions().queryKey,
				});
			}
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to start import",
			);
		},
	});

	// Fetch existing import and poll when active
	const { data: currentImport } = useQuery({
		...usersControllerGetMyCurrentTraktImportOptions(),
		refetchInterval:
			jobData && isActiveTraktImportStatus(jobData.status) ? 3000 : false,
	});

	useEffect(() => {
		if (currentImport?.id && isKnownTraktImportStatus(currentImport.status)) {
			setJobData({
				status: currentImport.status,
				currentPage: currentImport.currentPage,
				totalPages: currentImport.totalPages,
				importedCount: currentImport.importedCount,
				skippedCount: currentImport.skippedCount,
				failedCount: currentImport.failedCount,
				lastError: currentImport.lastError,
			});
		}
	}, [currentImport]);

	const handleFetch = () => {
		if (!username.trim()) return;
		setPreviewData(null);
		setJobData(null);
		fetchPreview.mutate({ username: username.trim() });
	};

	const handleStartImport = () => {
		if (!username.trim()) return;
		startImport.mutate({ username: username.trim() });
	};

	const isImportDone = jobData && isTerminalTraktImportStatus(jobData.status);
	const progress = jobData ? getTraktImportStatusProgress(jobData) : null;
	const statusMessage = jobData ? getTraktImportStatusMessage(jobData) : null;

	return (
		<div className="card p-6">
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h2 className="text-display-3">Import from Trakt</h2>
					<p className="mt-1 text-(--foreground-muted) text-sm">
						Import your public watch history from Trakt.tv
					</p>
				</div>
				{!jobData && (
					<button
						type="button"
						onClick={onSkip}
						className="text-(--foreground-muted) text-sm hover:text-(--foreground)"
					>
						Skip
					</button>
				)}
			</div>

			{/* Username input */}
			{!previewData && !jobData && (
				<div className="space-y-4">
					<div>
						<label
							htmlFor="trakt-username"
							className="mb-1.5 block font-medium text-sm"
						>
							Trakt Username
						</label>
						<input
							id="trakt-username"
							type="text"
							placeholder="your-trakt-username"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							className="input"
							onKeyDown={(e) => {
								if (e.key === "Enter") handleFetch();
							}}
						/>
					</div>
					{fetchError && <p className="text-red-500 text-sm">{fetchError}</p>}
					<button
						type="button"
						onClick={handleFetch}
						disabled={fetchPreview.isPending || !username.trim()}
						className="btn btn-primary w-full"
					>
						{fetchPreview.isPending ? (
							<>
								<Loader2 className="size-4 animate-spin" />
								Fetching preview...
							</>
						) : (
							<>
								<Upload className="size-4" />
								Preview History
							</>
						)}
					</button>
				</div>
			)}

			{/* Preview results */}
			{previewData && !jobData && (
				<div className="space-y-4">
					<div className="flex items-center gap-3 rounded-lg bg-(--background-subtle) p-3">
						<TraktAvatar
							url={previewData.profile.avatarUrl}
							name={previewData.profile.username}
						/>
						<div>
							<p className="font-medium text-sm">
								{previewData.profile.name || previewData.profile.username}
							</p>
							<p className="text-(--foreground-muted) text-xs">
								@{previewData.profile.username}
							</p>
						</div>
					</div>

					{previewData.previewItems.length > 0 && (
						<div className="space-y-2">
							<p className="font-medium text-sm">Recent items</p>
							{previewData.previewItems.map((item) => (
								<div
									key={`${item.title}-${item.watchedAt}`}
									className="flex items-center gap-3 rounded-lg border border-(--border) bg-(--background-elevated) p-3"
								>
									<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-(--accent-subtle)">
										{item.type === "movie" ? (
											<Film className="size-4 text-(--accent)" />
										) : (
											<Tv className="size-4 text-(--accent)" />
										)}
									</div>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm">{item.title}</p>
										{item.subtitle && (
											<p className="truncate text-(--foreground-muted) text-xs">
												{item.subtitle}
											</p>
										)}
									</div>
								</div>
							))}
						</div>
					)}

					<div className="flex gap-3">
						<button
							type="button"
							onClick={() => {
								setPreviewData(null);
								setUsername("");
							}}
							className="btn btn-secondary flex-1"
						>
							<X className="size-4" />
							Change
						</button>
						<button
							type="button"
							onClick={handleStartImport}
							disabled={startImport.isPending}
							className="btn btn-primary flex-1"
						>
							{startImport.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<>
									<Upload className="size-4" />
									Start Import
								</>
							)}
						</button>
					</div>
				</div>
			)}

			{/* Import progress */}
			{jobData && (
				<div className="space-y-4">
					<div className="flex items-center gap-3">
						{isImportDone ? (
							<CheckCircle className="size-5 text-green-500" />
						) : (
							<Loader2 className="size-5 animate-spin text-(--accent)" />
						)}
						<div>
							<p className="font-medium text-sm">
								{isImportDone ? "Import finished" : "Importing..."}
							</p>
							{statusMessage && (
								<p className="text-(--foreground-muted) text-xs">
									{statusMessage}
								</p>
							)}
						</div>
					</div>

					{typeof progress === "number" && (
						<div className="space-y-1">
							<div className="h-2 w-full overflow-hidden rounded-full bg-(--background-subtle)">
								<div
									className="h-full rounded-full bg-(--accent) transition-all duration-500"
									style={{ width: `${progress}%` }}
								/>
							</div>
							<p className="text-right text-(--foreground-muted) text-xs">
								{progress}%
							</p>
						</div>
					)}

					{isImportDone && (
						<button
							type="button"
							onClick={() => {
								setJobData(null);
								setPreviewData(null);
								setUsername("");
								// Invalidate shelf so the user sees imported items
								queryClient.invalidateQueries({ queryKey: ["shelf"] });
								onNext();
							}}
							className="btn btn-primary w-full"
						>
							Continue
							<ArrowRight className="size-4" />
						</button>
					)}
				</div>
			)}
		</div>
	);
}

/* ------------------------------------------------------------------
   Step 4: Follow Suggestions
   ------------------------------------------------------------------ */
function FollowSuggestionsStep({ onNext }: { onNext: () => void }) {
	const queryClient = useQueryClient();
	const { data, isLoading } = useQuery(socialControllerGetSuggestionsOptions());

	const followMutation = useMutation({
		...socialControllerFollowMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: socialControllerGetSuggestionsOptions().queryKey,
			});
			toast.success("Followed");
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to follow user",
			);
		},
	});

	const suggestions = data?.items ?? [];

	return (
		<div className="card p-6">
			<div className="mb-6">
				<h2 className="text-display-3">People to Follow</h2>
				<p className="mt-1 text-(--foreground-muted) text-sm">
					Find people you know on OpnShelf
				</p>
			</div>

			{isLoading && (
				<div className="flex justify-center py-8">
					<Loader2 className="size-5 animate-spin text-(--foreground-muted)" />
				</div>
			)}

			{!isLoading && suggestions.length === 0 && (
				<p className="py-8 text-center text-(--foreground-muted) text-sm">
					No suggestions right now
				</p>
			)}

			{suggestions.length > 0 && (
				<div className="mb-6 space-y-1">
					{suggestions.map((person) => (
						<div
							key={person.did}
							className="flex items-center gap-3 rounded-lg p-2 hover:bg-(--background-subtle)"
						>
							<UserAvatar
								src={
									typeof person.avatar === "string" ? person.avatar : undefined
								}
								alt={String(person.displayName) || person.handle}
							/>
							<div className="min-w-0 flex-1">
								<p className="truncate font-medium text-sm">
									{String(person.displayName) || person.handle}
								</p>
								<p className="text-(--foreground-muted) text-xs">
									@{person.handle}
								</p>
							</div>
							{person.isFollowing ? (
								<span className="text-(--foreground-muted) text-xs">
									Following
								</span>
							) : (
								<button
									type="button"
									className="btn btn-primary btn-sm"
									onClick={() =>
										followMutation.mutate({
											path: { targetDid: person.did },
										})
									}
									disabled={
										followMutation.isPending &&
										followMutation.variables?.path?.targetDid === person.did
									}
								>
									{followMutation.isPending &&
									followMutation.variables?.path?.targetDid === person.did ? (
										<Loader2 className="size-3 animate-spin" />
									) : (
										<>
											<UserPlus className="size-3" />
											Follow
										</>
									)}
								</button>
							)}
						</div>
					))}
				</div>
			)}

			<button type="button" onClick={onNext} className="btn btn-primary w-full">
				Continue
				<ArrowRight className="size-4" />
			</button>
		</div>
	);
}

/* ------------------------------------------------------------------
   Step 5: Done
   ------------------------------------------------------------------ */
function DoneStep() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { user } = useAuth();

	const completeOnboarding = useMutation({
		mutationFn: async () => {
			const { data } = await usersControllerCompleteOnboarding({
				throwOnError: true,
			});
			return data;
		},
		onSuccess: (data) => {
			const meKey = authControllerMeOptions().queryKey;
			// Optimistically update auth cache so needsOnboarding becomes false
			queryClient.setQueryData(meKey, (old: UserDto | undefined) => {
				if (!old) return old;
				return {
					...old,
					onboardingCompletedAt: data.onboardingCompletedAt,
					needsOnboarding: false,
				};
			});
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
				Welcome to OpnShelf{user?.displayName ? `, ${user.displayName}` : ""}.
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
					onClick={() => navigate({ to: "/dashboard" })}
					className="btn btn-primary inline-flex"
				>
					Go to Dashboard
					<ArrowRight className="size-4" />
				</button>
			)}
		</div>
	);
}
