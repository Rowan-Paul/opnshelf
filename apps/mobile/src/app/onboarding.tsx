import {
	authControllerMeQueryKey,
	type UserDto,
	usersControllerCompleteOnboarding,
	usersControllerUpdateMySettingsMutation,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Redirect, router } from "expo-router";
import {
	ArrowRight,
	Camera,
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
import { UserRow } from "@/components/social/UserRow";
import { TraktImportPanel } from "@/components/trakt/TraktImportPanel";
import { CountryPicker } from "@/components/ui/country-picker";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { useProfileSetup } from "@/lib/use-profile";
import { useFollowToggle, useSuggestions } from "@/lib/use-social";

const logo = require("../../assets/images/icon.png");

type OnboardingStep =
	| "welcome"
	| "profile"
	| "preferences"
	| "trakt"
	| "suggestions"
	| "done";

const STEP_SEQUENCE: OnboardingStep[] = [
	"welcome",
	"profile",
	"preferences",
	"trakt",
	"suggestions",
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
		<Pressable
			disabled={isDisabled}
			onPress={onPress}
			className="flex-row items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3.5"
			style={{ opacity: isDisabled ? 0.6 : 1 }}
		>
			{loading ? <ActivityIndicator size="small" color="#3f2e00" /> : null}
			<Text className="font-semibold text-base text-primary-foreground">
				{label}
			</Text>
			{icon && !loading ? <ArrowRight color="#3f2e00" size={18} /> : null}
		</Pressable>
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
	const [step, setStep] = useState<OnboardingStep>("welcome");

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
	if (!isLoading && user && !user.needsOnboarding) {
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
					<ProfileStep onNext={() => setStep("preferences")} />
				)}
				{step === "preferences" && (
					<PreferencesStep onNext={() => setStep("trakt")} />
				)}
				{step === "trakt" && (
					<TraktStep onNext={() => setStep("suggestions")} />
				)}
				{step === "suggestions" && (
					<SuggestionsStep onNext={() => setStep("done")} />
				)}
				{step === "done" && <DoneStep />}
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
						Welcome to OpnShelf
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
	const toast = useToast();
	const { updateProfile, uploadAvatar, deleteAvatar } = useProfileSetup();
	const [displayName, setDisplayName] = useState(user?.displayName ?? "");

	const pickAvatar = async () => {
		const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (!permission.granted) {
			toast.error("Photo access is needed to set a picture.");
			return;
		}
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ["images"],
			allowsEditing: true,
			aspect: [1, 1],
			quality: 0.7,
		});
		const asset = result.canceled ? undefined : result.assets[0];
		if (!asset) return;
		// `allowsEditing` makes the picker hand back a JPEG (the backend rejects
		// the HEIC iOS originals).
		uploadAvatar.mutate({ uri: asset.uri });
	};

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
					Customize how you appear on OpnShelf.
				</Text>
			</View>

			<View className="flex-row items-center gap-4">
				<Pressable
					onPress={pickAvatar}
					disabled={uploadAvatar.isPending}
					className="size-20 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-background-subtle"
				>
					{user?.avatar ? (
						<Image
							source={{ uri: user.avatar }}
							style={{ height: 80, width: 80 }}
							contentFit="cover"
						/>
					) : (
						<Camera color="#94a3b8" size={26} />
					)}
					{uploadAvatar.isPending ? (
						<View className="absolute inset-0 items-center justify-center bg-black/40">
							<ActivityIndicator size="small" color="#ffffff" />
						</View>
					) : null}
				</Pressable>
				<View className="flex-1 gap-1">
					<Text className="font-medium text-foreground text-sm">
						Profile photo
					</Text>
					<Text className="text-muted-foreground text-sm">
						Tap the avatar to choose a photo.
					</Text>
					{user?.avatar ? (
						<Pressable
							onPress={() => deleteAvatar.mutate({})}
							disabled={deleteAvatar.isPending}
						>
							<Text className="font-medium text-destructive text-sm">
								{deleteAvatar.isPending ? "Removing…" : "Remove photo"}
							</Text>
						</Pressable>
					) : null}
				</View>
			</View>

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
					Your handle is managed by your Atmosphere account.
				</Text>
			</View>
		</StepScaffold>
	);
}

