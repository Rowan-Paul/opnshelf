import {
	authControllerMeQueryKey,
	traktError,
	traktSyncControllerConnectMutation,
	traktSyncControllerStatus,
	type UserDto,
	usersControllerCompleteOnboarding,
	usersControllerGetMySettingsOptions,
	usersControllerUpdateMySettingsMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
	ArrowLeftRight,
	ArrowRight,
	Check,
	CheckCircle2,
	ChevronLeft,
} from "lucide-react-native";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import {
	ActivityIndicator,
	BackHandler,
	Pressable,
	ScrollView,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TraktMark } from "@/components/marks/TraktMark";
import { SuggestionsStep } from "@/components/onboarding/SuggestionsStep";
import { WatchedMediaSwipe } from "@/components/onboarding/watched-media-swipe";
import { AvatarEditor } from "@/components/profile/AvatarEditor";
import { NotificationPreferences } from "@/components/settings/NotificationPreferences";
import { PrivacySection } from "@/components/settings/privacy-section";
import { TimezonePicker } from "@/components/settings/TimezonePicker";
import { TraktImportPanel } from "@/components/trakt/TraktImportPanel";
import { SyncSettings } from "@/components/trakt/TraktSyncManager";
import { Button } from "@/components/ui/button";
import { CountryPicker } from "@/components/ui/country-picker";
import { Screen } from "@/components/ui/screen";
import {
	StreamingServicePicker,
	sameServices,
	toggleService,
} from "@/components/ui/streaming-service-picker";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { guessWatchCountry } from "@/lib/countries";
import { posthog } from "@/lib/posthog";
import { useProfileSetup } from "@/lib/use-profile";

const logo = require("../../assets/images/icon.png");
const traktStatusKey = ["trakt-sync", "status"];

type OnboardingStep =
	| "welcome"
	| "profile"
	| "privacy"
	| "preferences"
	| "services"
	| "notifications"
	| "trakt"
	| "suggestions"
	| "watches"
	| "done";

const STEP_SEQUENCE: OnboardingStep[] = [
	"welcome",
	"profile",
	"privacy",
	"preferences",
	"services",
	"notifications",
	"trakt",
	"suggestions",
	"watches",
	"done",
];

/** Reusable amber primary button used as each step's "Continue" affordance. */
function PrimaryButton({
	label,
	onPress,
	loading,
	disabled,
	icon = true,
}: {
	label: string;
	onPress: () => void;
	loading?: boolean;
	disabled?: boolean;
	icon?: boolean;
}) {
	const isDisabled = disabled || loading;
	return (
		<Button
			label={label}
			loading={loading}
			disabled={isDisabled}
			trailing={icon ? <ArrowRight color="#3f2e00" size={18} /> : undefined}
			onPress={onPress}
		/>
	);
}

/**
 * Per-step layout: content fills the screen (centered or scrollable) and the
 * footer is pinned to the bottom safe area so the primary action never scrolls
 * away — matching the web step cards' bottom-anchored CTA.
 */
function StepScaffold({
	children,
	footer,
	center,
}: {
	children: ReactNode;
	footer?: ReactNode;
	center?: boolean;
}) {
	const insets = useSafeAreaInsets();
	return (
		<View className="flex-1">
			{center ? (
				<View className="flex-1 justify-center gap-6">{children}</View>
			) : (
				<ScrollView
					className="flex-1"
					contentContainerClassName="gap-6 pt-1 pb-4"
					keyboardShouldPersistTaps="handled"
					showsVerticalScrollIndicator={false}
				>
					{children}
				</ScrollView>
			)}
			{footer ? (
				<View
					className="gap-2 pt-3"
					style={{ paddingBottom: insets.bottom + 8 }}
				>
					{footer}
				</View>
			) : null}
		</View>
	);
}

