import { List } from "lucide-react-native";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

type ListStateViewProps = {
	title: string;
	description: string;
	actionText?: string;
	onAction?: () => void;
	centered?: boolean;
};

export function ListStateView({
	title,
	description,
	actionText,
	onAction,
	centered = true,
}: ListStateViewProps) {
	const { colors } = useTheme();

	return (
		<View style={centered ? styles.centerContent : undefined}>
			<Card style={styles.emptyCard}>
				<CardHeader style={styles.emptyCardHeader}>
					<List size={64} color={colors.onSurfaceVariant} style={styles.emptyIcon} />
					<Text style={[styles.emptyTitle, { color: colors.onSurface }]}>{title}</Text>
					<Text style={[styles.emptyDescription, { color: colors.onSurfaceVariant }]}>
						{description}
					</Text>
				</CardHeader>
				{actionText && onAction ? (
					<CardContent>
						<TouchableOpacity
							onPress={onAction}
							style={[styles.actionButton, { backgroundColor: colors.primary }]}
						>
							<Text style={[styles.actionText, { color: colors.onPrimary }]}>{actionText}</Text>
						</TouchableOpacity>
					</CardContent>
				) : null}
			</Card>
		</View>
	);
}

const styles = StyleSheet.create({
	centerContent: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: spacing.xl,
	},
	emptyCard: {
		width: "100%",
		maxWidth: 400,
		alignItems: "center",
	},
	emptyCardHeader: {
		alignItems: "center",
	},
	emptyIcon: {
		marginBottom: spacing.md,
	},
	emptyTitle: {
		fontSize: 20,
		fontWeight: "bold",
		textAlign: "center",
		marginBottom: spacing.sm,
	},
	emptyDescription: {
		fontSize: 14,
		textAlign: "center",
	},
	actionButton: {
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
		borderRadius: borderRadius.md,
	},
	actionText: {
		fontSize: 16,
		fontWeight: "600",
	},
});
