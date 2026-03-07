import {
	listsControllerDeleteListMutation,
	listsControllerGetList,
	listsControllerGetListQueryKey,
	listsControllerGetUserListsQueryKey,
	listsControllerRemoveItemFromListMutation,
	type MediaInListDto,
	moviesControllerMarkWatchedMutation,
	showsControllerMarkSeasonWatchedMutation,
	showsControllerMarkShowWatchedMutation,
	showsControllerMarkWatchedMutation,
} from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import {
	useInfiniteQuery,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, Trash2 } from "lucide-react-native";
import { usePostHog } from "posthog-react-native";
import { useCallback, useState } from "react";
import {
	RefreshControl,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ListHeader } from "@/components/lists/ListHeader";
import { ListStateView } from "@/components/lists/ListStateView";
import { MediaCard } from "@/components/MediaCard";
import { ScrollRevealHeader } from "@/components/ScrollRevealHeader";
import { SpinningLoader } from "@/components/SpinningLoader";
import { Skeleton } from "@/components/ui/Skeleton";
import { borderRadius, spacing } from "@/constants/spacing";
import { useAuth } from "@/contexts/auth";
import { useTheme } from "@/contexts/theme";
import { useToast } from "@/contexts/toast";
import { useScrollRevealHeader } from "@/hooks/useScrollRevealHeader";
import {
	invalidateUserShelfQueries,
	invalidateUserUpNextQueries,
} from "@/lib/invalidate-shelf";
import {
	createTitleSlug,
	getTmdbPosterUrl,
	parseScopedShowMediaId,
} from "@/lib/utils";

const PAGE_SIZE = 20;

