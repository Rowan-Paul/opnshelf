import type { ColorTheme } from "./types";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Share } from "react-native";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import { TrackedStatusCard } from "./TrackedStatusCard";

type DetailActionsProps = {
	mediaType: "movie" | "show" | "season" | "episode";
	mediaId: string;
	seasonNumber?: string;
	episodeNumber?: string;
	colors: ColorTheme;
	isWatched: boolean;
	watchedDate?: string | null;
	totalWatches?: number;
	onMarkWatched: () => void;
	onUnmarkWatched?: () => void;
	onShowDatePicker: () => void;
	isMarkingPending?: boolean;
	isUnmarkingPending?: boolean;
	listsCount?: number;
	onShowListModal?: () => void;
	onViewHistory?: () => void;
	isLoggedIn?: boolean;
	onLogin?: () => void;
	onShare?: () => void;
};

export function DetailActions({
	mediaType,
	colors,
	isWatched,
	watchedDate,
	totalWatches = 0,
	onMarkWatched,
	onUnmarkWatched,
	onShowDatePicker,
	isMarkingPending = false,
	isUnmarkingPending = false,
	listsCount = 0,
	onShowListModal,
	onViewHistory,
	isLoggedIn = true,
	onLogin,
	onShare,
}: DetailActionsProps) {
	const { colors: themeColors } = useTheme();
	const isInAnyList = listsCount > 0;
	const isPending = isMarkingPending;
	const primaryColor = colors.primary || themeColors.primary || "#F59E0B";
	const secondaryColor = colors.secondary || themeColors.secondary || "#D97706";

	if (!isLoggedIn && onLogin) {
		return (
			<View style={styles.container}>
				<TouchableOpacity
					onPress={onLogin}
					style={styles.primaryButton}
					activeOpacity={0.8}
				>
					<LinearGradient
						colors={[primaryColor, secondaryColor]}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 1 }}
						style={styles.gradientButton}
					>
						<Text style={styles.primaryButtonText}>Sign in to Track</Text>
					</LinearGradient>
				</TouchableOpacity>

				{onShare && (
					<TouchableOpacity
						onPress={onShare}
						style={[styles.secondaryButton, { borderColor: themeColors.outline }]}
						activeOpacity={0.8}
					>
						<Ionicons name="share-outline" size={18} color={themeColors.onSurfaceVariant} />
						<Text style={[styles.secondaryButtonText, { color: themeColors.onSurfaceVariant }]}>
							Share
						</Text>
					</TouchableOpacity>
				)}
			</View>
		);
	}

	return (
		<View style={styles.container}>
			{isWatched ? (
				<>
					<TrackedStatusCard
						isWatched={isWatched}
						watchedDate={watchedDate}
						totalWatches={totalWatches}
						onViewHistory={onViewHistory}
						onRemove={onUnmarkWatched}
						isRemoving={isUnmarkingPending}
						colors={colors}
					/>
					<View style={[styles.buttonRow, styles.buttonRowAfterStatus]}>
						<TouchableOpacity
							onPress={onMarkWatched}
							disabled={isPending}
							style={[styles.primaryButtonCompact, { flex: 1, opacity: isPending ? 0.7 : 1 }]}
							activeOpacity={0.8}
						>
							<LinearGradient
								colors={[primaryColor, secondaryColor]}
								start={{ x: 0, y: 0 }}
								end={{ x: 1, y: 1 }}
								style={styles.gradientButton}
							>
								{isPending ? (
									<View style={styles.buttonContent}>
										<ActivityIndicator color="#3f2e00" size="small" />
										<Text style={styles.primaryButtonText}>Loading</Text>
									</View>
								) : (
									<View style={styles.buttonContent}>
										<Ionicons name="refresh" size={18} color="#3f2e00" />
										<Text style={styles.primaryButtonText}>Watch Again</Text>
									</View>
								)}
							</LinearGradient>
						</TouchableOpacity>

						<TouchableOpacity
							onPress={onShowDatePicker}
							style={[styles.calendarButton, { borderColor: themeColors.outline }]}
							activeOpacity={0.8}
						>
							<Ionicons
								name="calendar-outline"
								size={20}
								color={themeColors.onSurfaceVariant}
							/>
						</TouchableOpacity>
					</View>
				</>
			) : (
				<View style={styles.buttonRow}>
					<TouchableOpacity
						onPress={onMarkWatched}
						disabled={isPending}
						style={[styles.primaryButton, { flex: 1, opacity: isPending ? 0.7 : 1 }]}
						activeOpacity={0.8}
					>
						<LinearGradient
							colors={[primaryColor, secondaryColor]}
							start={{ x: 0, y: 0 }}
							end={{ x: 1, y: 1 }}
							style={styles.gradientButton}
						>
							{isPending ? (
								<View style={styles.buttonContent}>
									<ActivityIndicator color="#3f2e00" size="small" />
									<Text style={styles.primaryButtonText}>Loading</Text>
								</View>
							) : (
								<View style={styles.buttonContent}>
									<Ionicons name="add" size={20} color="#3f2e00" />
									<Text style={styles.primaryButtonText}>Add to Shelf</Text>
								</View>
							)}
						</LinearGradient>
					</TouchableOpacity>

					<TouchableOpacity
						onPress={onShowDatePicker}
						style={[styles.calendarButton, { borderColor: themeColors.outline }]}
						activeOpacity={0.8}
					>
						<Ionicons
							name="calendar-outline"
							size={20}
							color={themeColors.onSurfaceVariant}
						/>
					</TouchableOpacity>
				</View>
			)}

			{onShowListModal && (
				<TouchableOpacity
					onPress={onShowListModal}
					style={[
						styles.secondaryButton,
						isInAnyList && {
							backgroundColor: `${colors.primary}20`,
							borderColor: colors.primary,
						},
						!isInAnyList && { borderColor: themeColors.outline },
					]}
					activeOpacity={0.8}
				>
					<Ionicons
						name={isInAnyList ? "checkmark" : "list-outline"}
						size={18}
						color={isInAnyList ? colors.primary : themeColors.onSurfaceVariant}
					/>
					<Text
						style={[
							styles.secondaryButtonText,
							isInAnyList ? { color: colors.primary } : { color: themeColors.onSurfaceVariant },
						]}
					>
						{isInAnyList
							? `In ${listsCount} list${listsCount > 1 ? "s" : ""}`
							: "Add to List"}
					</Text>
				</TouchableOpacity>
			)}

			{onShare && (
				<TouchableOpacity
					onPress={onShare}
					style={[styles.secondaryButton, { borderColor: themeColors.outline }]}
					activeOpacity={0.8}
				>
					<Ionicons name="share-outline" size={18} color={themeColors.onSurfaceVariant} />
					<Text style={[styles.secondaryButtonText, { color: themeColors.onSurfaceVariant }]}>
						Share
					</Text>
				</TouchableOpacity>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		gap: spacing.sm,
	},
	buttonRow: {
		flexDirection: "row",
		gap: spacing.sm,
		alignItems: "stretch",
	},
	buttonRowAfterStatus: {
		marginTop: spacing.xs,
	},
	primaryButton: {
		borderRadius: borderRadius.lg,
		overflow: "hidden",
	},
	primaryButtonCompact: {
		borderRadius: borderRadius.lg,
		overflow: "hidden",
	},
	gradientButton: {
		paddingVertical: 14,
		paddingHorizontal: spacing.lg,
		alignItems: "center",
		justifyContent: "center",
	},
	buttonContent: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
	primaryButtonText: {
		color: "#3f2e00",
		fontSize: 16,
		fontWeight: "600",
	},
	calendarButton: {
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		paddingVertical: 14,
		paddingHorizontal: spacing.md,
		alignItems: "center",
		justifyContent: "center",
	},
	secondaryButton: {
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		paddingVertical: 12,
		paddingHorizontal: spacing.lg,
		alignItems: "center",
		justifyContent: "center",
		flexDirection: "row",
		gap: spacing.sm,
	},
	secondaryButtonText: {
		fontSize: 15,
		fontWeight: "500",
	},
});
