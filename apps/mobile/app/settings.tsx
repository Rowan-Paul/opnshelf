import {
	usersControllerDeleteMyAccountMutation,
	usersControllerGetMySettingsOptions,
	usersControllerUpdateMySettingsMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
	ChevronRight,
	Clock,
	Globe,
	Loader2,
	Trash2,
	User,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
	Alert,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { borderRadius, colors, spacing } from "@/constants/theme";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/contexts/toast";

// Common timezones grouped by region
const TIMEZONES = [
	{ region: "UTC", zones: ["UTC"] },
	{
		region: "Americas",
		zones: [
			"America/New_York",
			"America/Chicago",
			"America/Denver",
			"America/Los_Angeles",
			"America/Toronto",
			"America/Vancouver",
			"America/Mexico_City",
			"America/Sao_Paulo",
			"America/Buenos_Aires",
		],
	},
	{
		region: "Europe",
		zones: [
			"Europe/London",
			"Europe/Paris",
			"Europe/Berlin",
			"Europe/Rome",
			"Europe/Madrid",
			"Europe/Amsterdam",
			"Europe/Zurich",
			"Europe/Stockholm",
			"Europe/Oslo",
			"Europe/Copenhagen",
			"Europe/Helsinki",
			"Europe/Warsaw",
			"Europe/Prague",
			"Europe/Vienna",
			"Europe/Budapest",
			"Europe/Moscow",
			"Europe/Istanbul",
		],
	},
	{
		region: "Asia & Pacific",
		zones: [
			"Asia/Tokyo",
			"Asia/Seoul",
			"Asia/Shanghai",
			"Asia/Hong_Kong",
			"Asia/Singapore",
			"Asia/Taipei",
			"Asia/Manila",
			"Asia/Bangkok",
			"Asia/Jakarta",
			"Asia/Kuala_Lumpur",
			"Asia/Ho_Chi_Minh",
			"Asia/Dubai",
			"Asia/Mumbai",
			"Asia/Kolkata",
			"Asia/Dhaka",
			"Asia/Karachi",
			"Pacific/Auckland",
			"Pacific/Sydney",
			"Pacific/Melbourne",
			"Pacific/Perth",
		],
	},
	{
		region: "Middle East & Africa",
		zones: [
			"Africa/Cairo",
			"Africa/Johannesburg",
			"Africa/Lagos",
			"Africa/Nairobi",
			"Asia/Jerusalem",
			"Asia/Riyadh",
			"Asia/Tehran",
		],
	},
];

// Flatten all zones for search
const ALL_ZONES = TIMEZONES.flatMap((group) =>
	group.zones.map((zone) => ({ zone, region: group.region })),
);

export default function SettingsScreen() {
	const router = useRouter();
	const { showToast } = useToast();
	const { user, logout } = useAuth();
	const queryClient = useQueryClient();
	const [showTimezoneModal, setShowTimezoneModal] = useState(false);
	const [timezoneSearch, setTimezoneSearch] = useState("");

	// Fetch user settings
	const { data: settings, isLoading: isSettingsLoading } = useQuery({
		...usersControllerGetMySettingsOptions(),
	});

	// Local state for form values
	const [timezone, setTimezone] = useState<string>("UTC");
	const [is24Hour, setIs24Hour] = useState<boolean>(true);

	// Update local state when settings load
	useEffect(() => {
		if (settings) {
			setTimezone(settings.timezone);
			setIs24Hour(settings.timeFormat === "24h");
		}
	}, [settings]);

	// Mutation for updating settings
	const updateSettingsMutation = useMutation({
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

	// Mutation for deleting account
	const deleteAccountMutation = useMutation({
		...usersControllerDeleteMyAccountMutation(),
		onSuccess: async () => {
			showToast("Account deleted", "success");
			await logout();
			router.replace("/");
		},
		onError: () => {
			showToast("Failed to delete account", "error");
		},
	});

	// Handle delete account with confirmation
	const handleDeleteAccount = useCallback(() => {
		Alert.alert(
			"Delete Account",
			"Are you sure you want to delete your account? This action cannot be undone.",
			[
				{
					text: "Cancel",
					style: "cancel",
				},
				{
					text: "Delete",
					style: "destructive",
					onPress: () => {
						Alert.alert(
							"Delete PDS Data",
							"Do you also want to delete your watch history from your PDS?",
							[
								{
									text: "Keep on PDS",
									onPress: () => {
										deleteAccountMutation.mutate({
											body: { deletePDSData: false },
										});
									},
								},
								{
									text: "Delete from PDS",
									style: "destructive",
									onPress: () => {
										deleteAccountMutation.mutate({
											body: { deletePDSData: true },
										});
									},
								},
							],
						);
					},
				},
			],
		);
	}, [deleteAccountMutation]);

	// Handle timezone change
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

	// Handle time format toggle
	const handleTimeFormatToggle = useCallback(
		(value: boolean) => {
			setIs24Hour(value);
			updateSettingsMutation.mutate({
				body: { timeFormat: value ? "24h" : "12h" },
			});
		},
		[updateSettingsMutation],
	);

	// Get current time display based on settings
	const getCurrentTimeDisplay = useCallback(() => {
		const now = new Date();
		try {
			return now.toLocaleTimeString("en-US", {
				timeZone: timezone,
				hour12: !is24Hour,
				hour: "numeric",
				minute: "2-digit",
			});
		} catch {
			// Fallback if timezone is invalid
			return now.toLocaleTimeString("en-US", {
				hour12: !is24Hour,
				hour: "numeric",
				minute: "2-digit",
			});
		}
	}, [timezone, is24Hour]);

	// Filter timezones based on search
	const filteredZones = timezoneSearch
		? ALL_ZONES.filter(
				(z) =>
					z.zone.toLowerCase().includes(timezoneSearch.toLowerCase()) ||
					z.region.toLowerCase().includes(timezoneSearch.toLowerCase()),
			)
		: ALL_ZONES;

	return (
		<SafeAreaView style={styles.container} edges={["top"]}>
			<ScrollView style={styles.scrollView}>
				{/* Header */}
				<View style={styles.header}>
					<View style={styles.headerLeft}>
						<Globe size={28} color={colors.warning} />
						<Text style={styles.title}>Settings</Text>
					</View>
				</View>

				{/* Time & Region Card */}
				<Card style={styles.card}>
					<CardHeader style={styles.cardHeader}>
						<View style={styles.cardHeaderContent}>
							<View style={styles.iconContainer}>
								<Globe size={20} color={colors.warning} />
							</View>
							<View style={styles.cardTitleContainer}>
								<Text style={styles.cardTitle}>Time & Region</Text>
								<Text style={styles.cardDescription}>
									Customize how dates and times are displayed
								</Text>
							</View>
						</View>
					</CardHeader>
					<CardContent style={styles.cardContent}>
						{/* Timezone Row */}
						<Pressable
							onPress={() => setShowTimezoneModal(true)}
							style={styles.settingRow}
							disabled={isSettingsLoading || updateSettingsMutation.isPending}
						>
							<View style={styles.settingLabelContainer}>
								<Text style={styles.settingLabel}>Timezone</Text>
								{isSettingsLoading ? (
									<View style={styles.skeleton} />
								) : (
									<Text style={styles.settingValue}>
										{timezone.replace(/_/g, " ")}
									</Text>
								)}
							</View>
							{updateSettingsMutation.isPending && (
								<Loader2
									size={16}
									color={colors.warning}
									style={styles.spinner}
								/>
							)}
							<ChevronRight size={20} color={colors.textMuted} />
						</Pressable>

						{/* Divider */}
						<View style={styles.divider} />

						{/* Time Format Row */}
						<View style={styles.settingRow}>
							<View style={styles.settingLabelContainer}>
								<Text style={styles.settingLabel}>Time Format</Text>
								<Text style={styles.settingDescription}>
									{is24Hour ? "24-hour (14:00)" : "12-hour (2:00 PM)"}
								</Text>
							</View>
							{isSettingsLoading ? (
								<View style={[styles.skeleton, { width: 52, height: 28 }]} />
							) : (
								<View style={styles.switchContainer}>
									{updateSettingsMutation.isPending && (
										<Loader2
											size={14}
											color={colors.warning}
											style={styles.spinnerSmall}
										/>
									)}
									<Switch
										value={is24Hour}
										onValueChange={handleTimeFormatToggle}
										disabled={updateSettingsMutation.isPending}
									/>
								</View>
							)}
						</View>

						{/* Divider */}
						<View style={styles.divider} />

						{/* Live Preview */}
						{!isSettingsLoading && (
							<View style={styles.previewContainer}>
								<View style={styles.previewContent}>
									<Clock size={20} color={colors.warning} />
									<View>
										<Text style={styles.previewLabel}>
											Current time preview
										</Text>
										<Text style={styles.previewValue}>
											{getCurrentTimeDisplay()}
										</Text>
									</View>
								</View>
							</View>
						)}
					</CardContent>
				</Card>

				{/* Account Card */}
				{user && (
					<Card style={styles.card}>
						<CardHeader style={styles.cardHeader}>
							<View style={styles.cardHeaderContent}>
								<View
									style={[
										styles.iconContainer,
										{ backgroundColor: "rgba(59, 130, 246, 0.1)" },
									]}
								>
									<User size={20} color={colors.primary} />
								</View>
								<View style={styles.cardTitleContainer}>
									<Text style={styles.cardTitle}>Account</Text>
									<Text style={styles.cardDescription}>
										Manage your account information
									</Text>
								</View>
							</View>
						</CardHeader>
						<CardContent style={styles.cardContent}>
							{/* User Info */}
							<View style={styles.settingRow}>
								<View style={styles.settingLabelContainer}>
									<Text style={styles.settingLabel}>Handle</Text>
									<Text style={styles.settingValue}>@{user.handle}</Text>
								</View>
							</View>

							{user.displayName && (
								<>
									<View style={styles.divider} />
									<View style={styles.settingRow}>
										<View style={styles.settingLabelContainer}>
											<Text style={styles.settingLabel}>Display Name</Text>
											<Text style={styles.settingValue}>
												{String(user.displayName)}
											</Text>
										</View>
									</View>
								</>
							)}

							<View style={styles.divider} />

							{/* Delete Account Button */}
							<Pressable
								onPress={handleDeleteAccount}
								disabled={deleteAccountMutation.isPending}
								style={[styles.settingRow, styles.deleteButton]}
							>
								<View style={styles.settingLabelContainer}>
									<Text style={[styles.settingLabel, { color: colors.error }]}>
										Delete Account
									</Text>
									<Text style={styles.settingDescription}>
										Remove your account and data
									</Text>
								</View>
								{deleteAccountMutation.isPending && (
									<Loader2
										size={16}
										color={colors.error}
										style={styles.spinner}
									/>
								)}
								<Trash2 size={20} color={colors.error} />
							</Pressable>
						</CardContent>
					</Card>
				)}
			</ScrollView>

			{/* Timezone Modal */}
			<Modal
				visible={showTimezoneModal}
				animationType="slide"
				presentationStyle="pageSheet"
				onRequestClose={() => setShowTimezoneModal(false)}
			>
				<SafeAreaView style={styles.modalContainer}>
					<View style={styles.modalHeader}>
						<Text style={styles.modalTitle}>Select Timezone</Text>
						<Button
							variant="ghost"
							size="sm"
							onPress={() => setShowTimezoneModal(false)}
						>
							<Text style={styles.modalCloseText}>Close</Text>
						</Button>
					</View>

					<TextInput
						style={styles.searchInput}
						placeholder="Search timezones..."
						placeholderTextColor={colors.textMuted}
						value={timezoneSearch}
						onChangeText={setTimezoneSearch}
					/>

					<ScrollView style={styles.modalScroll}>
						{filteredZones.map((item) => (
							<Pressable
								key={item.zone}
								style={[
									styles.zoneItem,
									timezone === item.zone && styles.zoneItemActive,
								]}
								onPress={() => handleTimezoneChange(item.zone)}
							>
								<Text
									style={[
										styles.zoneText,
										timezone === item.zone && styles.zoneTextActive,
									]}
								>
									{item.zone.replace(/_/g, " ")}
								</Text>
								<Text style={styles.zoneRegion}>{item.region}</Text>
							</Pressable>
						))}
					</ScrollView>
				</SafeAreaView>
			</Modal>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.background,
	},
	scrollView: {
		flex: 1,
	},
	header: {
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	headerLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
	title: {
		fontSize: 28,
		fontWeight: "bold",
		color: colors.text,
	},
	card: {
		marginHorizontal: spacing.lg,
		marginBottom: spacing.lg,
	},
	cardHeader: {
		paddingBottom: spacing.sm,
	},
	cardHeaderContent: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
	},
	iconContainer: {
		width: 40,
		height: 40,
		borderRadius: borderRadius.lg,
		backgroundColor: "rgba(245, 158, 11, 0.1)",
		justifyContent: "center",
		alignItems: "center",
	},
	cardTitleContainer: {
		flex: 1,
	},
	cardTitle: {
		fontSize: 18,
		fontWeight: "600",
		color: colors.text,
		marginBottom: spacing.xs / 2,
	},
	cardDescription: {
		fontSize: 14,
		color: colors.textMuted,
		flexShrink: 1,
	},
	cardContent: {
		paddingTop: 0,
	},
	settingRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: spacing.md,
	},
	settingLabelContainer: {
		flex: 1,
		gap: spacing.xs / 2,
	},
	settingLabel: {
		fontSize: 16,
		fontWeight: "500",
		color: colors.text,
	},
	settingValue: {
		fontSize: 14,
		color: colors.textMuted,
	},
	settingDescription: {
		fontSize: 14,
		color: colors.textMuted,
	},
	switchContainer: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
	spinner: {
		marginRight: spacing.sm,
	},
	spinnerSmall: {
		marginRight: spacing.xs,
	},
	divider: {
		height: 1,
		backgroundColor: colors.border,
	},
	skeleton: {
		height: 20,
		width: 120,
		backgroundColor: colors.cardMuted,
		borderRadius: borderRadius.sm,
	},
	previewContainer: {
		marginTop: spacing.md,
		padding: spacing.md,
		backgroundColor: colors.background,
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		borderColor: colors.border,
	},
	previewContent: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
	},
	previewLabel: {
		fontSize: 14,
		color: colors.textMuted,
		marginBottom: spacing.xs / 2,
	},
	previewValue: {
		fontSize: 24,
		fontWeight: "600",
		color: colors.warning,
	},
	deleteButton: {
		paddingHorizontal: 0,
	},
	// Modal styles
	modalContainer: {
		flex: 1,
		backgroundColor: colors.background,
	},
	modalHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
		borderBottomWidth: 1,
		borderBottomColor: colors.border,
	},
	modalTitle: {
		fontSize: 18,
		fontWeight: "600",
		color: colors.text,
	},
	modalCloseText: {
		color: colors.warning,
		fontSize: 16,
		fontWeight: "500",
	},
	searchInput: {
		marginHorizontal: spacing.lg,
		marginVertical: spacing.md,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		backgroundColor: colors.card,
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		borderColor: colors.border,
		color: colors.text,
		fontSize: 16,
	},
	modalScroll: {
		flex: 1,
		paddingHorizontal: spacing.lg,
	},
	zoneItem: {
		paddingVertical: spacing.md,
		paddingHorizontal: spacing.md,
		borderRadius: borderRadius.md,
		marginBottom: spacing.xs,
	},
	zoneItemActive: {
		backgroundColor: colors.card,
	},
	zoneText: {
		fontSize: 16,
		color: colors.text,
		fontWeight: "500",
	},
	zoneTextActive: {
		color: colors.warning,
	},
	zoneRegion: {
		fontSize: 12,
		color: colors.textMuted,
		marginTop: spacing.xs / 2,
	},
});