/* -------------------------------------------------------------- Preferences */
function PreferencesStep({ onNext }: { onNext: () => void }) {
	const queryClient = useQueryClient();
	const toast = useToast();
	const [country, setCountry] = useState("US");

	const updateSettings = useMutation({
		mutationKey: ["users", "me", "settings", "update"],
		...usersControllerUpdateMySettingsMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["users", "me", "settings"] });
		},
		onError: (error) =>
			toast.error(
				error instanceof Error ? error.message : "Failed to save preferences",
			),
	});

	const handleContinue = () => {
		updateSettings.mutate(
			{ body: { watchCountry: country } },
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
				/>
			}
		>
			<View className="gap-1">
				<Text className="font-bold font-display text-3xl text-foreground">
					Your preferences
				</Text>
				<Text className="text-muted-foreground text-sm leading-5">
					Tell us where you are so we can show streaming availability in your
					country.
				</Text>
			</View>

			<View className="gap-2">
				<Text className="font-medium text-foreground text-sm">
					Streaming country
				</Text>
				<CountryPicker
					value={country}
					onChange={setCountry}
					disabled={updateSettings.isPending}
				/>
				<Text className="text-muted-foreground text-xs">
					You can change this any time in Settings.
				</Text>
			</View>
		</StepScaffold>
	);
}

/* -------------------------------------------------------------------- Trakt */
function TraktStep({ onNext }: { onNext: () => void }) {
	// The panel fills the remaining height and pins its own footer (skip /
	// continue), so the heading stays fixed above it.
	return (
		<View className="flex-1">
			<View className="gap-1 pt-1 pb-4">
				<Text className="font-bold font-display text-3xl text-foreground">
					Import from Trakt
				</Text>
				<Text className="text-muted-foreground text-sm">
					Bring your watch history over from Trakt.tv — or skip and do it later.
				</Text>
			</View>
			<TraktImportPanel
				showExistingJob={false}
				onSkip={onNext}
				onDone={onNext}
			/>
		</View>
	);
}

/* -------------------------------------------------------------- Suggestions */
function SuggestionsStep({ onNext }: { onNext: () => void }) {
	const { user } = useAuth();
	const { data, isLoading } = useSuggestions();
	const { toggle } = useFollowToggle();
	const suggestions = data?.items ?? [];

	return (
		<StepScaffold footer={<PrimaryButton label="Continue" onPress={onNext} />}>
			<View className="gap-1">
				<Text className="font-bold font-display text-3xl text-foreground">
					People to follow
				</Text>
				<Text className="text-muted-foreground text-sm">
					Find people you know on OpnShelf.
				</Text>
			</View>

			{isLoading ? (
				<View className="py-8">
					<ActivityIndicator color="#94a3b8" />
				</View>
			) : suggestions.length === 0 ? (
				<Text className="py-8 text-center text-muted-foreground text-sm">
					No suggestions right now.
				</Text>
			) : (
				<View className="gap-2">
					{suggestions.map((person) => (
						<UserRow
							key={person.did}
							user={person}
							isSelf={person.did === user?.did}
							onToggleFollow={toggle}
						/>
					))}
				</View>
			)}
		</StepScaffold>
	);
}

/* --------------------------------------------------------------------- Done */
function DoneStep() {
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
			router.replace("/");
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
					Welcome to OpnShelf{user?.displayName ? `, ${user.displayName}` : ""}.
					Start tracking what you watch.
				</Text>
			</View>

			{completeOnboarding.isError ? (
				<PrimaryButton
					label="Try again"
					onPress={() => completeOnboarding.mutate()}
					loading={completeOnboarding.isPending}
					icon={false}
				/>
			) : (
				<View className="flex-row items-center gap-2">
					<ActivityIndicator size="small" color="#94a3b8" />
					<Text className="text-muted-foreground text-sm">Finishing up…</Text>
				</View>
			)}
		</View>
	);
}
