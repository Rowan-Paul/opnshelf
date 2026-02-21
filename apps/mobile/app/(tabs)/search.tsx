import {
	moviesControllerDiscoverMoviesOptions,
	moviesControllerGetUserMoviesOptions,
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerMarkWatchedMutation,
	moviesControllerSearchMoviesOptions,
	moviesControllerUnmarkWatchedMutation,
	showsControllerDiscoverShowsOptions,
	showsControllerSearchShowsOptions,
	type TmdbMovieResultDto,
	type TmdbShowResultDto,
} from "@opnshelf/api";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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

	const { data: trackedMovies } = useQuery({
		...moviesControllerGetUserMoviesOptions({
			path: { userDid: user?.did || "" },
		}),
		enabled: !!user?.did,
	});

	const watchedMovieIds = useMemo(() => {
		if (!trackedMovies) return new Set<string>();
		return new Set(trackedMovies.map((m) => m.movieId));
	}, [trackedMovies]);

	const { data, isLoading, error } = useQuery({
		...moviesControllerSearchMoviesOptions({
			query: { query: debouncedQuery },
		}),
		enabled:
			debouncedQuery.length > 0 &&
			(mediaType === "all" || mediaType === "movies"),
	});

	const {
		data: showData,
		isLoading: isShowLoading,
		error: showError,
	} = useQuery({
		...showsControllerSearchShowsOptions({
			query: { query: debouncedQuery },
		}),
		enabled:
			debouncedQuery.length > 0 &&
			(mediaType === "all" || mediaType === "shows"),
	});

	const { data: discoverData, isLoading: isDiscoverLoading } = useQuery({
		...moviesControllerDiscoverMoviesOptions({}),
		enabled:
			debouncedQuery.length === 0 &&
			(mediaType === "all" || mediaType === "movies"),
	});

	const { data: discoverShowsData, isLoading: isDiscoverShowsLoading } =
		useQuery({
			...showsControllerDiscoverShowsOptions({}),
			enabled:
				debouncedQuery.length === 0 &&
				(mediaType === "all" || mediaType === "shows"),
		});

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

	const renderMovieItem: ListRenderItem<TmdbMovieResultDto> = useCallback(
		({ item }) => {
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
					movie={item}
					isWatched={isWatched}
					isMarking={isMarking}
					isUnmarking={isUnmarking}
					onToggle={handleToggleWatched}
					onPress={() => handleMoviePress(item)}
				/>
			);
		},
		[
			watchedMovieIds,
			markMutation,
			unmarkMutation,
			handleToggleWatched,
			handleMoviePress,
		],
	);

	const keyExtractor = useCallback(
		(item: TmdbMovieResultDto) => item.id.toString(),
		[],
	);
	const showKeyExtractor = useCallback(
		(item: TmdbShowResultDto) => item.id.toString(),
		[],
	);

	const renderShowItem: ListRenderItem<TmdbShowResultDto> = useCallback(
		({ item }) => (
			<ShowItem
				show={item}
				onPress={() => handleShowPress(item as TmdbShowResultDto)}
			/>
		),
		[handleShowPress],
	);

	const renderSkeleton = () => (
		<View style={styles.skeletonGrid}>
			{[...Array(10)].map((_, i) => (
				<View key={i} style={styles.skeletonItem}>
					<Skeleton width="100%" height={210} borderRadius={borderRadius.lg} />
					<View style={{ marginTop: spacing.sm }}>
						<Skeleton width="80%" height={16} />
					</View>
					<View style={{ marginTop: spacing.xs }}>
						<Skeleton width="50%" height={14} />
					</View>
				</View>
			))}
		</View>
	);

	const showResults = useMemo(() => showData?.results || [], [showData]);
	const discoverShowResults = useMemo(
		() => discoverShowsData?.results || [],
		[discoverShowsData],
	);

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.background }]}
			edges={["top"]}
		>
			<View style={styles.header}>
				<Text style={[styles.title, { color: colors.onBackground }]}>
					Search Movies
				</Text>
			</View>

			<SearchInput
				value={query}
				onChangeText={setQuery}
				placeholder="Search for a movie..."
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

			{(isLoading || isShowLoading) && renderSkeleton()}

			{(error || showError) && (
				<View style={styles.centerContent}>
					<Text style={[styles.errorText, { color: colors.error }]}>
						Error: {(error || showError)?.message}
					</Text>
				</View>
			)}

			{data && data.results.length > 0 && (
				<FlashList
					data={data.results}
					renderItem={renderMovieItem}
					keyExtractor={keyExtractor}
					numColumns={2}
					contentContainerStyle={styles.listContent}
					extraData={watchedMovieIds}
					ListHeaderComponent={
						<Text
							style={[styles.resultsCount, { color: colors.onSurfaceVariant }]}
						>
							Found {data.total_results.toLocaleString()} results
						</Text>
					}
				/>
			)}

			{showData && showResults.length > 0 && (
				<FlashList
					data={showResults}
					renderItem={renderShowItem}
					keyExtractor={showKeyExtractor}
					numColumns={2}
					contentContainerStyle={styles.listContent}
				/>
			)}

			{data && data.results.length === 0 && debouncedQuery && (
				<View style={styles.centerContent}>
					<Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>
						No results found for &quot;{debouncedQuery}&quot;
					</Text>
				</View>
			)}

			{!debouncedQuery && (
				<View style={{ flex: 1 }}>
					<View style={styles.header}>
						<Text style={[styles.title, { color: colors.onBackground }]}>
							Popular Movies
						</Text>
					</View>
					{isDiscoverLoading && renderSkeleton()}
					{discoverData && discoverData.results.length > 0 && (
						<FlashList
							data={discoverData.results}
							renderItem={renderMovieItem}
							keyExtractor={keyExtractor}
							numColumns={2}
							contentContainerStyle={styles.listContent}
							extraData={watchedMovieIds}
						/>
					)}
					{(mediaType === "all" || mediaType === "shows") && (
						<>
							<View style={styles.header}>
								<Text style={[styles.title, { color: colors.onBackground }]}>
									Popular Shows
								</Text>
							</View>
							{isDiscoverShowsLoading && renderSkeleton()}
							{discoverShowResults.length > 0 && (
								<FlashList
									data={discoverShowResults}
									renderItem={renderShowItem}
									keyExtractor={showKeyExtractor}
									numColumns={2}
									contentContainerStyle={styles.listContent}
								/>
							)}
						</>
					)}
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
		padding: spacing.lg,
	},
	resultsCount: {
		fontSize: 14,
		marginBottom: spacing.md,
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
	skeletonGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		padding: spacing.lg,
		paddingTop: 0,
	},
	skeletonItem: {
		flex: 1,
		marginBottom: spacing.lg,
		marginHorizontal: spacing.sm,
		minWidth: 140,
		maxWidth: "47%",
	},
});