export default function OnboardingScreen() {
	const { user, isLoading, isAuthenticated } = useAuth();
	// Trakt authorization can land here as a fresh deep link on Android.
	const { connection } = useLocalSearchParams<{ connection?: string }>();
	const [step, setStep] = useState<OnboardingStep>(
		connection ? "trakt" : "welcome",
	);
	const queryClient = useQueryClient();
	useEffect(() => {
		if (!connection) return;
		setStep("trakt");
		queryClient.invalidateQueries({ queryKey: traktStatusKey });
	}, [connection, queryClient]);
	const [importStarted, setImportStarted] = useState(false);
	const [followedAnyone, setFollowedAnyone] = useState(false);
	const [watchesAdded, setWatchesAdded] = useState(0);

	const goBack = useCallback(() => {
		setStep((current) => {
			const idx = STEP_SEQUENCE.indexOf(current);
			return idx > 0 ? STEP_SEQUENCE[idx - 1] : current;
		});
	}, []);

	// Android hardware back steps the wizard backwards; at the first/last step we
	// let the OS handle it.
	useEffect(() => {
		const sub = BackHandler.addEventListener("hardwareBackPress", () => {
			const idx = STEP_SEQUENCE.indexOf(step);
			if (idx > 0 && step !== "done") {
				goBack();
				return true;
			}
			return false;
		});
		return () => sub.remove();
	}, [step, goBack]);

	// Not authenticated -> login; unverified email -> verify; already onboarded -> tabs.
	if (!isLoading && !isAuthenticated) {
		return <Redirect href="/login" />;
	}
	if (!isLoading && user?.needsEmailVerification) {
		return <Redirect href="/verify-email" />;
	}
	if (!isLoading && user && !user.needsOnboarding && step !== "done") {
		return <Redirect href="/" />;
	}

	if (isLoading) {
		return (
			<Screen>
				<View className="flex-1 items-center justify-center">
					<ActivityIndicator color="#f3bc00" />
				</View>
			</Screen>
		);
	}

	const canGoBack = step !== "welcome" && step !== "done";

	return (
		<Screen>
			<View className="h-10 flex-row items-center">
				{canGoBack ? (
					<Pressable
						hitSlop={8}
						onPress={goBack}
						className="flex-row items-center"
					>
						<ChevronLeft color="#94a3b8" size={26} />
					</Pressable>
				) : null}
			</View>

			<View className="flex-1">
				{step === "welcome" && (
					<WelcomeStep onNext={() => setStep("profile")} />
				)}
				{step === "profile" && (
					<ProfileStep onNext={() => setStep("privacy")} />
				)}
				{step === "privacy" && (
					<ScrollView
						contentInsetAdjustmentBehavior="automatic"
						contentContainerClassName="pt-1 pb-4"
						showsVerticalScrollIndicator={false}
					>
						<PrivacySection
							onboarding
							onContinue={() => setStep("preferences")}
						/>
					</ScrollView>
				)}
				{step === "preferences" && (
					<PreferencesStep onNext={() => setStep("services")} />
				)}
				{step === "services" && (
					<ServicesStep onNext={() => setStep("notifications")} />
				)}
				{step === "notifications" && (
					<StepScaffold
						footer={
							<PrimaryButton
								label="Continue"
								onPress={() => setStep("trakt")}
							/>
						}
					>
						<View className="gap-1">
							<Text className="font-bold font-display text-3xl text-foreground">
								Stay up to date
							</Text>
							<Text className="text-muted-foreground text-sm leading-5">
								Choose mobile and email notifications. You can change these in
								Settings anytime.
							</Text>
						</View>
						<View className="rounded-xl border border-border bg-card p-4">
							<NotificationPreferences onboarding />
						</View>
					</StepScaffold>
				)}
				{step === "trakt" && (
					<TraktStep
						onImportStarted={() => setImportStarted(true)}
						onNext={() => setStep("suggestions")}
					/>
				)}
				{step === "suggestions" && (
					<StepScaffold
						footer={
							<PrimaryButton
								label="Continue"
								onPress={() => setStep("watches")}
							/>
						}
					>
						<SuggestionsStep onFollowed={() => setFollowedAnyone(true)} />
					</StepScaffold>
				)}
				{step === "watches" && (
					<WatchedMediaSwipe
						onWatched={() => setWatchesAdded((count) => count + 1)}
						onNext={() => setStep("done")}
					/>
				)}
				{step === "done" && (
					<DoneStep
						followedAnyone={followedAnyone}
						importStarted={importStarted}
						watchesAdded={watchesAdded}
					/>
				)}
			</View>
		</Screen>
	);
}

