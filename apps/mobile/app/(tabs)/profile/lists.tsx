import {
	listsControllerGetUserListsOptions,
	type MovieListSummaryDto,
} from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft, List, ListPlus, Star } from "lucide-react-native";
import { useCallback, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CreateListModal } from "@/components/CreateListModal";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ThemedRefreshControl } from "@/components/ui/ThemedRefreshControl";
import { borderRadius, spacing } from "@/constants/spacing";
import { useAuth } from "@/contexts/auth";
import { useTheme } from "@/contexts/theme";

export default function ListsScreen() {
	const { user } = useAuth();
	const { colors } = useTheme();
	const [showCreateModal, setShowCreateModal] = useState(false);

	const {
		data: lists,
		isLoading: isListsLoading,
		isRefetching: isListsRefetching,
		refetch: refetchLists,
	} = useQuery({
		...listsControllerGetUserListsOptions(),
		enabled: !!user?.did,
	});

	const isRefreshing = isListsRefetching && !isListsLoading;

	const handleRefresh = useCallback(async () => {
		await refetchLists();
	}, [refetchLists]);

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
				style={[styles.container, { backgroundColor: colors.background }]}
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
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.background }]}
			edges={["left", "right", "bottom", "top"]}
		>
			<View style={styles.header}>
				<TouchableOpacity
					onPress={() => router.back()}
					style={styles.backButton}
				>
					<ArrowLeft size={24} color={colors.onBackground} />
				</TouchableOpacity>
				<Text style={[styles.headerTitle, { color: colors.onBackground }]}>
					My Lists
				</Text>
				<TouchableOpacity
					style={[styles.createButton, { backgroundColor: colors.primary }]}
					onPress={() => setShowCreateModal(true)}
				>
					<ListPlus size={20} color={colors.onPrimary} />
					<Text style={[styles.createButtonText, { color: colors.onPrimary }]}>
						Create
					</Text>
				</TouchableOpacity>
			</View>
			{lists && lists.length > 0 && (
				<FlashList
					data={lists}
					renderItem={renderItem}
					keyExtractor={keyExtractor}
					contentContainerStyle={styles.listContent}
					ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
					refreshControl={
						<ThemedRefreshControl
							refreshing={isRefreshing}
							onRefresh={handleRefresh}
						/>
					}
				/>
			)}

			{lists && lists.length === 0 && (
				<View style={styles.centerContent}>
					<Card style={styles.emptyCard}>
						<CardHeader style={styles.emptyCardHeader}>
							<ListPlus
								size={64}
								color={colors.onSurfaceVariant}
								style={styles.emptyIcon}
							/>
							<Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
								No lists yet
							</Text>
							<Text
								style={[
									styles.emptyDescription,
									{ color: colors.onSurfaceVariant },
								]}
							>
								Your default lists will appear after you add items
							</Text>
						</CardHeader>
						<CardContent>
							<Button onPress={() => router.push("/(tabs)/search")}>
								<Text style={[styles.buttonText, { color: colors.onPrimary }]}>
									Search for items
								</Text>
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
	const { colors } = useTheme();

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
		<TouchableOpacity
			onPress={onPress}
			style={[
				styles.listCard,
				{
					backgroundColor: colors.surfaceContainer,
					borderColor: colors.outline,
				},
			]}
		>
			<View
				style={[
					styles.listCardIcon,
					{ backgroundColor: `${colors.primary}20` },
				]}
			>
				{getIcon()}
			</View>
			<View style={styles.listCardContent}>
				<View style={styles.listCardHeader}>
					<Text style={[styles.listCardTitle, { color: colors.onSurface }]}>
						{list.name}
					</Text>
					{list.isDefault && (
						<View
							style={[
								styles.defaultBadge,
								{ backgroundColor: `${colors.primary}30` },
							]}
						>
							<Text
								style={[styles.defaultBadgeText, { color: colors.primary }]}
							>
								Default
							</Text>
						</View>
					)}
				</View>
				{list.description && (
					<Text
						style={[
							styles.listCardDescription,
							{ color: colors.onSurfaceVariant },
						]}
						numberOfLines={2}
					>
						{list.description}
					</Text>
				)}
				<Text
					style={[styles.listCardCount, { color: colors.onSurfaceVariant }]}
				>
					{list.movieCount} item{list.movieCount !== 1 ? "s" : ""}
				</Text>
			</View>
		</TouchableOpacity>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
		gap: spacing.md,
	},
	backButton: {
		padding: spacing.sm,
	},
	headerTitle: {
		fontSize: 28,
		fontWeight: "bold",
	},
	createButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		borderRadius: borderRadius.md,
		marginLeft: "auto",
	},
	createButtonText: {
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
		textAlign: "center",
		marginBottom: spacing.sm,
	},
	emptyDescription: {
		fontSize: 14,
		textAlign: "center",
	},
	buttonText: {
		fontSize: 16,
		fontWeight: "600",
	},
	skeletonContainer: {
		padding: spacing.lg,
	},
	listCard: {
		flexDirection: "row",
		borderRadius: borderRadius.lg,
		padding: spacing.md,
		borderWidth: 1,
	},
	listCardIcon: {
		width: 48,
		height: 48,
		borderRadius: borderRadius.md,
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
	listCardDescription: {
		fontSize: 12,
		marginTop: spacing.xs,
	},
	listCardCount: {
		fontSize: 12,
		marginTop: spacing.xs,
	},
});
