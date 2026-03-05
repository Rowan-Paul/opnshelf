import type { UserDto } from "@opnshelf/api";
import { Loader2, Trash2, User } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import type { ExtendedThemeColors } from "@/constants/extended-theme";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

interface AccountCardProps {
	user: UserDto;
	isDeletingAccount: boolean;
	onDeleteAccount: () => void;
}

export function AccountCard({
	user,
	isDeletingAccount,
	onDeleteAccount,
}: AccountCardProps) {
	const { colors } = useTheme();
	const styles = useMemo(() => createStyles(colors), [colors]);

	return (
		<Card style={styles.card}>
			<CardHeader style={styles.cardHeader}>
				<View style={styles.cardHeaderContent}>
					<View style={styles.iconContainer}>
						<User size={20} color={colors.onPrimaryContainer} />
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
								<Text style={styles.settingValue}>{String(user.displayName)}</Text>
							</View>
						</View>
					</>
				)}

				<View style={styles.divider} />

				<Pressable
					onPress={onDeleteAccount}
					disabled={isDeletingAccount}
					style={[styles.settingRow, styles.deleteButton]}
				>
					<View style={styles.settingLabelContainer}>
						<Text style={[styles.settingLabel, { color: colors.error }]}>Delete Account</Text>
						<Text style={styles.settingDescription}>Remove your account and data</Text>
					</View>
					{isDeletingAccount && (
						<Loader2 size={16} color={colors.error} style={styles.spinner} />
					)}
					<Trash2 size={20} color={colors.error} />
				</Pressable>
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
		divider: {
			height: 1,
			backgroundColor: colors.border,
		},
		deleteButton: {
			paddingHorizontal: 0,
		},
		spinner: {
			marginRight: spacing.sm,
		},
	});