/* ------------------------------------------------------------------ Welcome */
function WelcomeStep({ onNext }: { onNext: () => void }) {
	return (
		<StepScaffold
			center
			footer={<PrimaryButton label="Get started" onPress={onNext} />}
		>
			<View className="items-center gap-6">
				<Image
					source={logo}
					style={{ borderRadius: 18, height: 72, width: 72 }}
					contentFit="contain"
				/>
				<View className="gap-3">
					<Text className="text-center font-bold font-display text-4xl text-foreground">
						Welcome to Opnshelf
					</Text>
					<Text className="text-center text-base text-muted-foreground leading-6">
						Let’s get you set up in just a few steps. You can import your watch
						history and connect with people already here.
					</Text>
				</View>
			</View>
		</StepScaffold>
	);
}

/* ------------------------------------------------------------------ Profile */
function ProfileStep({ onNext }: { onNext: () => void }) {
	const { user } = useAuth();
	const { updateProfile, uploadAvatar, deleteAvatar, pickAndUploadAvatar } =
		useProfileSetup();
	const [displayName, setDisplayName] = useState(user?.displayName ?? "");

	const isMutating =
		updateProfile.isPending || uploadAvatar.isPending || deleteAvatar.isPending;

	const handleContinue = async () => {
		if (displayName !== (user?.displayName ?? "")) {
			try {
				await updateProfile.mutateAsync({
					body: { displayName: displayName || undefined },
				});
			} catch {
				// Surfaced by the mutation's onError toast.
				return;
			}
		}
		onNext();
	};

	return (
		<StepScaffold
			footer={
				<PrimaryButton
					label={updateProfile.isPending ? "Saving…" : "Continue"}
					onPress={handleContinue}
					loading={updateProfile.isPending}
					disabled={isMutating}
					icon={!updateProfile.isPending}
				/>
			}
		>
			<View className="gap-1">
				<Text className="font-bold font-display text-3xl text-foreground">
					Set up your profile
				</Text>
				<Text className="text-muted-foreground text-sm">
					Customize how you appear on Opnshelf.
				</Text>
			</View>

			<AvatarEditor
				avatarUrl={user?.avatar}
				uploading={uploadAvatar.isPending}
				removing={deleteAvatar.isPending}
				onPick={pickAndUploadAvatar}
				onRemove={() => deleteAvatar.mutate({})}
			/>

			<TextField
				label="Display name"
				value={displayName}
				onChangeText={setDisplayName}
				placeholder="Your display name"
				autoCapitalize="words"
			/>

			<View className="gap-1.5">
				<Text className="font-medium text-foreground text-sm">Handle</Text>
				<View className="rounded-lg border border-border bg-background-subtle px-4 py-3">
					<Text className="text-[16px] text-muted-foreground">
						@{user?.handle ?? ""}
					</Text>
				</View>
				<Text className="text-muted-foreground text-xs">
					Your handle comes from the account you signed in with.
				</Text>
			</View>
		</StepScaffold>
	);
}

