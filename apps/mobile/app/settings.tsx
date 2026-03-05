import {
	usersControllerDeleteMyAccountMutation,
	usersControllerGetMySettingsOptions,
	usersControllerUpdateMySettingsMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

	const { data: settings, isLoading: isSettingsLoading } = useQuery({
		...usersControllerGetMySettingsOptions(),
	});

	useEffect(() => {
		if (settings) {
			setTimezone(settings.timezone);
			setIs24Hour(settings.timeFormat === "24h");
		}
	}, [settings]);

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
			showToast("Account deleted", "success");
			posthog.capture("account_deleted", {
				deleted_pds_data: Boolean(variables?.body?.deletePDSData),
			});
			posthog.reset();
			setShowDeleteModal(false);
			await logout();
			router.replace("/");
		},
		onError: () => {
			showToast("Failed to delete account", "error");
		},
	});

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
						isDeletingAccount={deleteAccountMutation.isPending}
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
