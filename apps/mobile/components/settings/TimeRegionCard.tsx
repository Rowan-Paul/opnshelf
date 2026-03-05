import { ChevronRight, Clock, Globe, Loader2 } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import type { ExtendedThemeColors } from "@/constants/extended-theme";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

interface TimeRegionCardProps {
	timezone: string;
	is24Hour: boolean;
	isSettingsLoading: boolean;
	isUpdating: boolean;
	currentTimeDisplay: string;
	onOpenTimezoneModal: () => void;
	onToggleTimeFormat: (value: boolean) => void;
}

export function TimeRegionCard({
	timezone,
	is24Hour,
	isSettingsLoading,
	isUpdating,
	currentTimeDisplay,
	onOpenTimezoneModal,
	onToggleTimeFormat,
}: TimeRegionCardProps) {
	const { colors } = useTheme();
	const styles = useMemo(() => createStyles(colors), [colors]);

	return (
		<Card style={styles.card}>
			<CardHeader style={styles.cardHeader}>
				<View style={styles.cardHeaderContent}>
					<View style={styles.iconContainer}>
						<Globe size={20} color={colors.onPrimaryContainer} />
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
				<Pressable
					onPress={onOpenTimezoneModal}
					style={styles.settingRow}
					disabled={isSettingsLoading || isUpdating}
				>
					<View style={styles.settingLabelContainer}>
						<Text style={styles.settingLabel}>Timezone</Text>
						{isSettingsLoading ? (
							<View style={styles.skeleton} />
						) : (
							<Text style={styles.settingValue}>{timezone.replace(/_/g, " ")}</Text>
						)}
					</View>
					{isUpdating && (
						<Loader2 size={16} color={colors.primary} style={styles.spinner} />
					)}
					<ChevronRight size={20} color={colors.textMuted} />
				</Pressable>

				<View style={styles.divider} />

				<View style={styles.settingRow}>
					<View style={styles.settingLabelContainer}>
						<Text style={styles.settingLabel}>Time Format</Text>
						<Text style={styles.settingDescription}>
							{is24Hour ? "24-hour (14:00)" : "12-hour (2:00 PM)"}
						</Text>
					</View>
					{isSettingsLoading ? (
						<View style={styles.switchSkeleton} />
					) : (
						<View style={styles.switchContainer}>
							{isUpdating && (
								<Loader2
									size={14}
									color={colors.primary}
									style={styles.spinnerSmall}
								/>
							)}
							<Switch
								value={is24Hour}
								onValueChange={onToggleTimeFormat}
								disabled={isUpdating}
							/>
						</View>
					)}
				</View>

				<View style={styles.divider} />

				{!isSettingsLoading && (
					<View style={styles.previewContainer}>
						<View style={styles.previewContent}>
							<Clock size={20} color={colors.primary} />
							<View>
								<Text style={styles.previewLabel}>Current time preview</Text>
								<Text style={styles.previewValue}>{currentTimeDisplay}</Text>
							</View>
						</View>
					</View>
				)}
			</CardContent>
		</Card>
	);
}

const createStyles = (colors: ExtendedThemeColors) =>
	StyleSheet.create({
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
			backgroundColor: colors.primaryContainer,
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
		switchSkeleton: {
			height: 28,
			width: 52,
			backgroundColor: colors.cardMuted,
			borderRadius: borderRadius.full,
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
			color: colors.primary,
		},
	});
