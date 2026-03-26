import {
	authControllerMeOptions,
	usersControllerDeleteMyAccountMutation,
	usersControllerDeleteMyAvatarMutation,
	usersControllerGetMySettingsOptions,
	usersControllerGetPublicProfileOptions,
	usersControllerUpdateMyProfileMutation,
	usersControllerUpdateMySettingsMutation,
	usersControllerUploadMyAvatarMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { usePostHog } from "posthog-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
	AccountCard,
	DeleteAccountModal,
	SettingsHeader,
	TimeRegionCard,
	TimezoneModal,
} from "@/components/settings";
import type { ExtendedThemeColors } from "@/constants/extended-theme";
import { useAuth } from "@/contexts/auth";
import { useTheme } from "@/contexts/theme";
import { useToast } from "@/contexts/toast";
import {
	createAvatarUploadFile,
	getAvatarUploadErrorMessage,
	type ReactNativeUploadFile,
	toMultipartUploadValue,
	validateAvatarAsset,
} from "@/lib/avatar-upload";
import { clearDismissedTraktImportJobIds } from "@/lib/trakt-import-dismissal";

function getErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error && error.message) {
		return error.message;
	}

	if (
		error &&
		typeof error === "object" &&
		"message" in error &&
		typeof error.message === "string"
	) {
		return error.message;
	}

	return fallback;
}

