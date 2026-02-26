import {
	moviesControllerGetUserMoviesOptions,
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerMarkWatchedMutation,
	moviesControllerUnmarkWatchedMutation,
	searchControllerDiscoverAll,
	searchControllerSearchAll,
	showsControllerGetUserShowsOptions,
	showsControllerGetUserShowsQueryKey,
	showsControllerMarkShowWatchedMutation,
	showsControllerUnmarkWatchedMutation,
	type TmdbMovieResultDto,
	type UnifiedSearchResultDto,
} from "@opnshelf/api";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Dimensions,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MovieItem } from "@/components/MovieItem";
import { ShowItem } from "@/components/ShowItem";
import { SearchInput } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { borderRadius, spacing } from "@/constants/spacing";
import { useAuth } from "@/contexts/auth";
import { useTheme } from "@/contexts/theme";
import { useToast } from "@/contexts/toast";
import { createTitleSlug } from "@/lib/utils";

const DEBOUNCE_MS = 300;
const SCREEN_WIDTH = Dimensions.get("window").width;
const GAP = spacing.md;
const H_PADDING = spacing.lg;
const COLUMNS = 2;
const ITEM_MARGIN = GAP / 2;
const ITEM_WIDTH = (SCREEN_WIDTH - H_PADDING * 2) / COLUMNS - ITEM_MARGIN * 2;

