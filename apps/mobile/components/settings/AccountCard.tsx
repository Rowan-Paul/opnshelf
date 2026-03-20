import type { UserDto } from "@opnshelf/api";
import { Image } from "expo-image";
import { Camera, Loader2, Trash2, User } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { M3TextField } from "@/components/ui/m3";
import type { ExtendedThemeColors } from "@/constants/extended-theme";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import { AVATAR_UPLOAD_HELP_TEXT } from "@/lib/avatar-upload";

interface AccountCardProps {
	user: UserDto;
	displayName: string;
	avatarUri: string | null;
	avatarErrorMessage: string | null;
	isSavingProfile: boolean;
	isUploadingAvatar: boolean;
	isDeletingAvatar: boolean;
	isDeletingAccount: boolean;
	onDisplayNameChange: (value: string) => void;
	onSaveProfile: () => void;
	onPickAvatar: () => void;
	onDeleteAvatar: () => void;
	onDeleteAccount: () => void;
}

export function AccountCard({
	user,
	displayName,
	avatarUri,
	avatarErrorMessage,
	isSavingProfile,
	isUploadingAvatar,
	isDeletingAvatar,
	isDeletingAccount,
	onDisplayNameChange,
	onSaveProfile,
	onPickAvatar,
	onDeleteAvatar,
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
				<View style={styles.profileEditor}>
					<View
						style={[
							styles.avatarFrame,
							{ backgroundColor: colors.surfaceContainerHigh },
						]}
					>
						{avatarUri ? (
							<Image source={{ uri: avatarUri }} style={styles.avatarImage} />
						) : (
							<Text style={[styles.avatarFallback, { color: colors.primary }]}>
								{(displayName || user.handle).charAt(0).toUpperCase()}
							</Text>
						)}
					</View>
					<View style={styles.profileActions}>
						<Button
							variant="filled-tonal"
							onPress={onPickAvatar}
							isLoading={isUploadingAvatar}
						>
							<Camera size={16} color={colors.onSecondaryContainer} />
							<Text
								style={[
									styles.actionText,
									{ color: colors.onSecondaryContainer },
								]}
							>
								{avatarUri ? "Replace photo" : "Upload photo"}
							</Text>
						</Button>
						<Button
							variant="text"
							onPress={onDeleteAvatar}
							disabled={!avatarUri}
							isLoading={isDeletingAvatar}
						>
							<Text style={[styles.actionText, { color: colors.primary }]}>
								Remove
							</Text>
						</Button>
					</View>
					<Text style={styles.helperText}>{AVATAR_UPLOAD_HELP_TEXT}</Text>
					{avatarErrorMessage ? (
						<Text style={[styles.helperText, { color: colors.error }]}>
							{avatarErrorMessage}
						</Text>
					) : null}
				</View>

				<View style={styles.divider} />

				<View style={styles.settingRow}>
					<View style={styles.settingLabelContainer}>
						<Text style={styles.settingLabel}>Handle</Text>
						<Text style={styles.settingValue}>@{user.handle}</Text>
					</View>
				</View>

				<View style={styles.divider} />

				<View style={styles.profileFieldStack}>
					<M3TextField
						label="Display name"
						value={displayName}
						onChangeText={onDisplayNameChange}
						containerStyle={{ width: "100%" }}
						variant="outlined"
					/>
					<Button
						variant="filled"
						onPress={onSaveProfile}
						isLoading={isSavingProfile}
					>
						<Text style={[styles.actionText, { color: colors.onPrimary }]}>
							Save profile
						</Text>
					</Button>
				</View>

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
		profileEditor: {
			paddingVertical: spacing.md,
			gap: spacing.md,
		},
		avatarFrame: {
			width: 104,
			height: 104,
			borderRadius: 52,
			overflow: "hidden",
			alignItems: "center",
			justifyContent: "center",
			alignSelf: "center",
		},
		avatarImage: {
			width: "100%",
			height: "100%",
		},
		avatarFallback: {
			fontSize: 38,
			fontWeight: "700",
		},
		profileActions: {
			flexDirection: "row",
			justifyContent: "center",
			gap: spacing.sm,
			flexWrap: "wrap",
		},
		actionText: {
			fontSize: 14,
			fontWeight: "600",
			marginLeft: spacing.xs,
		},
		helperText: {
			fontSize: 13,
			color: colors.textMuted,
			textAlign: "center",
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
		profileFieldStack: {
			paddingVertical: spacing.md,
			gap: spacing.md,
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