export default function SettingsScreen() {
	const router = useRouter();
	const { showToast } = useToast();
	const { user, logout } = useAuth();
	const { colors } = useTheme();
	const styles = useMemo(() => createStyles(colors), [colors]);
	const queryClient = useQueryClient();
	const posthog = usePostHog();

	const [showTimezoneModal, setShowTimezoneModal] = useState(false);
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [timezone, setTimezone] = useState<string>("UTC");
	const [is24Hour, setIs24Hour] = useState<boolean>(true);
	const [displayName, setDisplayName] = useState("");
	const [selectedAvatarFile, setSelectedAvatarFile] =
		useState<ReactNativeUploadFile | null>(null);
	const [avatarPreviewUri, setAvatarPreviewUri] = useState<string | null>(null);
	const [avatarErrorMessage, setAvatarErrorMessage] = useState<string | null>(
		null,
	);

	const { data: settings, isLoading: isSettingsLoading } = useQuery({
		...usersControllerGetMySettingsOptions(),
	});

	useEffect(() => {
		if (settings) {
			setTimezone(settings.timezone);
			setIs24Hour(settings.timeFormat === "24h");
		}
	}, [settings]);

	useEffect(() => {
		setDisplayName(user?.displayName ? String(user.displayName) : "");
	}, [user?.displayName]);

	useEffect(() => {
		if (selectedAvatarFile) {
			setAvatarPreviewUri(selectedAvatarFile.uri);
			return;
		}

		setAvatarPreviewUri(user?.avatar ? String(user.avatar) : null);
	}, [selectedAvatarFile, user?.avatar]);

	const updateSettingsMutation = useMutation({
		mutationKey: ["users", "settings", "update"],
		...usersControllerUpdateMySettingsMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: usersControllerGetMySettingsOptions().queryKey,
			});
			showToast("Settings saved", "success");
		},
		onError: () => {
			showToast("Failed to save settings", "error");
		},
	});

	const deleteAccountMutation = useMutation({
		mutationKey: ["users", "account", "delete"],
		...usersControllerDeleteMyAccountMutation(),
		onSuccess: async (_, variables) => {
			if (user?.did) {
				await clearDismissedTraktImportJobIds(user.did);
			}
			showToast("Account deleted", "success");
			posthog.capture("account_deleted", {
				deleted_pds_data: Boolean(variables?.body?.deletePDSData),
			});
			posthog.reset();
			setShowDeleteModal(false);
			await logout();
			router.replace("/");
		},
		onError: (error) => {
			showToast(getErrorMessage(error, "Failed to delete account"), "error");
		},
	});

	const updateProfileMutation = useMutation({
		mutationKey: ["users", "profile", "update"],
		...usersControllerUpdateMyProfileMutation(),
		onSuccess: async (updatedProfile) => {
			await refreshProfileState(updatedProfile);
			showToast("Profile saved", "success");
		},
		onError: () => {
			showToast("Failed to save profile", "error");
		},
	});

	const uploadAvatarMutation = useMutation({
		mutationKey: ["users", "profile", "avatar", "upload"],
		...usersControllerUploadMyAvatarMutation(),
		onSuccess: async (updatedProfile) => {
			setSelectedAvatarFile(null);
			setAvatarErrorMessage(null);
			await refreshProfileState(updatedProfile);
			showToast("Profile photo updated", "success");
		},
		onError: (error) => {
			setAvatarErrorMessage(
				getAvatarUploadErrorMessage(error, "Failed to upload profile photo"),
			);
		},
	});

	const deleteAvatarMutation = useMutation({
		mutationKey: ["users", "profile", "avatar", "delete"],
		...usersControllerDeleteMyAvatarMutation(),
		onSuccess: async (updatedProfile) => {
			setSelectedAvatarFile(null);
			setAvatarErrorMessage(null);
			await refreshProfileState(updatedProfile);
			showToast("Profile photo removed", "success");
		},
		onError: () => {
			showToast("Failed to remove profile photo", "error");
		},
	});

	const refreshProfileState = useCallback(
		async (updatedProfile: {
			displayName: string | null;
			avatar: string | null;
		}) => {
			const meQueryKey = authControllerMeOptions().queryKey;
			queryClient.setQueryData(meQueryKey, (previousUser) => {
				if (!previousUser) {
					return previousUser;
				}

				return {
					...previousUser,
					displayName: updatedProfile.displayName,
					avatar: updatedProfile.avatar,
				};
			});

			if (user?.handle) {
				queryClient.setQueryData(
					usersControllerGetPublicProfileOptions({
						path: { handle: user.handle },
					}).queryKey,
					(previousProfile) => {
						if (!previousProfile) {
							return previousProfile;
						}

						return {
							...previousProfile,
							displayName: updatedProfile.displayName,
							avatar: updatedProfile.avatar,
						};
					},
				);
			}

			await Promise.all([
				queryClient.invalidateQueries({ queryKey: meQueryKey }),
				user?.handle
					? queryClient.invalidateQueries({
							queryKey: usersControllerGetPublicProfileOptions({
								path: { handle: user.handle },
							}).queryKey,
						})
					: Promise.resolve(),
			]);
		},
		[queryClient, user?.handle],
	);

	const handleTimezoneChange = useCallback(
		(value: string) => {
			setTimezone(value);
			setShowTimezoneModal(false);
			updateSettingsMutation.mutate({
				body: { timezone: value },
			});
		},
		[updateSettingsMutation],
	);

	const handleTimeFormatToggle = useCallback(
		(value: boolean) => {
			setIs24Hour(value);
			updateSettingsMutation.mutate({
				body: { timeFormat: value ? "24h" : "12h" },
			});
		},
		[updateSettingsMutation],
	);

	const handleDeleteAccount = useCallback(() => {
		setShowDeleteModal(true);
	}, []);

	const handleSaveProfile = useCallback(() => {
		updateProfileMutation.mutate({
			body: {
				displayName,
			},
		});
	}, [displayName, updateProfileMutation]);

	const handlePickAvatar = useCallback(async () => {
		const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (!permission.granted) {
			showToast("Photo library permission is required", "error");
			return;
		}

		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: "images",
			allowsEditing: true,
			aspect: [1, 1],
			quality: 1,
		});

		const asset = result.assets?.[0];
		if (result.canceled || !asset?.uri) {
			return;
		}

		const validationMessage = validateAvatarAsset(asset);
		if (validationMessage) {
			setAvatarErrorMessage(validationMessage);
			return;
		}

		const file = createAvatarUploadFile(asset);
		setAvatarErrorMessage(null);
		setSelectedAvatarFile(file);
		setAvatarPreviewUri(asset.uri);

		uploadAvatarMutation.mutate({
			body: {
				avatar: toMultipartUploadValue(file),
			},
		});
	}, [showToast, uploadAvatarMutation]);

	const handleDeleteAvatar = useCallback(() => {
		deleteAvatarMutation.mutate({});
	}, [deleteAvatarMutation]);

	const handleConfirmDelete = useCallback(
		(deletePDSData: boolean) => {
			deleteAccountMutation.mutate({
				body: { deletePDSData },
			});
		},
		[deleteAccountMutation],
	);

	const currentTimeDisplay = useMemo(() => {
		const now = new Date();
		try {
			return now.toLocaleTimeString("en-US", {
				timeZone: timezone,
				hour12: !is24Hour,
				hour: "numeric",
				minute: "2-digit",
			});
		} catch {
			return now.toLocaleTimeString("en-US", {
				hour12: !is24Hour,
				hour: "numeric",
				minute: "2-digit",
			});
		}
	}, [timezone, is24Hour]);

	return (
		<SafeAreaView style={styles.container} edges={["top"]}>
			<ScrollView style={styles.scrollView}>
				<SettingsHeader onBack={() => router.back()} />

				<TimeRegionCard
					timezone={timezone}
					is24Hour={is24Hour}
					isSettingsLoading={isSettingsLoading}
					isUpdating={updateSettingsMutation.isPending}
					currentTimeDisplay={currentTimeDisplay}
					onOpenTimezoneModal={() => setShowTimezoneModal(true)}
					onToggleTimeFormat={handleTimeFormatToggle}
				/>

				{user ? (
					<AccountCard
						user={user}
						displayName={displayName}
						avatarUri={avatarPreviewUri}
						avatarErrorMessage={avatarErrorMessage}
						isSavingProfile={updateProfileMutation.isPending}
						isUploadingAvatar={uploadAvatarMutation.isPending}
						isDeletingAvatar={deleteAvatarMutation.isPending}
						isDeletingAccount={deleteAccountMutation.isPending}
						onDisplayNameChange={setDisplayName}
						onSaveProfile={handleSaveProfile}
						onPickAvatar={handlePickAvatar}
						onDeleteAvatar={handleDeleteAvatar}
						onDeleteAccount={handleDeleteAccount}
					/>
				) : null}
			</ScrollView>

			<TimezoneModal
				visible={showTimezoneModal}
				timezone={timezone}
				onClose={() => setShowTimezoneModal(false)}
				onSelectTimezone={handleTimezoneChange}
			/>

			<DeleteAccountModal
				visible={showDeleteModal}
				isDeleting={deleteAccountMutation.isPending}
				onClose={() => setShowDeleteModal(false)}
				onConfirm={handleConfirmDelete}
			/>
		</SafeAreaView>
	);
}

const createStyles = (colors: ExtendedThemeColors) =>
	StyleSheet.create({
		container: {
			flex: 1,
			backgroundColor: colors.background,
		},
		scrollView: {
			flex: 1,
		},
	});
