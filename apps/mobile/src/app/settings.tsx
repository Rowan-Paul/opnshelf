import {
	type AccountDeletionJobDto,
	getAccountDeletionProgress,
	getAccountDeletionStatusMessage,
	isActiveAccountDeletionStatus,
	reviewsControllerListMyPublicationsOptions,
	reviewsControllerRepointReviewsMutation,
	usersControllerDeleteMyAccountMutation,
	usersControllerGetMyAccountDeletionOptions,
	usersControllerGetMySettingsOptions,
	usersControllerUpdateMySettingsMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Stack } from "expo-router";
import {
	AlertTriangle,
	BookOpen,
	ChevronRight,
	Download,
	Palette,
	Trash2,
	UserPen,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Modal,
	Pressable,
	ScrollView,
	Switch,
	View,
} from "react-native";
import { TimezonePicker } from "@/components/settings/TimezonePicker";
import { CountryPicker } from "@/components/ui/country-picker";
import { Screen } from "@/components/ui/screen";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import type { ThemePreference } from "@/lib/theme-context";
import { useTheme } from "@/lib/theme-context";

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
	const { user, signOut } = useAuth();
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

	// Reviews publication (#118). The live picker — not the cached setting — is the
	// source of truth at selection time; the user can only pick a publication that
	// exists in their own PDS.
	const {
		data: myPublications,
		isLoading: publicationsLoading,
		isError: publicationsError,
	} = useQuery({
		...reviewsControllerListMyPublicationsOptions(),
		enabled: !!user,
	});

	const storedPublicationUri = settings?.reviewsPublicationUri ?? null;

	function findDefaultPublicationUri(): string | null {
		return (
			myPublications?.items.find((pub) => pub.isOpnshelfDefault)?.uri ?? null
		);
	}

	const repointReviewsMutation = useMutation({
		mutationKey: ["reviews", "repoint"],
		...reviewsControllerRepointReviewsMutation(),
		onSuccess: (result) => {
			if (result.failed > 0) {
				toast.error(
					`Moved ${result.moved} of ${result.total} reviews. ${result.failed} failed — try again.`,
				);
			} else {
				toast.success(
					result.total === 0
						? "No reviews to move"
						: `Moved ${result.moved} review${result.moved === 1 ? "" : "s"}`,
				);
			}
		},
		onError: (error) =>
			toast.error(
				error instanceof Error ? error.message : "Failed to move reviews",
			),
	});

	// After a target change, offer (opt-in) to re-point already-published reviews.
	// Re-pointing needs a concrete target URI; when none is known (no opnshelf
	// default in the live list) there is nothing to move to, so skip the prompt.
	const promptRepoint = (targetUri: string | null) => {
		if (targetUri === null) {
			return;
		}
		Alert.alert(
			"Move existing reviews?",
			"Also move your existing reviews to this publication?",
			[
				{ text: "Not now", style: "cancel" },
				{
					text: "Move reviews",
					onPress: () =>
						repointReviewsMutation.mutate({
							body: { targetPublicationUri: targetUri },
						}),
				},
			],
		);
	};

	const handleSelectPublication = (uri: string | null) => {
		if (uri === storedPublicationUri) {
			return;
		}
		updateSettingsMutation.mutate(
			{ body: { reviewsPublicationUri: uri } },
			{
				onSuccess: () => {
					promptRepoint(uri ?? findDefaultPublicationUri());
				},
			},
		);
	};

	// D7 soft warning: the stored target is no longer present in the live list.
	const storedTargetMissing =
		storedPublicationUri !== null &&
		!publicationsLoading &&
		!publicationsError &&
		!myPublications?.items.some((pub) => pub.uri === storedPublicationUri);

	// Account deletion.
	const [deletionJob, setDeletionJob] = useState<AccountDeletionJobDto | null>(
		null,
	);

	const deleteAccountMutation = useMutation({
		mutationKey: ["users", "me", "account", "delete"],
		...usersControllerDeleteMyAccountMutation(),
		onError: (error) =>
			toast.error(
				error instanceof Error ? error.message : "Failed to delete account",
			),
	});

	// Poll deletion status while a PDS-removal job is active.
	const { data: deletionStatus } = useQuery({
		...usersControllerGetMyAccountDeletionOptions(),
		enabled: !!deletionJob && isActiveAccountDeletionStatus(deletionJob.status),
		refetchInterval: 2000,
	});

	useEffect(() => {
		if (deletionStatus) {
			setDeletionJob(deletionStatus);
			if (deletionStatus.status === "completed") {
				void signOut();
			}
		}
	}, [deletionStatus, signOut]);

	const runDeletion = async (deletePDSData: boolean) => {
		try {
			const result = await deleteAccountMutation.mutateAsync({
				body: { deletePDSData },
			});
			if (!deletePDSData) {
				// Immediate deletion, no job returned (204).
				await signOut();
				return;
			}
			// PDS deletion job started — poll for progress.
			if (result) {
				setDeletionJob(result);
			}
		} catch {
			// Surfaced by the mutation's onError toast.
		}
	};

	// Two-step destructive confirmation mirroring the web dialog: first confirm
	// the irreversible delete, then ask whether to also wipe PDS data.
	const confirmDeleteAccount = () => {
		Alert.alert(
			"Delete your account?",
			"This action cannot be undone. All your data will be permanently removed.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Continue",
					style: "destructive",
					onPress: () => {
						Alert.alert(
							"Also delete PDS data?",
							"Delete your OpnShelf data from your PDS too, including watch history, follows, lists, and list items?",
							[
								{ text: "Cancel", style: "cancel" },
								{
									text: "Keep PDS data",
									onPress: () => void runDeletion(false),
								},
								{
									text: "Delete everything",
									style: "destructive",
									onPress: () => void runDeletion(true),
								},
							],
						);
					},
				},
			],
		);
	};

	const isDeleting =
		!!deletionJob && isActiveAccountDeletionStatus(deletionJob.status);
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
								<UserPen color={PRIMARY} size={20} />
								<Text className="flex-1 font-medium text-foreground">
									Edit profile
								</Text>
								<ChevronRight color="#94a3b8" size={18} />
							</Pressable>
						</Link>
					</View>

					{/* Appearance */}
					<SettingsSection
						title="Appearance"
						icon={<Palette color={PRIMARY} size={20} />}
						description="Choose how OpnShelf looks. System follows your device."
					>
						<AppearanceSetting />
					</SettingsSection>

					{/* Time & Region */}
					<SettingsSection
						title="Time & Region"
						description="Choose how dates and times are displayed."
					>
						{settingsLoading ? (
							<LoadingState />
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
							<LoadingState />
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

					{/* Reviews publication */}
					<SettingsSection
						title="Reviews publication"
						icon={<BookOpen color={PRIMARY} size={20} />}
						description={`Choose which of your own AT Protocol publications new reviews are published to. OpnShelf still renders them at opnshelf.xyz/@${user?.handle ?? ""}.`}
					>
						{storedTargetMissing && (
							<View className="flex-row items-start gap-2 rounded-lg border border-primary/40 bg-primary/10 p-3">
								<AlertTriangle color={PRIMARY} size={16} />
								<Text className="flex-1 text-foreground text-sm leading-5">
									Your selected publication is no longer in your PDS. New
									reviews still point at it, but you may want to choose another
									below.
								</Text>
							</View>
						)}

						{publicationsLoading ? (
							<LoadingState />
						) : publicationsError ? (
							<Text className="text-muted-foreground text-sm">
								Could not load your publications right now.
							</Text>
						) : (
							<View className="gap-2">
								{(myPublications?.items ?? []).map((pub) => {
									const checked = pub.isOpnshelfDefault
										? storedPublicationUri === null ||
											storedPublicationUri === pub.uri
										: storedPublicationUri === pub.uri;
									return (
										<Pressable
											key={pub.uri}
											disabled={settingsBusy}
											onPress={() =>
												handleSelectPublication(
													pub.isOpnshelfDefault ? null : pub.uri,
												)
											}
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
												<View className="flex-row items-center gap-2">
													<Text
														className="shrink font-medium text-foreground text-sm"
														numberOfLines={1}
													>
														{pub.name}
													</Text>
													{pub.isOpnshelfDefault ? (
														<View className="shrink-0 rounded-full bg-primary/20 px-2 py-0.5">
															<Text className="font-medium text-primary text-xs">
																Default
															</Text>
														</View>
													) : null}
												</View>
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
							</View>
						)}
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
									Import from Trakt
								</Text>
								<ChevronRight color="#94a3b8" size={18} />
							</Pressable>
						</Link>
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

					{/* Sign out */}
					<Pressable
						disabled={isSigningOut}
						onPress={handleSignOut}
						className="flex-row items-center justify-center gap-2 rounded-lg border border-destructive px-4 py-3"
						style={{ opacity: isSigningOut ? 0.7 : 1 }}
					>
						{isSigningOut && <ActivityIndicator size="small" color="#ef4444" />}
						<Text className="font-semibold text-base text-destructive">
							Sign out
						</Text>
					</Pressable>
				</ScrollView>
			</Screen>

			{/* Non-dismissible blocking overlay during PDS deletion — mirrors the web
			    dialog. Covers the screen and the no-op onRequestClose swallows the
			    Android hardware back, so the user can't navigate away mid-deletion
			    (back button + swipe are also disabled via the Stack.Screen above). */}
			<Modal
				visible={isDeleting}
				transparent
				animationType="fade"
				onRequestClose={() => {}}
			>
				<View className="flex-1 items-center justify-center bg-black/70 p-6">
					<View className="w-full max-w-sm gap-4 rounded-2xl border border-destructive/40 bg-card p-6">
						<View className="flex-row items-center gap-2">
							<AlertTriangle color="#ef4444" size={20} />
							<Text className="font-display font-semibold text-destructive text-lg">
								Deleting your account
							</Text>
						</View>
						<Text className="text-muted-foreground text-sm leading-5">
							Please don't close the app until deletion is complete.
						</Text>
						<View className="flex-row items-center gap-2">
							<ActivityIndicator size="small" color="#ef4444" />
							<Text className="flex-1 font-medium text-destructive text-sm">
								{deletionMessage}
							</Text>
						</View>
						{deletionProgress !== null ? (
							<View className="h-2 w-full overflow-hidden rounded-full bg-destructive/20">
								<View
									className="h-full rounded-full bg-destructive"
									style={{ width: `${deletionProgress}%` }}
								/>
							</View>
						) : null}
					</View>
				</View>
			</Modal>
		</>
	);
}
