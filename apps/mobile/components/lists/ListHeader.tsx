import { ArrowLeft } from "lucide-react-native";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

type ListHeaderProps = {
	title: string;
	isDefault: boolean;
	onBack: () => void;
	onDelete?: () => void;
	isDeleting?: boolean;
};

export function ListHeader({
	title,
	isDefault,
	onBack,
	onDelete,
	isDeleting = false,
}: ListHeaderProps) {
	const { colors } = useTheme();

	return (
		<View style={styles.header}>
			<TouchableOpacity onPress={onBack} style={styles.backButton}>
				<ArrowLeft size={24} color={colors.onBackground} />
			</TouchableOpacity>
			<View style={styles.headerContent}>
				<Text style={[styles.title, { color: colors.onBackground }]} numberOfLines={1}>
					{title}
				</Text>
				{isDefault ? (
					<View style={[styles.defaultBadge, { backgroundColor: `${colors.primary}30` }]}>
						<Text style={[styles.defaultBadgeText, { color: colors.primary }]}>Default</Text>
					</View>
				) : null}
			</View>
			{!isDefault && onDelete ? (
				<TouchableOpacity onPress={onDelete} disabled={isDeleting} style={styles.deleteButton}>
					<Text style={[styles.deleteButtonText, { color: colors.error }]}> 
						{isDeleting ? "..." : "Delete"}
					</Text>
				</TouchableOpacity>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	header: {
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
		flexDirection: "row",
		alignItems: "center",
	},
	backButton: {
		padding: spacing.sm,
		marginRight: spacing.sm,
	},
	headerContent: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
	title: {
		fontSize: 24,
		fontWeight: "bold",
		flex: 1,
	},
	defaultBadge: {
		paddingHorizontal: spacing.sm,
		paddingVertical: 2,
		borderRadius: borderRadius.sm,
	},
	defaultBadgeText: {
		fontSize: 10,
		fontWeight: "600",
	},
	deleteButton: {
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
	},
	deleteButtonText: {
		fontSize: 14,
		fontWeight: "600",
	},
});
