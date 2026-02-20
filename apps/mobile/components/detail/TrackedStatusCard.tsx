import type { ColorTheme } from "./types";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

interface TrackedStatusCardProps {
	isWatched: boolean;
	watchedDate?: string | null;
	totalWatches?: number;
	onViewHistory?: () => void;
	onRemove?: () => void;
	isRemoving?: boolean;
	colors: ColorTheme;
}

export function TrackedStatusCard({
	isWatched,
	watchedDate,
	totalWatches = 0,
	onViewHistory,
	onRemove,
	isRemoving = false,
	colors,
}: TrackedStatusCardProps) {
	const { colors: themeColors } = useTheme();

	if (!isWatched) {
		return null;
	}

	return (
		<View
			style={[
				styles.container,
				{ backgroundColor: `${colors.primary}15` },
			]}
		>
			<View style={styles.header}>
				<Ionicons name="checkmark-circle" size={20} color={colors.primary} />
				<Text style={[styles.title, { color: colors.primary }]}>
					On Your Shelf
				</Text>
			</View>

			{watchedDate && (
				<Text style={[styles.dateText, { color: themeColors.onSurfaceVariant }]}>
					Watched on {watchedDate}
				</Text>
			)}

			{totalWatches > 1 && (
				<>
					<View style={styles.historyRow}>
						<Ionicons
							name="time-outline"
							size={14}
							color={themeColors.onSurfaceVariant}
						/>
						<Text
							style={[styles.historyText, { color: themeColors.onSurfaceVariant }]}
						>
							{totalWatches} total watches
						</Text>
					</View>
					{onViewHistory && (
						<TouchableOpacity
							onPress={onViewHistory}
							style={styles.actionButton}
							activeOpacity={0.7}
						>
							<Ionicons
								name="eye-outline"
								size={16}
								color={themeColors.onSurfaceVariant}
							/>
							<Text
								style={[
									styles.actionText,
									{ color: themeColors.onSurfaceVariant },
								]}
							>
								View all watches
							</Text>
						</TouchableOpacity>
					)}
				</>
			)}

			{totalWatches >= 1 && onRemove && (
				<TouchableOpacity
					onPress={onRemove}
					disabled={isRemoving}
					style={styles.actionButton}
					activeOpacity={0.7}
				>
					{isRemoving ? (
						<>
							<ActivityIndicator size="small" color={themeColors.error} />
							<Text style={[styles.actionText, { color: themeColors.error }]}>Loading</Text>
						</>
					) : (
						<>
							<Ionicons name="trash-outline" size={16} color={themeColors.error} />
							<Text style={[styles.actionText, { color: themeColors.error }]}>
								Remove from shelf
							</Text>
						</>
					)}
				</TouchableOpacity>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		borderRadius: borderRadius.lg,
		padding: spacing.md,
		gap: spacing.xs,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
	},
	title: {
		fontSize: 16,
		fontWeight: "600",
	},
	dateText: {
		fontSize: 14,
		marginTop: spacing.xs,
	},
	historyRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
		marginTop: spacing.xs,
	},
	historyText: {
		fontSize: 13,
	},
	actionButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
		marginTop: spacing.sm,
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.sm,
		marginLeft: -spacing.sm,
		borderRadius: borderRadius.md,
	},
	actionText: {
		fontSize: 14,
		fontWeight: "500",
	},
});
