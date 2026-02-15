import {
	moviesControllerDiscoverMoviesOptions,
	moviesControllerGetUserMoviesOptions,
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerMarkWatchedMutation,
	moviesControllerSearchMoviesOptions,
	moviesControllerUnmarkWatchedMutation,
	type TmdbMovieResultDto,
} from "@opnshelf/api";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MovieItem } from "@/components/MovieItem";
import { SearchInput } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { borderRadius, colors, spacing } from "@/constants/theme";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/contexts/toast";
import { createTitleSlug } from "@/lib/utils";

const DEBOUNCE_MS = 300;

export default function SearchScreen() {
	const [query, setQuery] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const { user } = useAuth();
	const { showToast } = useToast();
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
		enabled: debouncedQuery.length > 0,
	});

	const { data: discoverData, isLoading: isDiscoverLoading } = useQuery({
		...moviesControllerDiscoverMoviesOptions({}),
		enabled: debouncedQuery.length === 0,
	});

	const markMutation = useMutation({
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

	return (
		<SafeAreaView style={styles.container} edges={["top"]}>
			<View style={styles.header}>
				<Text style={styles.title}>Search Movies</Text>
			</View>

			<SearchInput
				value={query}
				onChangeText={setQuery}
				placeholder="Search for a movie..."
				containerStyle={styles.searchInput}
				onClear={() => setQuery("")}
			/>

			{isLoading && renderSkeleton()}

			{error && (
				<View style={styles.centerContent}>
					<Text style={styles.errorText}>Error: {error.message}</Text>
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
						<Text style={styles.resultsCount}>
							Found {data.total_results.toLocaleString()} results
						</Text>
					}
				/>
			)}

			{data && data.results.length === 0 && debouncedQuery && (
				<View style={styles.centerContent}>
					<Text style={styles.emptyText}>
						No results found for &quot;{debouncedQuery}&quot;
					</Text>
				</View>
			)}

			{!debouncedQuery && (
				<View style={{ flex: 1 }}>
					<View style={styles.header}>
						<Text style={styles.title}>Popular Movies</Text>
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
				</View>
			)}
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.background,
	},
	header: {
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
	},
	title: {
		fontSize: 28,
		fontWeight: "bold",
		color: colors.text,
		letterSpacing: -0.5,
	},
	searchInput: {
		marginHorizontal: spacing.lg,
		marginBottom: spacing.md,
	},
	listContent: {
		padding: spacing.lg,
	},
	resultsCount: {
		fontSize: 14,
		color: colors.textMuted,
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
		color: colors.textMuted,
		textAlign: "center",
	},
	errorText: {
		fontSize: 14,
		color: colors.error,
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
