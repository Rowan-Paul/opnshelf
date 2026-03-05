import { Ionicons } from "@expo/vector-icons";
import {
	ActivityIndicator,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { Button } from "@/components/ui/Button";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

type WatchHistoryItem = {
	id: string;
	watchedDate: string;
};

type WatchHistoryModalProps = {
	visible: boolean;
	onClose: () => void;
	title?: string;
	description: string;
	items: WatchHistoryItem[];
	emptyText?: string;
	formatWatchDate: (date: string) => string;
	onDelete: (id: string) => void;
	isDeleting?: boolean;
	deletingId?: string;
};

export function WatchHistoryModal({
	visible,
	onClose,
	title = "Watch History",
	description,
	items,
	emptyText = "No watch history found",
	formatWatchDate,
	onDelete,
	isDeleting = false,
	deletingId,
}: WatchHistoryModalProps) {
	const { colors } = useTheme();

	return (
		<Modal
			visible={visible}
			animationType="fade"
			transparent={true}
			onRequestClose={onClose}
		>
			<View style={styles.modalOverlay}>
				<View
					style={[
						styles.modalContent,
						{ backgroundColor: colors.surfaceContainerHighest },
					]}
				>
					<View style={styles.modalHeader}>
						<View style={styles.modalTitleContainer}>
							<Ionicons name="time" size={20} color={colors.primary} />
							<Text style={[styles.modalTitle, { color: colors.onSurface }]}>
								{title}
							</Text>
						</View>
						<Pressable onPress={onClose}>
							<Ionicons name="close" size={24} color={colors.onSurface} />
						</Pressable>
					</View>
					<Text style={[styles.modalDescription, { color: colors.onSurfaceVariant }]}> 
						{description}
					</Text>

					<ScrollView style={styles.historyList}>
						{items.length > 0 ? (
							items.map((watch) => (
								<View
									key={watch.id}
									style={[
										styles.historyItem,
										{ backgroundColor: colors.surfaceContainer },
									]}
								>
									<Text style={[styles.historyDate, { color: colors.onSurface }]}> 
										{formatWatchDate(watch.watchedDate)}
									</Text>
									<TouchableOpacity
										onPress={() => onDelete(watch.id)}
										disabled={isDeleting}
										style={styles.historyDeleteButton}
										activeOpacity={0.7}
									>
										{isDeleting && deletingId === watch.id ? (
											<ActivityIndicator size="small" color={colors.onSurfaceVariant} />
										) : (
											<Ionicons name="trash-outline" size={18} color="#ef4444" />
										)}
									</TouchableOpacity>
								</View>
							))
						) : (
							<Text style={[styles.emptyHistory, { color: colors.onSurfaceVariant }]}> 
								{emptyText}
							</Text>
						)}
					</ScrollView>

					<Button variant="outlined" onPress={onClose}>
						<Text style={[styles.closeText, { color: colors.onSurfaceVariant }]}>Close</Text>
					</Button>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.7)",
		justifyContent: "center",
		padding: spacing.md,
	},
	modalContent: {
		borderRadius: borderRadius.lg,
		padding: spacing.md,
		gap: spacing.md,
	},
	modalHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	modalTitleContainer: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
	modalTitle: {
		fontSize: 20,
		fontWeight: "700",
	},
	modalDescription: {
		fontSize: 14,
	},
	historyList: {
		maxHeight: 320,
	},
	historyItem: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: spacing.md,
		borderRadius: borderRadius.md,
		marginBottom: spacing.sm,
	},
	historyDate: {
		fontSize: 14,
		fontWeight: "500",
		flex: 1,
	},
	historyDeleteButton: {
		padding: spacing.sm,
	},
	emptyHistory: {
		textAlign: "center",
		paddingVertical: spacing.xl,
		fontSize: 14,
	},
	closeText: {
		fontSize: 14,
		fontWeight: "600",
	},
});
