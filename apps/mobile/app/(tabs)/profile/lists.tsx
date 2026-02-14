import {
	listsControllerGetUserListsOptions,
	type MovieListSummaryDto,
} from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { List, ListPlus, Star } from "lucide-react-native";
import { useCallback, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CreateListModal } from "@/components/CreateListModal";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { borderRadius, colors, spacing } from "@/constants/theme";
import { useAuth } from "@/contexts/auth";

export default function ListsScreen() {
	const { user } = useAuth();
	const [showCreateModal, setShowCreateModal] = useState(false);

	const { data: lists, isLoading: isListsLoading } = useQuery({
		...listsControllerGetUserListsOptions(),
		enabled: !!user?.did,
	});

	const handleListPress = useCallback((slug: string) => {
		router.push(`/list/${slug}`);
	}, []);

	const renderItem = useCallback(
		({ item }: { item: MovieListSummaryDto }) => (
			<ListCard list={item} onPress={() => handleListPress(item.slug)} />
		),
		[handleListPress],
	);

	const keyExtractor = useCallback((item: MovieListSummaryDto) => item.id, []);

	if (isListsLoading) {
		return (
			<SafeAreaView
				style={styles.container}
				edges={["left", "right", "bottom"]}
			>
				<View style={styles.skeletonContainer}>
					{[1, 2, 3].map((i) => (
						<Skeleton
							key={i}
							width="100%"
							height={100}
							style={{ marginBottom: spacing.md }}
						/>
					))}
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
			<View style={styles.header}>
				<Text style={styles.headerTitle}>My Lists</Text>
				<TouchableOpacity
					style={styles.createButton}
					onPress={() => setShowCreateModal(true)}
				>
					<ListPlus size={20} color={colors.text} />
					<Text style={styles.createButtonText}>Create</Text>
				</TouchableOpacity>
			</View>
			{lists && lists.length > 0 && (
				<FlashList
					data={lists}
					renderItem={renderItem}
					keyExtractor={keyExtractor}
					contentContainerStyle={styles.listContent}
					ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
				/>
			)}

			{lists && lists.length === 0 && (
				<View style={styles.centerContent}>
					<Card style={styles.emptyCard}>
						<CardHeader style={styles.emptyCardHeader}>
							<ListPlus
								size={64}
								color={colors.textSecondary}
								style={styles.emptyIcon}
							/>
							<Text style={styles.emptyTitle}>No lists yet</Text>
							<Text style={styles.emptyDescription}>
								Your default lists will appear after you add movies
							</Text>
						</CardHeader>
						<CardContent>
							<Button onPress={() => router.push("/(tabs)/search")}>
								<Text style={styles.buttonText}>Search for movies</Text>
							</Button>
						</CardContent>
					</Card>
				</View>
			)}
			<CreateListModal
				visible={showCreateModal}
				onClose={() => setShowCreateModal(false)}
			/>
		</SafeAreaView>
	);
}

interface ListCardProps {
	list: MovieListSummaryDto;
	onPress: () => void;
}

function ListCard({ list, onPress }: ListCardProps) {
	const getIcon = () => {
		if (list.slug.includes("watchlist")) {
			return <List size={24} color={colors.primary} />;
		}
		if (list.slug.includes("favorites")) {
			return <Star size={24} color={colors.primary} />;
		}
		return <List size={24} color={colors.primary} />;
	};

	return (
		<TouchableOpacity onPress={onPress} style={styles.listCard}>
			<View style={styles.listCardIcon}>{getIcon()}</View>
			<View style={styles.listCardContent}>
				<View style={styles.listCardHeader}>
					<Text style={styles.listCardTitle}>{list.name}</Text>
					{list.isDefault && (
						<View style={styles.defaultBadge}>
							<Text style={styles.defaultBadgeText}>Default</Text>
						</View>
					)}
				</View>
				{list.description && (
					<Text style={styles.listCardDescription} numberOfLines={2}>
						{list.description}
					</Text>
				)}
				<Text style={styles.listCardCount}>
					{list.movieCount} movie{list.movieCount !== 1 ? "s" : ""}
				</Text>
			</View>
		</TouchableOpacity>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.background,
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
	},
	headerTitle: {
		fontSize: 28,
		fontWeight: "bold",
		color: colors.text,
	},
	createButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
		backgroundColor: colors.primary,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		borderRadius: borderRadius.md,
	},
	createButtonText: {
		color: colors.text,
		fontSize: 14,
		fontWeight: "600",
	},
	listContent: {
		padding: spacing.lg,
	},
	itemSeparator: {
		height: spacing.md,
	},
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
		color: colors.text,
		textAlign: "center",
		marginBottom: spacing.sm,
	},
	emptyDescription: {
		fontSize: 14,
		color: colors.textMuted,
		textAlign: "center",
	},
	buttonText: {
		color: colors.text,
		fontSize: 16,
		fontWeight: "600",
	},
	skeletonContainer: {
		padding: spacing.lg,
	},
	listCard: {
		flexDirection: "row",
		backgroundColor: colors.card,
		borderRadius: borderRadius.lg,
		padding: spacing.md,
		borderWidth: 1,
		borderColor: colors.border,
	},
	listCardIcon: {
		width: 48,
		height: 48,
		borderRadius: borderRadius.md,
		backgroundColor: `${colors.primary}20`,
		justifyContent: "center",
		alignItems: "center",
	},
	listCardContent: {
		flex: 1,
		marginLeft: spacing.md,
	},
	listCardHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
	listCardTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: colors.text,
	},
	defaultBadge: {
		backgroundColor: `${colors.primary}30`,
		paddingHorizontal: spacing.sm,
		paddingVertical: 2,
		borderRadius: borderRadius.sm,
	},
	defaultBadgeText: {
		fontSize: 10,
		fontWeight: "600",
		color: colors.primary,
	},
	listCardDescription: {
		fontSize: 12,
		color: colors.textMuted,
		marginTop: spacing.xs,
	},
	listCardCount: {
		fontSize: 12,
		color: colors.textSecondary,
		marginTop: spacing.xs,
	},
});