/* -------------------------------------------------------------- Preferences */
function PreferencesStep({ onNext }: { onNext: () => void }) {
	const queryClient = useQueryClient();
	const toast = useToast();
	const [country, setCountry] = useState(guessWatchCountry);
	const [timezone, setTimezone] = useState(() => {
		try {
			return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
		} catch {
			return "UTC";
		}
	});
	const { data: settings, isLoading: settingsLoading } = useQuery({
		...usersControllerGetMySettingsOptions(),
	});

	useEffect(() => {
		if (!settings) return;
		// "US" is the column default, so during onboarding it means "never
		// picked" far more often than "picked the US" — keep the device guess.
		if (settings.watchCountry !== "US") setCountry(settings.watchCountry);
		setTimezone(settings.timezone);
	}, [settings]);

	const updateSettings = useMutation({
		mutationKey: ["users", "me", "settings", "update"],
		...usersControllerUpdateMySettingsMutation(),
		// Returned so the step's own onSuccess (which advances) waits for the
		// refetch: the next step reads the settings cache and must see this save.
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: usersControllerGetMySettingsOptions().queryKey,
			}),
		onError: (error) =>
			toast.error(
				error instanceof Error ? error.message : "Failed to save preferences",
			),
	});

	const handleContinue = () => {
		updateSettings.mutate(
			{ body: { watchCountry: country, timezone } },
			{ onSuccess: onNext },
		);
	};

	return (
		<StepScaffold
			footer={
				<PrimaryButton
					label="Continue"
					onPress={handleContinue}
					loading={updateSettings.isPending}
					disabled={settingsLoading}
				/>
			}
		>
			<View className="gap-1">
				<Text className="font-bold font-display text-3xl text-foreground">
					Your preferences
				</Text>
				<Text className="text-muted-foreground text-sm leading-5">
					Choose how watch dates are grouped and where streaming availability is
					shown.
				</Text>
			</View>

			<View className="gap-2">
				<Text className="font-medium text-foreground text-sm">Timezone</Text>
				<TimezonePicker
					value={timezone}
					onChange={setTimezone}
					disabled={settingsLoading || updateSettings.isPending}
				/>
				<Text className="text-muted-foreground text-xs">
					Used to group watches into the correct calendar day.
				</Text>
			</View>

			<View className="gap-2">
				<Text className="font-medium text-foreground text-sm">
					Streaming country
				</Text>
				<CountryPicker
					value={country}
					onChange={setCountry}
					disabled={settingsLoading || updateSettings.isPending}
				/>
				<Text className="text-muted-foreground text-xs">
					You can change these any time in Settings.
				</Text>
			</View>
		</StepScaffold>
	);
}

/* ----------------------------------------------------------------- Services */
const SERVICE_SKELETON_KEYS = Array.from(
	{ length: 12 },
	(_, i) => `service-skeleton-${i + 1}`,
);

function ServicesStep({ onNext }: { onNext: () => void }) {
	const queryClient = useQueryClient();
	const toast = useToast();
	const [selected, setSelected] = useState<number[]>([]);
	const { data: settings, isLoading: settingsLoading } = useQuery({
		...usersControllerGetMySettingsOptions(),
	});

	useEffect(() => {
		if (settings) setSelected(settings.streamingServiceIds);
	}, [settings]);

	const updateSettings = useMutation({
		mutationKey: ["users", "me", "settings", "update"],
		...usersControllerUpdateMySettingsMutation(),
		// Returned so the step's own onSuccess (which advances) waits for the
		// refetch: the next step reads the settings cache and must see this save.
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: usersControllerGetMySettingsOptions().queryKey,
			}),
		onError: (error) =>
			toast.error(
				error instanceof Error ? error.message : "Failed to save your services",
			),
	});

	const handleContinue = () => {
		// Nothing to save when the selection is untouched, and never save over
		// services that failed to load: that would replace them with an empty list.
		if (!settings || sameServices(selected, settings.streamingServiceIds)) {
			onNext();
			return;
		}
		updateSettings.mutate(
			{ body: { streamingServiceIds: selected } },
			{ onSuccess: onNext },
		);
	};

	return (
		<StepScaffold
			footer={
				<PrimaryButton
					label="Continue"
					onPress={handleContinue}
					loading={updateSettings.isPending}
					disabled={settingsLoading}
				/>
			}
		>
			<View className="gap-1">
				<Text className="font-bold font-display text-3xl text-foreground">
					Your services
				</Text>
				<Text className="text-muted-foreground text-sm leading-5">
					Pick the streaming services you pay for, so Up Next and Discover can
					show what you can actually watch.
				</Text>
			</View>

			{settingsLoading ? (
				<View className="flex-row flex-wrap gap-2">
					{SERVICE_SKELETON_KEYS.map((key) => (
						<View
							key={key}
							className="h-[72px] w-[23%] rounded-xl bg-background-subtle"
						/>
					))}
				</View>
			) : (
				<StreamingServicePicker
					country={settings?.watchCountry ?? "US"}
					value={selected}
					onToggle={(id) =>
						setSelected((current) => toggleService(current, id))
					}
					disabled={updateSettings.isPending}
				/>
			)}
			<Text className="text-muted-foreground text-xs">
				You can change these any time in Settings.
			</Text>
		</StepScaffold>
	);
}