export default function ListDetailScreen() {
	const { slug } = useLocalSearchParams<{ slug: string }>();
	const router = useRouter();
	const { user, isAuthenticated } = useAuth();
	const { showToast } = useToast();
	const { colors } = useTheme();
	const queryClient = useQueryClient();
	const posthog = usePostHog();
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const { showCompactHeader, onScroll } = useScrollRevealHeader(100);

	const {
		data,
		isLoading,
		isFetchingNextPage,
		isRefetching,
		hasNextPage,
		refetch,
		fetchNextPage,
	} = useInfiniteQuery({
		queryKey: listsControllerGetListQueryKey({
			path: { slug: slug || "" },
			query: { pageSize: PAGE_SIZE },
		}),
		queryFn: async ({ pageParam }) => {
			const response = await listsControllerGetList({
				path: { slug: slug || "" },
				query: { page: pageParam as number, pageSize: PAGE_SIZE },
				throwOnError: true,
			});
			return response.data;
		},
		enabled: !!user?.did && !!slug,
		initialPageParam: 1,
		getNextPageParam: (lastPage) =>
			lastPage.hasNextPage ? lastPage.page + 1 : undefined,
	});

	const pages = data?.pages ?? [];
	const list = pages[0];
	const movies = pages.flatMap((page) => page.items ?? []);
	const latestPage = pages[pages.length - 1];
	const totalCount = list?.total ?? 0;
	const isRefreshing = isRefetching && !isLoading && !isFetchingNextPage;

	const handleWatchSuccess = useCallback(() => {
		invalidateUserShelfQueries(queryClient, user?.did);
		invalidateUserUpNextQueries(queryClient, user?.did);
		showToast("Added to your shelf", "success");
	}, [queryClient, showToast, user?.did]);

	const handleRefresh = useCallback(async () => {
		await refetch();
	}, [refetch]);

	const removeMutation = useMutation({
		mutationKey: ["lists", slug, "removeItem"],
		...listsControllerRemoveItemFromListMutation(),
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({
				queryKey: listsControllerGetListQueryKey({
					path: { slug: slug || "" },
					query: { pageSize: PAGE_SIZE },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: listsControllerGetUserListsQueryKey(),
			});
			showToast("Removed from list", "success");
			posthog.capture("media_removed_from_list", {
				media_type: variables.path.mediaType,
				media_id: variables.path.mediaId,
				...(slug ? { list_slug: slug } : {}),
				...(list?.name ? { list_name: list.name } : {}),
			});
		},
		onError: () => {
			showToast("Failed to remove. Please try again.", "error");
		},
	});

	const markMovieWatchedMutation = useMutation({
		mutationKey: ["lists", slug, "watch", "movie"],
		...moviesControllerMarkWatchedMutation(),
		onSuccess: handleWatchSuccess,
		onError: () => {
			showToast("Failed to update. Please try again.", "error");
		},
	});

	const markShowWatchedMutation = useMutation({
		mutationKey: ["lists", slug, "watch", "show"],
		...showsControllerMarkShowWatchedMutation(),
		onSuccess: handleWatchSuccess,
		onError: () => {
			showToast("Failed to update. Please try again.", "error");
		},
	});

	const markSeasonWatchedMutation = useMutation({
		mutationKey: ["lists", slug, "watch", "season"],
		...showsControllerMarkSeasonWatchedMutation(),
		onSuccess: handleWatchSuccess,
		onError: () => {
			showToast("Failed to update. Please try again.", "error");
		},
	});

	const markEpisodeWatchedMutation = useMutation({
		mutationKey: ["lists", slug, "watch", "episode"],
		...showsControllerMarkWatchedMutation(),
		onSuccess: handleWatchSuccess,
		onError: () => {
			showToast("Failed to update. Please try again.", "error");
		},
	});

	const deleteMutation = useMutation({
		mutationKey: ["lists", slug, "delete"],
		...listsControllerDeleteListMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: listsControllerGetUserListsQueryKey(),
			});
			showToast("List deleted", "success");
			posthog.capture("list_deleted", {
				...(slug ? { list_slug: slug } : {}),
				...(list?.name ? { list_name: list.name } : {}),
			});
			router.push("/(tabs)/profile/lists");
		},
		onError: () => {
			showToast("Failed to delete. Please try again.", "error");
		},
	});

	const handleBack = useCallback(() => {
		router.back();
	}, [router]);

	const handleMoviePress = useCallback(
		(item: MediaInListDto) => {
			const title = item.media.title as string;
			if (item.mediaType === "show") {
				const scoped = parseScopedShowMediaId(item.mediaId);
				const showId =
					(item.media as { showId?: string }).showId ??
					scoped.showId ??
					item.mediaId;
				if (
					typeof scoped.seasonNumber === "number" &&
					typeof scoped.episodeNumber === "number"
				) {
					router.push({
						pathname:
							"/show/[id]/season/[seasonNumber]/episode/[episodeNumber]",
						params: {
							id: showId,
							seasonNumber: String(scoped.seasonNumber),
							episodeNumber: String(scoped.episodeNumber),
							title: createTitleSlug(title),
						},
					});
					return;
				}
				if (typeof scoped.seasonNumber === "number") {
					router.push({
						pathname: "/show/[id]/season/[seasonNumber]",
						params: {
							id: showId,
							seasonNumber: String(scoped.seasonNumber),
							title: createTitleSlug(title),
						},
					});
					return;
				}
				router.push({
					pathname: "/show/[id]",
					params: {
						id: showId,
						title: createTitleSlug(title),
					},
				});
			} else {
				router.push({
					pathname: "/movie/[id]",
					params: {
						id: item.mediaId,
						title: createTitleSlug(title),
					},
				});
			}
		},
		[router],
	);

	const handleRemove = useCallback(
		(mediaType: "movie" | "show", mediaId: string) => {
			removeMutation.mutate({
				path: { slug: slug || "", mediaType, mediaId },
			});
		},
		[removeMutation, slug],
	);

	const handleEndReached = useCallback(() => {
		if (!(hasNextPage ?? latestPage?.hasNextPage) || isFetchingNextPage) {
			return;
		}

		void fetchNextPage();
	}, [fetchNextPage, hasNextPage, isFetchingNextPage, latestPage?.hasNextPage]);

	const handleQuickWatch = useCallback(
		(item: MediaInListDto) => {
			if (item.mediaType === "movie") {
				markMovieWatchedMutation.mutate({
					body: { movieId: item.mediaId },
				});
				return;
			}

			const scopedShow = parseScopedShowMediaId(item.mediaId);
			const showId =
				(item.media as { showId?: string }).showId ??
				scopedShow.showId ??
				item.mediaId;

			if (
				typeof scopedShow.seasonNumber === "number" &&
				typeof scopedShow.episodeNumber === "number"
			) {
				markEpisodeWatchedMutation.mutate({
					body: {
						showId,
						seasonNumber: scopedShow.seasonNumber,
						episodeNumber: scopedShow.episodeNumber,
					},
				});
				return;
			}

			if (typeof scopedShow.seasonNumber === "number") {
				markSeasonWatchedMutation.mutate({
					body: {
						showId,
						seasonNumber: scopedShow.seasonNumber,
					},
				});
				return;
			}

			markShowWatchedMutation.mutate({
				body: { showId },
			});
		},
		[
			markEpisodeWatchedMutation,
			markMovieWatchedMutation,
			markSeasonWatchedMutation,
			markShowWatchedMutation,
		],
	);

	const isQuickWatchPending = useCallback(
		(item: MediaInListDto) => {
			if (item.mediaType === "movie") {
				return (
					markMovieWatchedMutation.isPending &&
					markMovieWatchedMutation.variables?.body?.movieId === item.mediaId
				);
			}

			const scopedShow = parseScopedShowMediaId(item.mediaId);
			const showId =
				(item.media as { showId?: string }).showId ??
				scopedShow.showId ??
				item.mediaId;

			if (
				typeof scopedShow.seasonNumber === "number" &&
				typeof scopedShow.episodeNumber === "number"
			) {
				return (
					markEpisodeWatchedMutation.isPending &&
					markEpisodeWatchedMutation.variables?.body?.showId === showId &&
					markEpisodeWatchedMutation.variables?.body?.seasonNumber ===
						scopedShow.seasonNumber &&
					markEpisodeWatchedMutation.variables?.body?.episodeNumber ===
						scopedShow.episodeNumber
				);
			}

			if (typeof scopedShow.seasonNumber === "number") {
				return (
					markSeasonWatchedMutation.isPending &&
					markSeasonWatchedMutation.variables?.body?.showId === showId &&
					markSeasonWatchedMutation.variables?.body?.seasonNumber ===
						scopedShow.seasonNumber
				);
			}

			return (
				markShowWatchedMutation.isPending &&
				markShowWatchedMutation.variables?.body?.showId === showId
			);
		},
		[
			markEpisodeWatchedMutation.isPending,
			markEpisodeWatchedMutation.variables,
			markMovieWatchedMutation.isPending,
			markMovieWatchedMutation.variables,
			markSeasonWatchedMutation.isPending,
			markSeasonWatchedMutation.variables,
			markShowWatchedMutation.isPending,
			markShowWatchedMutation.variables,
		],
	);

	const renderItem = useCallback(
		({ item }: { item: MediaInListDto }) => {
			const isRemoving =
				removeMutation.isPending &&
				removeMutation.variables?.path?.mediaId === item.mediaId;
			return (
				<ListMovieItem
					item={item}
					onPress={() => handleMoviePress(item)}
					onWatch={() => handleQuickWatch(item)}
					onRemove={() =>
						handleRemove(item.mediaType as "movie" | "show", item.mediaId)
					}
					isWatching={isQuickWatchPending(item)}
					isRemoving={isRemoving}
				/>
			);
		},
		[
			handleMoviePress,
			handleQuickWatch,
			handleRemove,
			isQuickWatchPending,
			removeMutation,
		],
	);

	const keyExtractor = useCallback((item: MediaInListDto) => item.id, []);

	if (!isAuthenticated) {
		return (
			<SafeAreaView
				style={[styles.container, { backgroundColor: colors.background }]}
				edges={["top"]}
			>
				<ListHeader title="List" isDefault={false} onBack={handleBack} />
				<View style={styles.centerContent}>
					<Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>
						Please sign in to view lists
					</Text>
				</View>
			</SafeAreaView>
		);
	}

	if (isLoading) {
		return (
			<SafeAreaView
				style={[styles.container, { backgroundColor: colors.background }]}
				edges={["top"]}
			>
				<ListHeader title="" isDefault={false} onBack={handleBack} />
				<View style={styles.loadingTitleSkeleton}>
					<Skeleton width={150} height={28} />
				</View>
				<View style={styles.skeletonContainer}>
					{[1, 2, 3].map((i) => (
						<View
							key={i}
							style={[
								styles.skeletonRow,
								{ backgroundColor: colors.surfaceContainer },
							]}
						>
							<Skeleton width={80} height={120} />
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

	if (!list) {
		return (
			<SafeAreaView
				style={[styles.container, { backgroundColor: colors.background }]}
				edges={["top"]}
			>
				<ListHeader
					title="List not found"
					isDefault={false}
					onBack={handleBack}
				/>
				<ListStateView
					title="List not found"
					description="This list doesn't exist or you don't have access"
					actionText="Back to lists"
					onAction={handleBack}
				/>
			</SafeAreaView>
		);
	}

	return (
		<GestureHandlerRootView
			style={[styles.container, { backgroundColor: colors.background }]}
		>
			<SafeAreaView
				style={[styles.container, { backgroundColor: colors.background }]}
				edges={["top"]}
			>
				{movies.length === 0 ? (
					<ListHeader
						title={list.name}
						isDefault={list.isDefault}
						onBack={handleBack}
						onDelete={() => setShowDeleteConfirm(true)}
						isDeleting={deleteMutation.isPending}
					/>
				) : null}

				{movies.length === 0 && list.description && (
					<Text
						style={[styles.description, { color: colors.onSurfaceVariant }]}
					>
						{list.description}
					</Text>
				)}

				{movies.length > 0 && (
					<FlashList
						data={movies}
						renderItem={renderItem}
						keyExtractor={keyExtractor}
						contentContainerStyle={styles.listContent}
						onScroll={onScroll}
						scrollEventThrottle={16}
						ListHeaderComponent={
							<View style={styles.listHeader}>
								<ListHeader
									title={list.name}
									isDefault={list.isDefault}
									onBack={handleBack}
									onDelete={() => setShowDeleteConfirm(true)}
									isDeleting={deleteMutation.isPending}
								/>
								{list.description && (
									<Text
										style={[
											styles.description,
											{ color: colors.onSurfaceVariant },
										]}
									>
										{list.description}
									</Text>
								)}
								<Text
									style={[
										styles.resultsCount,
										{ color: colors.onSurfaceVariant },
									]}
								>
									{totalCount} item{totalCount !== 1 ? "s" : ""}
								</Text>
							</View>
						}
						ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
						onEndReached={handleEndReached}
						onEndReachedThreshold={0.35}
						refreshControl={
							<RefreshControl
								refreshing={isRefreshing}
								onRefresh={handleRefresh}
								tintColor={colors.primary}
								colors={[colors.primary]}
								progressBackgroundColor={colors.surfaceContainerHigh}
							/>
						}
						ListFooterComponent={
							isFetchingNextPage ? (
								<View style={styles.listFooter}>
									{[0, 1].map((index) => (
										<View
											key={index}
											style={[
												styles.skeletonRow,
												{ backgroundColor: colors.surfaceContainer },
											]}
										>
											<Skeleton width={80} height={120} />
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
							) : null
						}
					/>
				)}

				{movies.length === 0 ? (
					<ListStateView
						title="No items yet"
						description="Add items to this list from the search page"
						actionText="Search for items"
						onAction={() => router.push("/(tabs)/search")}
					/>
				) : null}

				<ScrollRevealHeader
					visible={showCompactHeader}
					onBack={handleBack}
					title={list.name}
				/>
			</SafeAreaView>

			<ConfirmModal
				visible={showDeleteConfirm}
				onClose={() => setShowDeleteConfirm(false)}
				onConfirm={() => {
					setShowDeleteConfirm(false);
					deleteMutation.mutate({ path: { slug } });
				}}
				title="Delete List"
				description={`Are you sure you want to delete "${list.name}"? This action cannot be undone.`}
				confirmText="Delete"
				isLoading={deleteMutation.isPending}
			/>
		</GestureHandlerRootView>
	);
}

interface ListMovieItemProps {
	item: MediaInListDto;
	onPress: () => void;
	onWatch: () => void;
	onRemove: () => void;
	isWatching: boolean;
	isRemoving: boolean;
}

function ListMovieItem({
	item,
	onPress,
	onWatch,
	onRemove,
	isWatching,
	isRemoving,
}: ListMovieItemProps) {
	const { colors } = useTheme();
	const movie = item.media;
	const posterUrl = getTmdbPosterUrl(
		movie.posterPath as string | null | undefined,
	);
	const movieTitle = movie.title as string;
	const releaseYear = movie.releaseYear as number | null | undefined;
	const scopedShow =
		item.mediaType === "show" ? parseScopedShowMediaId(item.mediaId) : null;
	const listContext =
		typeof scopedShow?.seasonNumber === "number" &&
		typeof scopedShow?.episodeNumber === "number"
			? `S${scopedShow.seasonNumber} E${scopedShow.episodeNumber}`
			: typeof scopedShow?.seasonNumber === "number"
				? `Season ${scopedShow.seasonNumber}`
				: null;

	return (
		<MediaCard
			onPress={onPress}
			cardStyle={{
				backgroundColor: colors.surfaceContainer,
				borderColor: colors.outline,
			}}
			mediaContainerStyle={{
				backgroundColor: colors.surfaceContainerHigh,
			}}
			media={
				posterUrl ? (
					<Image
						source={{ uri: posterUrl }}
						style={styles.poster}
						contentFit="cover"
					/>
				) : (
					<View
						style={[
							styles.poster,
							styles.noPoster,
							{ backgroundColor: colors.surfaceContainerHigh },
						]}
					>
						<Text
							style={[styles.noPosterText, { color: colors.onSurfaceVariant }]}
						>
							No poster
						</Text>
					</View>
				)
			}
		>
			<View style={styles.info}>
				<Text
					style={[styles.movieTitle, { color: colors.onSurface }]}
					numberOfLines={2}
				>
					{movieTitle}
				</Text>
				{releaseYear && (
					<Text style={[styles.movieYear, { color: colors.onSurfaceVariant }]}>
						{releaseYear}
					</Text>
				)}
				{listContext && (
					<Text style={[styles.movieYear, { color: colors.onSurfaceVariant }]}>
						{listContext}
					</Text>
				)}
			</View>

			<View style={styles.actionRow}>
				<TouchableOpacity
					onPress={(e) => {
						e.stopPropagation();
						onWatch();
					}}
					disabled={isWatching}
					style={[
						styles.actionButton,
						{ backgroundColor: colors.primaryContainer },
					]}
					activeOpacity={0.7}
				>
					{isWatching ? (
						<View style={styles.removeButtonContent}>
							<SpinningLoader size={14} color={colors.onPrimaryContainer} />
							<Text
								style={[
									styles.actionButtonText,
									{ color: colors.onPrimaryContainer },
								]}
							>
								Loading
							</Text>
						</View>
					) : (
						<>
							<Check size={14} color={colors.onPrimaryContainer} />
							<Text
								style={[
									styles.actionButtonText,
									{ color: colors.onPrimaryContainer },
								]}
							>
								Watch
							</Text>
						</>
					)}
				</TouchableOpacity>

				<TouchableOpacity
					onPress={(e) => {
						e.stopPropagation();
						onRemove();
					}}
					disabled={isRemoving}
					style={[styles.actionButton, { backgroundColor: colors.error }]}
					activeOpacity={0.7}
				>
					{isRemoving ? (
						<View style={styles.removeButtonContent}>
							<SpinningLoader size={14} color={colors.onError} />
							<Text
								style={[styles.actionButtonText, { color: colors.onError }]}
							>
								Loading
							</Text>
						</View>
					) : (
						<>
							<Trash2 size={14} color={colors.onError} />
							<Text
								style={[styles.actionButtonText, { color: colors.onError }]}
							>
								Remove
							</Text>
						</>
					)}
				</TouchableOpacity>
			</View>
		</MediaCard>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	loadingTitleSkeleton: {
		paddingHorizontal: spacing.lg,
		marginTop: -spacing.md,
		marginBottom: spacing.sm,
	},
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
	description: {
		fontSize: 14,
		paddingHorizontal: spacing.lg,
		marginBottom: spacing.md,
	},
	resultsCount: {
		fontSize: 14,
		paddingHorizontal: spacing.lg,
		marginBottom: spacing.sm,
	},
	listHeader: {
		marginHorizontal: -spacing.lg,
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
	emptyText: {
		fontSize: 16,
	},
	backToListsButton: {
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
		borderRadius: borderRadius.md,
	},
	backToListsText: {
		fontSize: 16,
		fontWeight: "600",
	},
	searchButton: {
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
		borderRadius: borderRadius.md,
	},
	searchButtonText: {
		fontSize: 16,
		fontWeight: "600",
	},
	skeletonContainer: {
		padding: spacing.lg,
	},
	skeletonRow: {
		flexDirection: "row",
		marginBottom: spacing.md,
		borderRadius: borderRadius.lg,
		overflow: "hidden",
	},
	skeletonContent: {
		flex: 1,
		padding: spacing.md,
		justifyContent: "center",
	},
	listFooter: {
		paddingTop: spacing.sm,
		paddingBottom: spacing.xl,
	},
	poster: {
		width: "100%",
		height: "100%",
	},
	info: {
		flex: 1,
	},
	movieTitle: {
		fontSize: 14,
		fontWeight: "600",
		marginBottom: spacing.xs,
		lineHeight: 19,
	},
	movieYear: {
		fontSize: 12,
	},
	actionRow: {
		flexDirection: "row",
		gap: spacing.sm,
		marginTop: spacing.sm,
	},
	actionButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		borderRadius: borderRadius.full,
		alignSelf: "flex-start",
	},
	actionButtonText: {
		fontSize: 12,
		fontWeight: "600",
	},
	removeButtonContent: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	noPoster: {
		justifyContent: "center",
		alignItems: "center",
	},
	noPosterText: {
		fontSize: 12,
		fontWeight: "500",
	},
});
