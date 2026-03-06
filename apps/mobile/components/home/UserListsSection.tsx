import { router } from "expo-router";
import { ListPlus } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import type { DashboardListItem } from "@/components/home/types";

type UserListsSectionProps = {
	isLoading: boolean;
	recentLists: DashboardListItem[];
	onCreateList: () => void;
};

export function UserListsSection({
	isLoading,
	recentLists,
	onCreateList,
}: UserListsSectionProps) {
	const { colors } = useTheme();

	return (
		<View style={styles.section}>
			<View style={styles.sectionHeader}>
				<Text style={[styles.sectionTitle, { color: colors.onBackground }]}>Your Lists</Text>
				<Pressable
					onPress={() => router.push("/(tabs)/profile/lists")}
					style={[styles.headerAction, { backgroundColor: colors.surfaceContainerHigh }]}
				>
					<Text style={[styles.sectionLink, { color: colors.primary }]}>All lists</Text>
				</Pressable>
			</View>
			<Button variant="outlined" onPress={onCreateList} style={styles.createListButton}>
				<ListPlus size={16} color={colors.primary} style={styles.buttonIcon} />
				<Text style={[styles.createListText, { color: colors.primary }]}>Create list</Text>
			</Button>
			{isLoading ? (
				<View style={styles.sectionSkeleton}>
					{[1, 2].map((i) => (
						<Skeleton key={i} width="100%" height={96} style={{ marginBottom: spacing.sm }} />
					))}
				</View>
			) : recentLists.length > 0 ? (
				<View style={styles.recentList}>
					{recentLists.map((list) => (
						<Pressable
							key={list.id}
							onPress={() => router.push(`/list/${list.slug}`)}
							style={[
								styles.listItem,
								{
									backgroundColor: colors.surfaceContainer,
									borderColor: colors.outline,
								},
							]}
						>
							<View style={styles.listMeta}>
								<Text style={[styles.listName, { color: colors.onSurface }]} numberOfLines={1}>
									{list.name}
								</Text>
								<Text style={[styles.listCount, { color: colors.onSurfaceVariant }]}> 
									{list.movieCount} item{list.movieCount !== 1 ? "s" : ""}
								</Text>
							</View>
						</Pressable>
					))}
				</View>
			) : (
				<Card>
					<CardHeader>
						<Text style={[styles.emptyTitle, { color: colors.onSurface }]}>No lists yet</Text>
					</CardHeader>
					<CardContent>
						<Text style={[styles.emptyDescription, { color: colors.onSurfaceVariant }]}> 
							Create your first list to organize items.
						</Text>
					</CardContent>
				</Card>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	section: {
		marginBottom: spacing.xl,
	},
	sectionHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		gap: spacing.sm,
		flexWrap: "wrap",
		marginBottom: spacing.sm,
	},
	sectionTitle: {
		fontSize: 22,
		fontWeight: "700",
	},
	sectionLink: {
		fontSize: 14,
		fontWeight: "600",
	},
	headerAction: {
		paddingHorizontal: spacing.sm,
		paddingVertical: 8,
		borderRadius: borderRadius.full,
	},
	createListButton: {
		alignSelf: "stretch",
		marginBottom: spacing.sm,
		borderRadius: borderRadius.full,
	},
	createListText: {
		fontSize: 14,
		fontWeight: "600",
	},
	buttonIcon: {
		marginRight: spacing.sm,
	},
	sectionSkeleton: {
		marginTop: spacing.sm,
	},
	recentList: {
		gap: spacing.sm,
	},
	listItem: {
		borderWidth: 1,
		borderRadius: borderRadius.lg,
		padding: spacing.md,
	},
	listMeta: {
		gap: spacing.xs,
	},
	listName: {
		fontSize: 16,
		fontWeight: "600",
	},
	listCount: {
		fontSize: 13,
	},
	emptyTitle: {
		fontSize: 18,
		fontWeight: "700",
	},
	emptyDescription: {
		fontSize: 14,
		lineHeight: 20,
	},
});