/* -------------------------------------------------------------------- Trakt */
function TraktStep({
	onNext,
	onImportStarted,
}: {
	onNext: () => void;
	onImportStarted: () => void;
}) {
	const queryClient = useQueryClient();
	const [importing, setImporting] = useState(false);
	const status = useQuery({
		queryKey: traktStatusKey,
		queryFn: async ({ signal }) =>
			(await traktSyncControllerStatus({ signal, throwOnError: true })).data,
	});
	const refresh = () =>
		queryClient.invalidateQueries({ queryKey: traktStatusKey });
	const connect = useMutation({
		...traktSyncControllerConnectMutation(),
		onSuccess: async (data) => {
			const result = await WebBrowser.openAuthSessionAsync(
				data.url,
				"opnshelf://onboarding",
			);
			if (
				result.type === "success" &&
				new URL(result.url).searchParams.get("connection") === "failed"
			)
				throw new Error("Trakt could not connect. Try connecting again.");
			await refresh();
		},
	});
	const skip = (
		<Pressable onPress={onNext} className="items-center py-3">
			<Text className="font-medium text-base text-muted-foreground">
				Skip for now
			</Text>
		</Pressable>
	);

	if (status.isPending) {
		return (
			<View
				accessibilityLabel="Loading Trakt"
				className="h-96 animate-pulse rounded-2xl bg-card"
			/>
		);
	}

	const data = status.data;
	// Trakt Import stands alone when Trakt Sync is unavailable, or on request.
	if (importing || !data?.configured) {
		return (
			<View className="flex-1">
				<View className="gap-1 pt-1 pb-4">
					<Text className="font-bold font-display text-3xl text-foreground">
						Import from Trakt
					</Text>
					<Text className="text-muted-foreground text-sm">
						Copy your public Trakt history once. Nothing changes on Trakt.
					</Text>
					{importing ? (
						<Pressable
							accessibilityRole="button"
							onPress={() => setImporting(false)}
							className="self-start pt-2"
						>
							<Text className="font-medium text-primary text-sm">
								Connect Trakt instead
							</Text>
						</Pressable>
					) : null}
				</View>
				<TraktImportPanel
					showExistingJob={false}
					onImportStarted={onImportStarted}
					onSkip={onNext}
					onDone={onNext}
				/>
			</View>
		);
	}

	const connected =
		data.status !== "disconnected" && data.status !== "reconnect";
	if (connected) {
		const enabled = data.status === "active" || data.status === "preparing";
		return (
			<StepScaffold
				footer={
					enabled ? <PrimaryButton label="Continue" onPress={onNext} /> : skip
				}
			>
				<View className="gap-1">
					<Text className="font-bold font-display text-3xl text-foreground">
						{enabled ? "Trakt Sync is on" : "Choose what to sync"}
					</Text>
					<Text className="text-muted-foreground text-sm">
						Connected as @{data.username}.{" "}
						{enabled
							? "We’re comparing your history in the background. You can keep going."
							: "Pick what moves and in which direction, then confirm."}
					</Text>
				</View>
				{enabled ? null : (
					<SyncSettings
						key={data.username}
						status={data}
						onSaved={refresh}
						showHeading={false}
					/>
				)}
			</StepScaffold>
		);
	}

	return (
		<StepScaffold footer={skip}>
			<View className="gap-1">
				<Text className="font-bold font-display text-3xl text-foreground">
					Already on Trakt?
				</Text>
				<Text className="text-muted-foreground text-sm">
					Connect once and Opnshelf keeps your history in step with Trakt.
				</Text>
			</View>
			<View className="gap-4 rounded-2xl border border-primary/30 bg-primary/10 p-4">
				<View className="flex-row items-center justify-center gap-3">
					<Image
						source={logo}
						style={{ width: 44, height: 44, borderRadius: 12 }}
					/>
					<ArrowLeftRight color="#f3bc00" size={20} />
					<TraktMark size={44} />
				</View>
				<View className="gap-1.5">
					{[
						"Bring over your Watch history and Ratings",
						"New Watches keep flowing, in the direction you choose",
						"Review every transfer before sync starts",
					].map((line) => (
						<View key={line} className="flex-row gap-2">
							<Check color="#f3bc00" size={16} />
							<Text className="flex-1 text-muted-foreground text-sm leading-5">
								{line}
							</Text>
						</View>
					))}
				</View>
				<Button
					label={
						data.status === "reconnect" ? "Reconnect Trakt" : "Connect Trakt"
					}
					loadingLabel="Opening Trakt…"
					loading={connect.isPending}
					onPress={() =>
						connect.mutate({
							body: { platform: "mobile", returnTo: "onboarding" },
						})
					}
				/>
				{connect.error ? (
					<Text accessibilityRole="alert" className="text-destructive text-sm">
						{traktError(connect.error)}
					</Text>
				) : null}
			</View>
			<Pressable accessibilityRole="button" onPress={() => setImporting(true)}>
				<Text className="text-muted-foreground text-sm">
					Rather not log in?{" "}
					<Text className="text-foreground text-sm underline">
						Import your public history once
					</Text>
				</Text>
			</Pressable>
		</StepScaffold>
	);
}

