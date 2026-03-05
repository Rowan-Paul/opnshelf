import {
	moviesControllerDeleteWatchHistoryEntryMutation,
	shelfControllerGetUserShelfInfiniteOptions,
	showsControllerDeleteEpisodeWatchHistoryEntryMutation,
} from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import {
	useInfiniteQuery,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft, BookOpen } from "lucide-react-native";
import { useCallback, useMemo } from "react";
import {
	ActivityIndicator,
	RefreshControl,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EpisodeCard } from "@/components/EpisodeCard";
import { MovieCard } from "@/components/MovieCard";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { borderRadius, spacing } from "@/constants/spacing";
import { useAuth } from "@/contexts/auth";
import { useTheme } from "@/contexts/theme";
import { useToast } from "@/contexts/toast";
import { useUserSettings } from "@/hooks/useUserSettings";
import {
	createTitleSlug,
	getDayKeyInTimezone,
	getShelfDayLabel,
} from "@/lib/utils";

export default function ShelfScreen() {
	const { user } = useAuth();
	const { showToast } = useToast();
	const queryClient = useQueryClient();
	const { timezone, is24Hour } = useUserSettings();
	const { colors } = useTheme();

	const userDid = user?.did || "";

	const shelfQuery = useInfiniteQuery({
		...shelfControllerGetUserShelfInfiniteOptions({
			path: { userDid },
			query: { limit: 20 },
		}),
		enabled: !!userDid,
		getNextPageParam: (lastPage) => {
			const cursor = lastPage.nextCursor;
			return cursor && typeof cursor === "string" ? cursor : undefined;
		},
	});

	const deleteMovieMutation = useMutation({
		mutationKey: ["shelf", "movies", "delete"],
		...moviesControllerDeleteWatchHistoryEntryMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["shelf", "user", userDid] });
			showToast("Removed from your shelf", "success");
		},
		onError: () => {
			showToast("Failed to remove. Please try again.", "error");
		},
	});

	const deleteEpisodeMutation = useMutation({
		mutationKey: ["shelf", "episodes", "delete"],
		...showsControllerDeleteEpisodeWatchHistoryEntryMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["shelf", "user", userDid] });
			showToast("Episode removed from history", "success");
		},
		onError: () => {
			showToast("Failed to remove episode. Please try again.", "error");
		},
	});

	const handleMovieRemove = useCallback(
		(movieId: string) => {
			deleteMovieMutation.mutate({ path: { trackedMovieId: movieId } });
		},
		[deleteMovieMutation],
	);

	const handleEpisodeRemove = useCallback(
		(episodeId: string) => {
			deleteEpisodeMutation.mutate({ path: { trackedEpisodeId: episodeId } });
		},
		[deleteEpisodeMutation],
	);

	const handleMoviePress = useCallback(
		(item: { movieId: string; title: string }) => {
			router.push({
				pathname: "/movie/[id]",
				params: {
					id: item.movieId,
					title: createTitleSlug(item.title),
				},
			});
		},
		[],
	);

	const handleEpisodePress = useCallback(
		(item: {
			showId: string;
			seasonNumber: number;
			episodeNumber: number;
			showTitle: string;
		}) => {
			router.push({
				pathname: "/show/[id]/season/[seasonNumber]/episode/[episodeNumber]",
				params: {
					id: item.showId,
					seasonNumber: String(item.seasonNumber),
					episodeNumber: String(item.episodeNumber),
				},
			});
		},
		[],
	);

	const items = shelfQuery.data?.pages.flatMap((page) => page.items) ?? [];
	const totalCount = shelfQuery.data?.pages[0]?.total ?? 0;

	type ShelfItem = (typeof items)[number];
	type ShelfRow =
		| {
				kind: "header";
				id: string;
				label: string;
				count: number;
		  }
		| {
				kind: "item";
				id: string;
				item: ShelfItem;
		  };

	const { rows, stickyHeaderIndices } = useMemo(() => {
		const groups = new Map<string, ShelfItem[]>();

		for (const item of items) {
			const watchedAt = item.watchedDate ?? item.createdAt;
			const dayKey = getDayKeyInTimezone(watchedAt, timezone);
			const existingGroup = groups.get(dayKey);

			if (existingGroup) {
				existingGroup.push(item);
				continue;
			}

			groups.set(dayKey, [item]);
		}

		const nextRows: ShelfRow[] = [];
		const nextStickyHeaderIndices: number[] = [];

		for (const [dayKey, dayItems] of groups) {
			nextStickyHeaderIndices.push(nextRows.length);
			nextRows.push({
				kind: "header",
				id: `header-${dayKey}`,
				label: getShelfDayLabel(dayKey, timezone),
				count: dayItems.length,
			});

			for (const item of dayItems) {
				nextRows.push({
					kind: "item",
					id: item.id,
					item,
				});
			}
		}

		return {
			rows: nextRows,
			stickyHeaderIndices: nextStickyHeaderIndices,
		};
	}, [items, timezone]);

	const isLoading = shelfQuery.isLoading;
	const isFetchingNextPage = shelfQuery.isFetchingNextPage;
	const isRefreshing = shelfQuery.isRefetching && !shelfQuery.isLoading;

	const renderItem = useCallback(
		({ item, index }: { item: ShelfRow; index: number }) => {
			if (item.kind === "header") {
				const isFirstHeader = index === 0;

				return (
					<View
						style={[
							styles.stickyHeaderRow,
							{
								backgroundColor: colors.background,
								borderBottomColor: colors.outlineVariant,
							},
						]}
					>
						<View
							style={[
								styles.dayHeader,
								{
									borderBottomColor: colors.outlineVariant,
									paddingTop: isFirstHeader ? 0 : spacing.md,
								},
							]}
						>
							<Text
								style={[styles.dayHeaderTitle, { color: colors.onBackground }]}
							>
								{item.label}
							</Text>
							<Text
								style={[
									styles.dayHeaderCount,
									{ color: colors.onSurfaceVariant },
								]}
							>
								{item.count} item{item.count !== 1 ? "s" : ""}
							</Text>
						</View>
					</View>
				);
			}

			const shelfItem = item.item;

			if (shelfItem.type === "movie") {
				const isRemoving =
					deleteMovieMutation.isPending &&
					deleteMovieMutation.variables?.path?.trackedMovieId ===
						shelfItem.movieId;

				return (
					<View style={styles.rowContainer}>
						<View style={styles.itemRow}>
							<MovieCard
								tracked={shelfItem as never}
								isRemoving={isRemoving}
								onRemove={() => handleMovieRemove(shelfItem.movieId)}
								onPress={() => handleMoviePress(shelfItem as never)}
								timezone={timezone}
								is24Hour={is24Hour}
							/>
						</View>
					</View>
				);
			}

			const isRemoving =
				deleteEpisodeMutation.isPending &&
				deleteEpisodeMutation.variables?.path?.trackedEpisodeId ===
					shelfItem.id;

			return (
				<View style={styles.rowContainer}>
					<View style={styles.itemRow}>
						<EpisodeCard
							tracked={shelfItem as never}
							isRemoving={isRemoving}
							onRemove={() => handleEpisodeRemove(shelfItem.id)}
							onPress={() => handleEpisodePress(shelfItem as never)}
							timezone={timezone}
							is24Hour={is24Hour}
						/>
					</View>
				</View>
			);
		},
		[
			colors.background,
			colors.onBackground,
			colors.onSurfaceVariant,
			colors.outlineVariant,
			deleteMovieMutation,
			deleteEpisodeMutation,
			handleMovieRemove,
			handleEpisodeRemove,
			handleMoviePress,
			handleEpisodePress,
			timezone,
			is24Hour,
		],
	);

	const keyExtractor = useCallback((item: ShelfRow) => item.id, []);

	const onEndReached = useCallback(() => {
		if (shelfQuery.hasNextPage && !shelfQuery.isFetchingNextPage) {
			shelfQuery.fetchNextPage();
		}
	}, [
		shelfQuery.hasNextPage,
		shelfQuery.isFetchingNextPage,
		shelfQuery.fetchNextPage,
	]);

	const handleRefresh = useCallback(async () => {
		await shelfQuery.refetch();
	}, [shelfQuery.refetch]);

	const renderFooter = useCallback(() => {
		if (!isFetchingNextPage) return null;
		return (
			<View style={styles.footerLoader}>
				<ActivityIndicator size="small" color={colors.primary} />
			</View>
		);
	}, [isFetchingNextPage, colors.primary]);

	if (isLoading) {
		return (
			<SafeAreaView
				style={[styles.container, { backgroundColor: colors.background }]}
				edges={["left", "right", "bottom"]}
			>
				<View style={styles.skeletonContainer}>
					{[...Array(6)].map((_, i) => (
						<View
							key={i}
							style={[
								styles.skeleton,
								{ backgroundColor: colors.surfaceContainer },
							]}
						>
							<View
								style={[
									styles.skeletonPoster,
									{ backgroundColor: colors.surfaceContainerHigh },
								]}
							/>
							<View style={styles.skeletonContent}>
								<Skeleton width="70%" height={18} />
								<Skeleton
									width="40%"
									height={14}
									style={{ marginTop: spacing.sm }}
								/>
							</View>
						</View>
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
					My Shelf
				</Text>
			</View>

			{items.length > 0 ? (
				<>
					<Text
						style={[styles.resultsCount, { color: colors.onSurfaceVariant }]}
					>
						{totalCount} item{totalCount !== 1 ? "s" : ""} watched
					</Text>
					<FlashList
						data={rows}
						renderItem={renderItem}
						keyExtractor={keyExtractor}
						contentContainerStyle={styles.listContent}
						stickyHeaderIndices={stickyHeaderIndices}
						onEndReached={onEndReached}
						onEndReachedThreshold={0.5}
						ListFooterComponent={renderFooter}
						refreshControl={
							<RefreshControl
								refreshing={isRefreshing}
								onRefresh={handleRefresh}
								tintColor={colors.primary}
								colors={[colors.primary]}
								progressBackgroundColor={colors.surfaceContainerHigh}
							/>
						}
					/>
				</>
			) : (
				<View style={styles.centerContent}>
					<Card style={styles.emptyCard}>
						<CardHeader style={styles.emptyCardHeader}>
							<BookOpen
								size={64}
								color={colors.onSurfaceVariant}
								style={styles.emptyIcon}
							/>
							<Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
								Your shelf is empty
							</Text>
							<Text
								style={[
									styles.emptyDescription,
									{ color: colors.onSurfaceVariant },
								]}
							>
								Start tracking movies and shows you&apos;ve watched
							</Text>
						</CardHeader>
						<CardContent>
							<Button onPress={() => router.push("/(tabs)/search")}>
								<Text style={[styles.buttonText, { color: colors.onPrimary }]}>
									Search for movies or shows
								</Text>
							</Button>
						</CardContent>
					</Card>
				</View>
			)}
		</SafeAreaView>
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
	resultsCount: {
		fontSize: 14,
		marginHorizontal: spacing.lg,
		marginBottom: spacing.sm,
	},
	listContent: {
		paddingBottom: spacing.lg,
	},
	rowContainer: {
		paddingHorizontal: spacing.lg,
	},
	stickyHeaderRow: {
		paddingHorizontal: spacing.lg,
		zIndex: 1,
	},
	dayHeader: {
		paddingBottom: spacing.xs,
		marginBottom: spacing.sm,
		borderBottomWidth: StyleSheet.hairlineWidth,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	dayHeaderTitle: {
		fontSize: 18,
		fontWeight: "700",
	},
	dayHeaderCount: {
		fontSize: 12,
		fontWeight: "500",
	},
	itemRow: {
		marginBottom: spacing.md,
	},
	footerLoader: {
		paddingVertical: spacing.lg,
		alignItems: "center",
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
	skeleton: {
		flexDirection: "row",
		marginBottom: spacing.md,
		borderRadius: borderRadius.lg,
		overflow: "hidden",
	},
	skeletonPoster: {
		width: 80,
		aspectRatio: 2 / 3,
	},
	skeletonContent: {
		flex: 1,
		padding: spacing.md,
		justifyContent: "center",
	},
});