export default function SearchScreen() {
	const [query, setQuery] = useState("");
	const [mediaType, setMediaType] = useState<"all" | "movies" | "shows">("all");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const { user } = useAuth();
	const { showToast } = useToast();
	const { colors } = useTheme();
	const queryClient = useQueryClient();

	useEffect(() => {
		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}

		debounceRef.current = setTimeout(() => {
			setDebouncedQuery(query.trim());
		}, DEBOUNCE_MS);

		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, [query]);

	const {
		data: trackedMovies,
		isRefetching: isTrackedMoviesRefetching,
		refetch: refetchTrackedMovies,
	} = useQuery({
		...moviesControllerGetUserMoviesOptions({
			path: { userDid: user?.did || "" },
		}),
		enabled: !!user?.did,
	});

	const {
		data: trackedShows,
		isRefetching: isTrackedShowsRefetching,
		refetch: refetchTrackedShows,
	} = useQuery({
		...showsControllerGetUserShowsOptions({
			path: { userDid: user?.did || "" },
		}),
		enabled: !!user?.did,
	});

	const watchedMovieIds = useMemo(() => {
		if (!trackedMovies) return new Set<string>();
		return new Set(trackedMovies.map((m) => m.movieId));
	}, [trackedMovies]);

	const watchedShowIds = useMemo(() => {
		if (!trackedShows) return new Set<string>();
		return new Set(trackedShows.map((s) => s.showId));
	}, [trackedShows]);

	const {
		data: searchData,
		isLoading: isSearchLoading,
		isRefetching: isSearchRefetching,
		error: searchError,
		refetch: refetchSearch,
	} = useQuery({
		queryKey: ["search", "all", debouncedQuery],
		queryFn: async () => {
			const { data } = await searchControllerSearchAll({
				query: { query: debouncedQuery },
				throwOnError: true,
			});
			return data;
		},
		enabled: debouncedQuery.length > 0,
	});

	const {
		data: discoverData,
		isLoading: isDiscoverLoading,
		isRefetching: isDiscoverRefetching,
		error: discoverError,
		refetch: refetchDiscover,
	} = useQuery({
		queryKey: ["search", "discover"],
		queryFn: async () => {
			const { data } = await searchControllerDiscoverAll({
				throwOnError: true,
			});
			return data;
		},
		enabled: debouncedQuery.length === 0,
	});

	const results: UnifiedSearchResultDto[] = useMemo(() => {
		const data = debouncedQuery.length > 0 ? searchData : discoverData;
		return data?.results ?? [];
	}, [debouncedQuery, searchData, discoverData]);

	const total = useMemo(() => {
		const data = debouncedQuery.length > 0 ? searchData : discoverData;
		return data?.total_results ?? results.length;
	}, [debouncedQuery, searchData, discoverData, results.length]);

	const showTotal = debouncedQuery.length > 0 && total > 0;
	const isDiscoverMode = debouncedQuery.length === 0;

	const isLoading =
		debouncedQuery.length > 0 ? isSearchLoading : isDiscoverLoading;
	const isRefreshing =
		(isTrackedMoviesRefetching ||
			isTrackedShowsRefetching ||
			(debouncedQuery.length > 0
				? isSearchRefetching
				: isDiscoverRefetching)) &&
		!isLoading;
	const error = debouncedQuery.length > 0 ? searchError : discoverError;
	const showError = !isLoading && !!error;

	const handleRefresh = useCallback(async () => {
		const refetchPromises: Promise<unknown>[] = [];
		if (user?.did) {
			refetchPromises.push(refetchTrackedMovies(), refetchTrackedShows());
		}
		if (debouncedQuery.length > 0) {
			refetchPromises.push(refetchSearch());
		} else {
			refetchPromises.push(refetchDiscover());
		}
		await Promise.all(refetchPromises);
	}, [
		user?.did,
		debouncedQuery,
		refetchTrackedMovies,
		refetchTrackedShows,
		refetchSearch,
		refetchDiscover,
	]);

	const filteredResults = useMemo(() => {
		if (mediaType === "movies") {
			return results.filter((r) => r.media_type === "movie");
		}
		if (mediaType === "shows") {
			return results.filter((r) => r.media_type === "tv");
		}
		return results;
	}, [results, mediaType]);
	const showNoResults = !isLoading && !error && filteredResults.length === 0;

	const markMutation = useMutation({
		mutationKey: ["movies", "markWatched"],
		...moviesControllerMarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetUserMoviesQueryKey({
					path: { userDid: user?.did || "" },
				}),
			});
			showToast("Added to your shelf", "success");
		},
		onError: () => {
			showToast("Failed to add to shelf. Please try again.", "error");
		},
	});

	const unmarkMutation = useMutation({
		mutationKey: ["movies", "unmarkWatched"],
		...moviesControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetUserMoviesQueryKey({
					path: { userDid: user?.did || "" },
				}),
			});
			showToast("Removed from your shelf", "success");
		},
		onError: () => {
			showToast("Failed to remove from shelf. Please try again.", "error");
		},
	});

	const markShowMutation = useMutation({
		mutationKey: ["shows", "markShowWatched"],
		...showsControllerMarkShowWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({
					path: { userDid: user?.did || "" },
				}),
			});
			showToast("Added to your shelf", "success");
		},
		onError: () => {
			showToast("Failed to add to shelf. Please try again.", "error");
		},
	});

	const unmarkShowMutation = useMutation({
		mutationKey: ["shows", "unmarkWatched"],
		...showsControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({
					path: { userDid: user?.did || "" },
				}),
			});
			showToast("Removed from your shelf", "success");
		},
		onError: () => {
			showToast("Failed to remove from shelf. Please try again.", "error");
		},
	});

	const handleToggleWatched = useCallback(
		(movieId: string, isWatched: boolean) => {
			if (!user) {
				showToast("Sign in to track movies", "info");
				router.push("/login");
				return;
			}

			if (isWatched) {
				unmarkMutation.mutate({ path: { movieId } });
			} else {
				markMutation.mutate({ body: { movieId } });
			}
		},
		[user, markMutation, unmarkMutation, showToast],
	);

	const handleToggleShowWatched = useCallback(
		(showId: string, isWatched: boolean) => {
			if (!user) {
				showToast("Sign in to track shows", "info");
				router.push("/login");
				return;
			}

			if (isWatched) {
				unmarkShowMutation.mutate({ path: { showId }, query: { mode: "all" } });
			} else {
				markShowMutation.mutate({ body: { showId } });
			}
		},
		[user, markShowMutation, unmarkShowMutation, showToast],
	);

	const handleMoviePress = useCallback(
		(movie: { id: number; title: string }) => {
			router.push({
				pathname: "/movie/[id]",
				params: {
					id: movie.id.toString(),
					title: createTitleSlug(movie.title),
				},
			});
		},
		[],
	);

	const handleShowPress = useCallback((show: { id: number; name: string }) => {
		router.push({
			pathname: "/show/[id]",
			params: {
				id: show.id.toString(),
				title: createTitleSlug(show.name),
			},
		});
	}, []);

	const renderItem: ListRenderItem<UnifiedSearchResultDto> = useCallback(
		({ item }) => {
			if (item.media_type === "movie") {
				const movie: TmdbMovieResultDto = {
					id: item.id,
					title: item.title ?? "",
					poster_path: item.poster_path,
					backdrop_path: item.backdrop_path,
					release_date: item.release_date,
					overview: item.overview,
				};
				const movieId = item.id.toString();
				const isWatched = watchedMovieIds.has(movieId);
				const isMarking =
					markMutation.isPending &&
					markMutation.variables?.body?.movieId === movieId;
				const isUnmarking =
					unmarkMutation.isPending &&
					unmarkMutation.variables?.path?.movieId === movieId;

				return (
					<MovieItem
						movie={movie}
						isWatched={isWatched}
						isMarking={isMarking}
						isUnmarking={isUnmarking}
						onToggle={handleToggleWatched}
						onPress={() => handleMoviePress(movie)}
						width={ITEM_WIDTH}
					/>
				);
			} else {
				const show = {
					id: item.id,
					name: item.name ?? "",
					poster_path: item.poster_path,
					backdrop_path: item.backdrop_path,
					first_air_date: item.first_air_date,
					overview: item.overview,
				};
				const showId = item.id.toString();
				const isWatched = watchedShowIds.has(showId);
				const isMarking =
					markShowMutation.isPending &&
					markShowMutation.variables?.body?.showId === showId;
				const isUnmarking =
					unmarkShowMutation.isPending &&
					unmarkShowMutation.variables?.path?.showId === showId;

				return (
					<ShowItem
						show={show}
						isWatched={isWatched}
						isMarking={isMarking}
						isUnmarking={isUnmarking}
						onToggle={handleToggleShowWatched}
						onPress={() =>
							handleShowPress(show as { id: number; name: string })
						}
						width={ITEM_WIDTH}
					/>
				);
			}
		},
		[
			watchedMovieIds,
			markMutation,
			unmarkMutation,
			watchedShowIds,
			markShowMutation,
			unmarkShowMutation,
			handleToggleWatched,
			handleToggleShowWatched,
			handleMoviePress,
			handleShowPress,
		],
	);

	const keyExtractor = useCallback(
		(item: UnifiedSearchResultDto) => `${item.media_type}-${item.id}`,
		[],
	);

	const renderSkeleton = () => (
		<View style={styles.skeletonContainer}>
			<View style={styles.skeletonRow}>
				{[...Array(2)].map((_, i) => (
					<View key={i} style={styles.skeletonItem}>
						<Skeleton
							width="100%"
							height={210}
							borderRadius={borderRadius.lg}
						/>
						<View style={{ marginTop: spacing.sm }}>
							<Skeleton width="80%" height={16} />
						</View>
						<View style={{ marginTop: spacing.xs }}>
							<Skeleton width="50%" height={14} />
						</View>
					</View>
				))}
			</View>
			<View style={styles.skeletonRow}>
				{[...Array(2)].map((_, i) => (
					<View key={i} style={styles.skeletonItem}>
						<Skeleton
							width="100%"
							height={210}
							borderRadius={borderRadius.lg}
						/>
						<View style={{ marginTop: spacing.sm }}>
							<Skeleton width="80%" height={16} />
						</View>
						<View style={{ marginTop: spacing.xs }}>
							<Skeleton width="50%" height={14} />
						</View>
					</View>
				))}
			</View>
		</View>
	);

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.background }]}
			edges={["top"]}
		>
			<View style={styles.header}>
				<Text style={[styles.title, { color: colors.onBackground }]}>
					Search
				</Text>
			</View>

			<SearchInput
				value={query}
				onChangeText={setQuery}
				placeholder="Search movies and shows..."
				containerStyle={styles.searchInput}
				onClear={() => setQuery("")}
			/>

			<View style={styles.filterRow}>
				{(["all", "movies", "shows"] as const).map((tab) => (
					<Pressable
						key={tab}
						onPress={() => setMediaType(tab)}
						style={[
							styles.filterButton,
							{
								backgroundColor:
									mediaType === tab ? colors.primary : colors.surfaceContainer,
							},
						]}
					>
						<Text
							style={{
								color: mediaType === tab ? colors.onPrimary : colors.onSurface,
								fontWeight: "600",
								textTransform: "capitalize",
							}}
						>
							{tab}
						</Text>
					</Pressable>
				))}
			</View>

			{isLoading &&
				(isDiscoverMode ? (
					<View style={styles.centerContent}>
						<ActivityIndicator size="large" color={colors.primary} />
					</View>
				) : (
					renderSkeleton()
				))}

			{showError && (
				<View style={styles.centerContent}>
					<Text style={[styles.errorText, { color: colors.error }]}>
						Error: {(error as Error).message}
					</Text>
				</View>
			)}

			{!isLoading && filteredResults.length > 0 && (
				<FlashList
					data={filteredResults}
					renderItem={renderItem}
					keyExtractor={keyExtractor}
					numColumns={2}
					contentContainerStyle={styles.listContent}
					extraData={{
						watchedMovieIds,
						watchedShowIds,
						markMutation,
						unmarkMutation,
						markShowMutation,
						unmarkShowMutation,
					}}
					ListHeaderComponent={
						showTotal ? (
							<Text
								style={[
									styles.resultsCount,
									{ color: colors.onSurfaceVariant },
								]}
							>
								Found {total.toLocaleString()} results
							</Text>
						) : null
					}
					refreshing={isRefreshing}
					onRefresh={handleRefresh}
				/>
			)}

			{showNoResults && debouncedQuery && (
				<View style={styles.centerContent}>
					<Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>
						No results found for &quot;{debouncedQuery}&quot;
					</Text>
				</View>
			)}

			{showNoResults && !debouncedQuery && (
				<View style={styles.centerContent}>
					<Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>
						No popular content available
					</Text>
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
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
	},
	title: {
		fontSize: 28,
		fontWeight: "bold",
		letterSpacing: -0.5,
	},
	searchInput: {
		marginHorizontal: spacing.lg,
		marginBottom: spacing.md,
	},
	filterRow: {
		flexDirection: "row",
		gap: spacing.sm,
		marginHorizontal: spacing.lg,
		marginBottom: spacing.md,
	},
	filterButton: {
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		borderRadius: borderRadius.full,
	},
	listContent: {
		paddingVertical: spacing.lg,
		paddingHorizontal: H_PADDING,
	},
	resultsCount: {
		fontSize: 14,
		marginBottom: spacing.md,
		paddingHorizontal: spacing.sm,
	},
	centerContent: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: spacing.xl,
	},
	emptyText: {
		fontSize: 16,
		textAlign: "center",
	},
	errorText: {
		fontSize: 14,
		textAlign: "center",
	},
	skeletonContainer: {
		paddingHorizontal: H_PADDING,
	},
	skeletonRow: {
		flexDirection: "row",
		gap: GAP,
	},
	skeletonItem: {
		flex: 1,
		marginBottom: spacing.lg,
	},
});