/* --------------------------------------------------------------------- Done */
function DoneStep({
	importStarted,
	followedAnyone,
	watchesAdded,
}: {
	importStarted: boolean;
	followedAnyone: boolean;
	watchesAdded: number;
}) {
	const queryClient = useQueryClient();
	const { user } = useAuth();
	const toast = useToast();

	const completeOnboarding = useMutation({
		mutationKey: ["auth", "completeOnboarding"],
		mutationFn: async () => {
			const { data } = await usersControllerCompleteOnboarding({
				throwOnError: true,
			});
			return data;
		},
		onSuccess: (data) => {
			posthog?.capture("onboarding_completed", {
				import_started: importStarted,
				followed_anyone: followedAnyone,
				watches_added: watchesAdded,
				platform: "mobile",
			});
			const meKey = authControllerMeQueryKey();
			// Optimistically flip needsOnboarding so the gate lets the user through.
			queryClient.setQueryData(meKey, (old: UserDto | undefined) =>
				old
					? {
							...old,
							onboardingCompletedAt:
								data?.onboardingCompletedAt ?? old.onboardingCompletedAt,
							needsOnboarding: false,
						}
					: old,
			);
			queryClient.invalidateQueries({ queryKey: meKey });
		},
		onError: (error) =>
			toast.error(
				error instanceof Error ? error.message : "Failed to finish onboarding",
			),
	});

	useEffect(() => {
		completeOnboarding.mutate();
	}, [completeOnboarding.mutate]);

	return (
		<View className="flex-1 items-center justify-center gap-6 py-16">
			<View className="size-16 items-center justify-center rounded-full bg-primary/15">
				<CheckCircle2 color="#22c55e" size={34} />
			</View>
			<View className="gap-2">
				<Text className="text-center font-bold font-display text-3xl text-foreground">
					You’re all set!
				</Text>
				<Text className="text-center text-base text-muted-foreground leading-6">
					Welcome to Opnshelf{user?.displayName ? `, ${user.displayName}` : ""}.
					Start tracking what you watch and discover what your friends are into.
				</Text>
			</View>

			{completeOnboarding.isPending ? (
				<View className="flex-row items-center gap-2">
					<ActivityIndicator size="small" color="#94a3b8" />
					<Text className="text-muted-foreground text-sm">Finishing up…</Text>
				</View>
			) : completeOnboarding.isError ? (
				<PrimaryButton
					label="Try again"
					onPress={() => completeOnboarding.mutate()}
					loading={completeOnboarding.isPending}
					icon={false}
				/>
			) : (
				<PrimaryButton
					label="Go to Dashboard"
					onPress={() => router.replace("/")}
				/>
			)}
		</View>
	);
}
