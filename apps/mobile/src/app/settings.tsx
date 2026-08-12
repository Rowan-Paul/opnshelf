import {
	authControllerPermissionsMutation,
	getAccountDeletionProgress,
	getAccountDeletionStatusMessage,
	isActiveTraktImportStatus,
	reviewsControllerListMyPublicationsOptions,
	type TraktImportJobDto,
	usersControllerDeleteMyAccountMutation,
	usersControllerGetMyAccountDeletionOptions,
	usersControllerGetMyCurrentTraktImportOptions,
	usersControllerGetMySettingsOptions,
	usersControllerUpdateMySettingsMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { nativeApplicationVersion } from "expo-application";
import { Link, Stack } from "expo-router";
import * as Updates from "expo-updates";
import {
	AlertTriangle,
	ChevronRight,
	Compass,
	Download,
	MessageSquare,
	Smartphone,
	Trash2,
	UserPen,
} from "lucide-react-native";
import { useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	Switch,
	View,
} from "react-native";
import { IntegrationPermissionRow } from "@/components/settings/integration-permission-row";
import { TimezonePicker } from "@/components/settings/TimezonePicker";
import { replayWelcomeTour } from "@/components/tour/WelcomeTour";
import { CountryPicker } from "@/components/ui/country-picker";
import { useDialog } from "@/components/ui/dialog";
import { Screen } from "@/components/ui/screen";
import { ListRowsSkeleton } from "@/components/ui/skeletons";
import { ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { useFeedback } from "@/lib/feedback";
import type { ThemePreference } from "@/lib/theme-context";
import { useTheme } from "@/lib/theme-context";
import {
	isAccountDeletionRunning,
	useAccountDeletionJob,
} from "@/lib/use-account-deletion";

/** Amber primary used for active switches + selected radios. */
const PRIMARY = "#f3bc00";

/** Section card wrapper, matching the web settings `card` sections. */
function SettingsSection({
	title,
	description,
	icon,
	children,
}: {
	title: string;
	description?: string;
	icon?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<View className="gap-4 rounded-xl border border-border bg-card p-4">
			<View className="gap-1">
				<View className="flex-row items-center gap-2">
					{icon}
					<Text className="font-display font-semibold text-foreground text-lg">
						{title}
					</Text>
				</View>
				{description ? (
					<Text className="text-muted-foreground text-sm leading-5">
						{description}
					</Text>
				) : null}
			</View>
			{children}
		</View>
	);
}

/** "v1.0.0 · update 019f40cf · Jul 8, 2026" once an OTA update is running, or
 * "v1.0.0 · embedded" for the build's own bundle (also what dev/Expo Go shows,
 * since `Updates.isEnabled` is false there). */
function formatVersionLine(): string {
	const version = nativeApplicationVersion ?? "?";
	if (!Updates.isEnabled || !Updates.updateId) {
		return `v${version} · embedded`;
	}
	const shortId = Updates.updateId.slice(0, 8);
	const date = Updates.createdAt
		? Updates.createdAt.toLocaleDateString(undefined, {
				month: "short",
				day: "numeric",
				year: "numeric",
			})
		: null;
	return `v${version} · update ${shortId}${date ? ` · ${date}` : ""}`;
}

const APPEARANCE_OPTIONS: { value: ThemePreference; label: string }[] = [
	{ value: "system", label: "System" },
	{ value: "light", label: "Light" },
	{ value: "dark", label: "Dark" },
];

/** Segmented pill row to pick the app appearance preference. */
function AppearanceSetting() {
	const { preference, setPreference } = useTheme();
	return (
		<View className="flex-row gap-2">
			{APPEARANCE_OPTIONS.map((option) => {
				const selected = preference === option.value;
				return (
					<Pressable
						key={option.value}
						onPress={() => setPreference(option.value)}
						className={
							selected
								? "flex-1 items-center rounded-lg border border-primary bg-primary/10 px-3 py-2.5"
								: "flex-1 items-center rounded-lg border border-border px-3 py-2.5"
						}
					>
						<Text
							className={
								selected
									? "font-semibold text-primary text-sm"
									: "font-medium text-foreground text-sm"
							}
						>
							{option.label}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

export default function SettingsScreen() {
	const { showDialog } = useDialog();
	const { user, signOut, runAuthorizationUrl } = useAuth();
	const { open: openFeedback } = useFeedback();
	const toast = useToast();
	const queryClient = useQueryClient();
	const [isSigningOut, setIsSigningOut] = useState(false);

	const handleSignOut = async () => {
		if (isSigningOut) {
			return;
		}
		setIsSigningOut(true);
		try {
			await signOut();
		} finally {
			setIsSigningOut(false);
		}
	};

	// Settings (timezone / time format / watch country / reviews target). Same
	// query the web settings page reads.
	const {
		data: settings,
		isLoading: settingsLoading,
		isError: settingsError,
	} = useQuery({
		...usersControllerGetMySettingsOptions(),
		enabled: !!user,
	});
	const { data: traktJob } = useQuery({
		...usersControllerGetMyCurrentTraktImportOptions(),
		enabled: !!user,
	});

	const updateSettingsMutation = useMutation({
		mutationKey: ["users", "me", "settings", "update"],
		...usersControllerUpdateMySettingsMutation(),
		onSuccess: () => {
			toast.success("Settings updated");
			queryClient.invalidateQueries({
				queryKey: usersControllerGetMySettingsOptions().queryKey,
			});
		},
		onError: (error) =>
			toast.error(
				error instanceof Error ? error.message : "Failed to update settings",
			),
	});

	const permissionChangeMutation = useMutation({
		mutationKey: ["auth", "permissions", "change"],
		...authControllerPermissionsMutation(),
		onSuccess: async (result) => {
			await runAuthorizationUrl(result.authorizationUrl);
		},
		onError: (error) =>
			toast.error(
				error instanceof Error
					? error.message
					: "Could not start the permission change",
			),
	});

	const requestPermissionChange = (
		integration: "blog" | "bluesky",
		action: "connect" | "disconnect",
	) => {
		permissionChangeMutation.mutate({
			body: { integration, action, platform: "mobile" },
		});
	};

	// Blog-mirror publication (#118). Reviews are opnshelf-owned records; a
	// publication here is an *optional* blog to also mirror new reviews to. The
	// live picker — not the cached setting — is the source of truth at selection
	// time; the user can only pick a publication that exists in their own PDS.
	const {
		data: myPublications,
		isLoading: publicationsLoading,
		isError: publicationsError,
	} = useQuery({
		...reviewsControllerListMyPublicationsOptions(),
		enabled: !!user,
	});

	const storedPublicationUri = settings?.reviewsPublicationUri ?? null;

	const confirmPublicationService = (publication: {
		uri: string;
		name: string;
		url: string;
		service: "leaflet" | "offprint" | "pckt" | "unknown";
	}) => {
		const continueWithCompatibilityMode = () => {
			showDialog({
				title: "Choose the publication service",
				description:
					"If it isn't listed, we'll still mirror your reviews, but they may not display as expected.",
				actions: [
					{ label: "Cancel" },
					{
						label: "Leaflet",
						onPress: () =>
							updateSettingsMutation.mutate({
								body: {
									reviewsPublicationUri: publication.uri,
									reviewsMirrorFormat: "leaflet",
								},
							}),
					},
					{
						label: "Offprint",
						onPress: () =>
							updateSettingsMutation.mutate({
								body: {
									reviewsPublicationUri: publication.uri,
									reviewsMirrorFormat: "offprint",
								},
							}),
					},
					{
						label: "Pckt",
						onPress: () =>
							updateSettingsMutation.mutate({
								body: {
									reviewsPublicationUri: publication.uri,
									reviewsMirrorFormat: "pckt",
								},
							}),
					},
					{
						label: "Other or unknown",
						onPress: () =>
							updateSettingsMutation.mutate({
								body: {
									reviewsPublicationUri: publication.uri,
									reviewsMirrorFormat: "markdown",
								},
							}),
					},
				],
			});
		};

		if (publication.service === "unknown") {
			continueWithCompatibilityMode();
			return;
		}
		const mirrorFormat = publication.service;

		const serviceName =
			mirrorFormat === "leaflet"
				? "Leaflet"
				: mirrorFormat === "offprint"
					? "Offprint"
					: "Pckt";

		showDialog({
			title: `Is this a ${serviceName} publication?`,
			description: `We recognised ${publication.name} as ${serviceName}. Confirm to mirror your reviews there.`,
			actions: [
				{ label: "Cancel" },
				{
					label: `No, it isn't ${serviceName}`,
					onPress: continueWithCompatibilityMode,
				},
				{
					label: `Yes, this is ${serviceName}`,
					onPress: () =>
						updateSettingsMutation.mutate({
							body: {
								reviewsPublicationUri: publication.uri,
								reviewsMirrorFormat: mirrorFormat,
							},
						}),
				},
			],
		});
	};

	// D7 soft warning: the stored target is no longer present in the live list.
	const storedTargetMissing =
		storedPublicationUri !== null &&
		!publicationsLoading &&
		!publicationsError &&
		!myPublications?.items.some((pub) => pub.uri === storedPublicationUri);

	// Account deletion. The job itself lives on the server and is polled by
	// `useAccountDeletionJob` (also mounted at the app root, which renders the
	// blocking overlay), so it survives an app restart.
	const deletionJob = useAccountDeletionJob();

	const deleteAccountMutation = useMutation({
		mutationKey: ["users", "me", "account", "delete"],
		...usersControllerDeleteMyAccountMutation(),
		onError: (error) =>
			toast.error(
				error instanceof Error ? error.message : "Failed to delete account",
			),
	});

	const runDeletion = async (deletePDSData: boolean) => {
		try {
			await deleteAccountMutation.mutateAsync({ body: { deletePDSData } });
			if (!deletePDSData) {
				// Immediate deletion, no job returned (204).
				await signOut();
				return;
			}
			// PDS deletion job started — let the shared query pick it up.
			await queryClient.invalidateQueries({
				queryKey: usersControllerGetMyAccountDeletionOptions().queryKey,
			});
		} catch {
			// Surfaced by the mutation's onError toast.
		}
	};

	// Two-step destructive confirmation mirroring the web dialog: first confirm
	// the irreversible delete, then ask whether to also wipe PDS data.
	const confirmDeleteAccount = () => {
		showDialog({
			title: "Delete your account?",
			description:
				"This action cannot be undone. All your data will be permanently removed.",
			actions: [
				{ label: "Cancel" },
				{
					label: "Continue",
					variant: "destructive",
					onPress: () => {
						showDialog({
							title: "Also delete PDS data?",
							description:
								"Delete your Opnshelf data from your PDS too, including watch history, follows, lists, and list items?",
							actions: [
								{ label: "Cancel" },
								{
									label: "Keep PDS data",
									onPress: () => void runDeletion(false),
								},
								{
									label: "Delete everything",
									variant: "destructive",
									onPress: () => void runDeletion(true),
								},
							],
						});
					},
				},
			],
		});
	};

	const isDeleting = isAccountDeletionRunning(deletionJob);
	const deletionProgress = deletionJob
		? getAccountDeletionProgress(deletionJob)
		: null;
	const deletionMessage = deletionJob
		? getAccountDeletionStatusMessage(deletionJob)
		: "";

	const settingsBusy = updateSettingsMutation.isPending;

	return (
		<>
			<Stack.Screen
				options={{
					title: "Settings",
					// While a PDS deletion job runs, lock the user on this screen:
					// hide the back button and disable the iOS swipe-back gesture.
					headerBackVisible: !isDeleting,
					gestureEnabled: !isDeleting,
				}}
			/>
			<Screen topInset={false}>
				<ScrollView
					className="flex-1"
					contentContainerClassName="gap-6 py-6"
					showsVerticalScrollIndicator={false}
				>
					{user && (
						<View className="gap-1">
							<Text className="font-semibold text-foreground text-lg">
								{user.displayName ?? user.handle}
							</Text>
							<Text className="text-muted-foreground text-sm">
								@{user.handle}
							</Text>
						</View>
					)}

					{/* Profile */}
					<View className="gap-3 rounded-xl border border-border bg-card p-4">
						<Text className="font-display font-semibold text-foreground text-lg">
							Profile
						</Text>
						<Link href="/edit-profile" asChild>
							<Pressable className="flex-row items-center gap-3 rounded-lg border border-border bg-background-subtle p-3">
								<UserPen color="#94a3b8" size={20} />
								<Text className="flex-1 font-medium text-foreground">
									Edit profile
								</Text>
								<ChevronRight color="#94a3b8" size={18} />
							</Pressable>
						</Link>
						<Link href="/devices" asChild>
							<Pressable className="flex-row items-center gap-3 rounded-lg border border-border bg-background-subtle p-3">
								<Smartphone color="#94a3b8" size={20} />
								<Text className="flex-1 font-medium text-foreground">
									Devices
								</Text>
								<ChevronRight color="#94a3b8" size={18} />
							</Pressable>
						</Link>
					</View>

					{/* Welcome tour */}
					<View className="gap-3 rounded-xl border border-border bg-card p-4">
						<Text className="font-display font-semibold text-foreground text-lg">
							Welcome tour
						</Text>
						<Pressable
							onPress={replayWelcomeTour}
							className="flex-row items-center gap-3 rounded-lg border border-border bg-background-subtle p-3"
						>
							<Compass color="#94a3b8" size={20} />
							<Text className="flex-1 font-medium text-foreground">
								Take the tour again
							</Text>
							<ChevronRight color="#94a3b8" size={18} />
						</Pressable>
					</View>

					{/* Appearance */}
					<SettingsSection
						title="Appearance"
						description="Choose how Opnshelf looks. System follows your device."
					>
						<AppearanceSetting />
					</SettingsSection>

					{/* Time & Region */}
					<SettingsSection
						title="Time & Region"
						description="Choose how dates and times are displayed."
					>
						{settingsLoading ? (
							<View className="gap-5">
								<View className="gap-2">
									<View className="h-3.5 w-20 rounded bg-background-subtle" />
									<View className="h-11 w-full rounded-lg bg-background-subtle" />
								</View>
								<View className="flex-row items-center justify-between">
									<View className="gap-2">
										<View className="h-3.5 w-28 rounded bg-background-subtle" />
										<View className="h-2.5 w-40 rounded bg-background-subtle" />
									</View>
									<View className="h-6 w-11 rounded-full bg-background-subtle" />
								</View>
							</View>
						) : settingsError ? (
							<ErrorState message="Could not load your settings." />
						) : (
							<View className="gap-5">
								<View className="gap-2">
									<Text className="font-medium text-foreground text-sm">
										Timezone
									</Text>
									<TimezonePicker
										value={settings?.timezone}
										onChange={(timezone) =>
											updateSettingsMutation.mutate({ body: { timezone } })
										}
										disabled={settingsBusy}
									/>
								</View>

								<View className="flex-row items-center justify-between">
									<View className="flex-1 pr-4">
										<Text className="font-medium text-foreground text-sm">
											24-hour time
										</Text>
										<Text className="text-muted-foreground text-sm">
											Display times in 24-hour format
										</Text>
									</View>
									<Switch
										value={settings?.timeFormat === "24h"}
										onValueChange={(checked) =>
											updateSettingsMutation.mutate({
												body: { timeFormat: checked ? "24h" : "12h" },
											})
										}
										disabled={settingsBusy}
										trackColor={{ false: "#3f3f46", true: PRIMARY }}
										thumbColor="#ffffff"
									/>
								</View>
							</View>
						)}
					</SettingsSection>

					{/* Streaming country */}
					<SettingsSection
						title="Streaming"
						description="Choose your country to see where movies and shows are available to watch."
					>
						{settingsLoading ? (
							<View className="gap-2">
								<View className="h-3.5 w-16 rounded bg-background-subtle" />
								<View className="h-11 w-full rounded-lg bg-background-subtle" />
							</View>
						) : settingsError ? (
							<ErrorState message="Could not load your settings." />
						) : (
							<View className="gap-2">
								<Text className="font-medium text-foreground text-sm">
									Country
								</Text>
								<CountryPicker
									value={settings?.watchCountry ?? "US"}
									onChange={(watchCountry) =>
										updateSettingsMutation.mutate({ body: { watchCountry } })
									}
									disabled={settingsBusy}
								/>
							</View>
						)}
					</SettingsSection>

					{/* Reviews */}
					<SettingsSection
						title="Reviews"
						description="Control how Spoiler Shields behave on reviews."
					>
						{settingsLoading ? (
							<View className="flex-row items-center justify-between">
								<View className="gap-2">
									<View className="h-3.5 w-40 rounded bg-background-subtle" />
									<View className="h-2.5 w-52 rounded bg-background-subtle" />
								</View>
								<View className="h-6 w-11 rounded-full bg-background-subtle" />
							</View>
						) : settingsError ? (
							<ErrorState message="Could not load your settings." />
						) : (
							<View className="flex-row items-center justify-between">
								<View className="flex-1 pr-4">
									<Text className="font-medium text-foreground text-sm">
										Always show spoiler content
									</Text>
									<Text className="text-muted-foreground text-sm">
										Skip the spoiler covers on reviews
									</Text>
								</View>
								<Switch
									value={settings?.alwaysShowSpoilers ?? false}
									onValueChange={(checked) =>
										updateSettingsMutation.mutate({
											body: { alwaysShowSpoilers: checked },
										})
									}
									disabled={settingsBusy}
									trackColor={{ false: "#3f3f46", true: PRIMARY }}
									thumbColor="#ffffff"
								/>
							</View>
						)}
					</SettingsSection>

					{/* Blog mirror */}
					<SettingsSection
						title="Blog mirror"
						description="Your reviews always live on Opnshelf. Optionally also mirror new reviews to one of your own AT Protocol blog publications."
					>
						<IntegrationPermissionRow
							name="Blog mirroring"
							description={
								storedPublicationUri
									? "Allow Opnshelf to publish and update Review mirrors in the selected publication."
									: "Choose a publication below before connecting Blog mirroring."
							}
							connected={settings?.blogIntegrationEnabled ?? false}
							disabled={
								permissionChangeMutation.isPending ||
								(!(settings?.blogIntegrationEnabled ?? false) &&
									!storedPublicationUri)
							}
							onConfirm={(action) => requestPermissionChange("blog", action)}
						/>

						{storedTargetMissing && (
							<View className="flex-row items-start gap-2 rounded-lg border border-primary/40 bg-primary/10 p-3">
								<AlertTriangle color={PRIMARY} size={16} />
								<Text className="flex-1 text-foreground text-sm leading-5">
									The blog you selected is no longer in your PDS. New reviews
									still mirror to it, but you may want to choose another below.
								</Text>
							</View>
						)}

						{publicationsLoading ? (
							<ListRowsSkeleton rows={2} />
						) : publicationsError ? (
							<Text className="text-muted-foreground text-sm">
								Could not load your publications right now.
							</Text>
						) : (
							<View className="gap-2">
								{(myPublications?.items ?? []).map((pub) => {
									const checked = storedPublicationUri === pub.uri;
									return (
										<Pressable
											key={pub.uri}
											disabled={settingsBusy}
											onPress={() => confirmPublicationService(pub)}
											className={
												checked
													? "flex-row items-center gap-3 rounded-lg border border-primary bg-primary/10 p-3"
													: "flex-row items-center gap-3 rounded-lg border border-border p-3"
											}
											style={{ opacity: settingsBusy ? 0.6 : 1 }}
										>
											<View
												className={
													checked
														? "size-5 items-center justify-center rounded-full border-2 border-primary"
														: "size-5 items-center justify-center rounded-full border-2 border-border"
												}
											>
												{checked ? (
													<View className="size-2.5 rounded-full bg-primary" />
												) : null}
											</View>
											<View className="flex-1">
												<Text
													className="font-medium text-foreground text-sm"
													numberOfLines={1}
												>
													{pub.name}
												</Text>
												<Text
													className="text-muted-foreground text-xs"
													numberOfLines={1}
												>
													{pub.url}
												</Text>
											</View>
										</Pressable>
									);
								})}
								<Text className="pt-1 text-muted-foreground text-xs leading-5">
									Disconnect above to stop mirroring. Your publication choice
									stays saved for reconnection.
								</Text>
							</View>
						)}
					</SettingsSection>

					<SettingsSection
						title="Bluesky Cross-posts"
						description="Connect once, then choose which Reviews should also appear on Bluesky when you publish them."
					>
						<IntegrationPermissionRow
							name="Bluesky Cross-posts"
							description="Allow Opnshelf to post to Bluesky for Reviews you explicitly select."
							connected={settings?.blueskyCrossPostEnabled ?? false}
							disabled={permissionChangeMutation.isPending}
							onConfirm={(action) => requestPermissionChange("bluesky", action)}
						/>
					</SettingsSection>

					{/* Import history */}
					<View className="gap-3 rounded-xl border border-border bg-card p-4">
						<Text className="font-display font-semibold text-foreground text-lg">
							Import history
						</Text>
						<Link href="/trakt-import" asChild>
							<Pressable className="flex-row items-center gap-3 rounded-lg border border-border bg-background-subtle p-3">
								<Download color="#94a3b8" size={20} />
								<Text className="flex-1 font-medium text-foreground">
									{getTraktSettingsLabel(traktJob)}
								</Text>
								<ChevronRight color="#94a3b8" size={18} />
							</Pressable>
						</Link>
					</View>

					{/* Feedback */}
					<View className="gap-3 rounded-xl border border-border bg-card p-4">
						<Text className="font-display font-semibold text-foreground text-lg">
							Feedback
						</Text>
						<Pressable
							onPress={openFeedback}
							className="flex-row items-center gap-3 rounded-lg border border-border bg-background-subtle p-3"
						>
							<MessageSquare color="#94a3b8" size={20} />
							<Text className="flex-1 font-medium text-foreground">
								Report a bug or send feedback
							</Text>
							<ChevronRight color="#94a3b8" size={18} />
						</Pressable>
						<Text className="text-muted-foreground text-xs leading-5">
							Tip: shake your phone anywhere in the app to send feedback.
						</Text>
					</View>

					{/* Danger zone */}
					<View className="gap-4 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
						<View className="gap-1">
							<Text className="font-display font-semibold text-destructive text-lg">
								Danger Zone
							</Text>
							<Text className="text-destructive/80 text-sm leading-5">
								Permanently delete your account and all associated data.
							</Text>
						</View>

						{isDeleting && deletionJob ? (
							<View className="gap-3">
								<View className="flex-row items-center gap-2">
									<ActivityIndicator size="small" color="#ef4444" />
									<Text className="flex-1 font-medium text-destructive text-sm">
										{deletionMessage}
									</Text>
								</View>
								{deletionProgress !== null && (
									<View className="h-2 w-full overflow-hidden rounded-full bg-destructive/20">
										<View
											className="h-full rounded-full bg-destructive"
											style={{ width: `${deletionProgress}%` }}
										/>
									</View>
								)}
							</View>
						) : deletionJob?.status === "failed" ? (
							<View className="gap-3">
								<Text className="text-destructive text-sm">
									{deletionJob.lastError ?? "Account deletion failed."}
								</Text>
								<Pressable
									onPress={confirmDeleteAccount}
									disabled={deleteAccountMutation.isPending}
									className="flex-row items-center justify-center gap-2 rounded-lg border border-destructive px-4 py-3"
									style={{ opacity: deleteAccountMutation.isPending ? 0.6 : 1 }}
								>
									{deleteAccountMutation.isPending && (
										<ActivityIndicator size="small" color="#ef4444" />
									)}
									<Text className="font-semibold text-base text-destructive">
										Retry
									</Text>
								</Pressable>
							</View>
						) : (
							<Pressable
								onPress={confirmDeleteAccount}
								disabled={deleteAccountMutation.isPending}
								className="flex-row items-center justify-center gap-2 rounded-lg border border-destructive px-4 py-3"
								style={{ opacity: deleteAccountMutation.isPending ? 0.6 : 1 }}
							>
								{deleteAccountMutation.isPending ? (
									<ActivityIndicator size="small" color="#ef4444" />
								) : (
									<Trash2 color="#ef4444" size={18} />
								)}
								<Text className="font-semibold text-base text-destructive">
									Delete Account
								</Text>
							</Pressable>
						)}
					</View>

					{/* Sign out — reversible, so a neutral outline; red stays reserved
					    for the irreversible Delete Account above. */}
					<Pressable
						disabled={isSigningOut}
						onPress={handleSignOut}
						className="flex-row items-center justify-center gap-2 rounded-lg border border-border px-4 py-3"
						style={{ opacity: isSigningOut ? 0.7 : 1 }}
					>
						{isSigningOut && <ActivityIndicator size="small" color="#94a3b8" />}
						<Text className="font-semibold text-base text-foreground">
							Sign out
						</Text>
					</Pressable>

					<Text className="text-center text-muted-foreground text-xs">
						{formatVersionLine()}
					</Text>
				</ScrollView>
			</Screen>
			{/* The blocking overlay during PDS deletion lives at the app root
			    (AccountDeletionGate), so it also shows after an app restart. */}
		</>
	);
}

function getTraktSettingsLabel(job: TraktImportJobDto | null | undefined) {
	if (!job) return "Import from Trakt";
	if (isActiveTraktImportStatus(job.status)) {
		return "Trakt import in progress";
	}
	if (job.status === "paused" || job.status === "failed")
		return "Resume Trakt import";
	if (job.unmatchedGroups.length > 0) {
		return `Match ${job.unmatchedGroups.length} ${job.unmatchedGroups.length === 1 ? "title" : "titles"}`;
	}
	return "View Trakt import";
}
