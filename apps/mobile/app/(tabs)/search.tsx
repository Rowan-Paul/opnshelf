import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	moviesControllerGetUserMoviesOptions,
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerMarkWatchedMutation,
	moviesControllerSearchMoviesOptions,
	moviesControllerUnmarkWatchedMutation,
	type TmdbMovieResultDto,
} from "@opnshelf/api";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { router } from "expo-router";
import { Check, Loader2, Plus } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/contexts/toast";
import { Badge } from "@/components/ui/Badge";
import { SearchInput } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { colors, spacing, borderRadius } from "@/constants/theme";
import { Image } from "expo-image";

const DEBOUNCE_MS = 300;
const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w342";

function createTitleSlug(title: string): string {
	return title
		.replace(/[^a-zA-Z0-9\s-]/g, "")
		.trim()
		.replace(/\s+/g, "-");
}

interface MovieItemProps {
	movie: TmdbMovieResultDto;
	isWatched: boolean;
	isMarking: boolean;
	isUnmarking: boolean;
	onToggle: (movieId: string, isWatched: boolean) => void;
	onPress: () => void;
}

const MovieItem = ({ movie, isWatched, isMarking, isUnmarking, onToggle, onPress }: MovieItemProps) => {
	const handleToggle = useCallback(() => {
		onToggle(movie.id.toString(), isWatched);
	}, [movie.id, isWatched, onToggle]);

	const isPending = isMarking || isUnmarking;

	return (
		<View style={styles.movieItem}>
			<Pressable onPress={onPress} style={styles.posterContainer}>
				{movie.poster_path ? (
					<Image
						source={{ uri: `${POSTER_BASE_URL}${movie.poster_path}` }}
						style={styles.poster}
						contentFit="cover"
						transition={200}
					/>
				) : (
					<View style={[styles.poster, styles.noPoster]}>
						<Text style={styles.noPosterText}>No poster</Text>
					</View>
				)}
				{/* Quick add button */}
				<Pressable
					onPress={handleToggle}
					disabled={isPending}
					style={[
						styles.quickAddButton,
						isWatched && styles.quickAddButtonWatched,
					]}
				>
					{isPending ? (
						<Loader2 size={16} color={colors.text} />
					) : isWatched ? (
						<Check size={16} color={colors.text} />
					) : (
						<Plus size={16} color={colors.text} />
					)}
				</Pressable>
			</Pressable>
			<Pressable onPress={onPress}>
				<Text style={styles.movieTitle} numberOfLines={2}>
					{movie.title}
				</Text>
				{movie.release_date && (
					<Text style={styles.movieYear}>
						{movie.release_date.split("-")[0]}
					</Text>
				)}
			</Pressable>
		</View>
	);
};

export default function SearchScreen() {
	const [query, setQuery] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const { user } = useAuth();
	const { showToast } = useToast();
	const queryClient = useQueryClient();

	// Debounce search query
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

	// Fetch user's tracked movies
	const { data: trackedMovies } = useQuery({
		...moviesControllerGetUserMoviesOptions({
			path: { userDid: user?.did || "" },
		}),
		enabled: !!user?.did,
	});

	// Build set of watched movie IDs
	const watchedMovieIds = useMemo(() => {
		if (!trackedMovies) return new Set<string>();
		return new Set(trackedMovies.map((m) => m.movieId));
	}, [trackedMovies]);

	// Search movies using generated hook
	const { data, isLoading, error } = useQuery({
		...moviesControllerSearchMoviesOptions({
			query: { query: debouncedQuery },
		}),
		enabled: debouncedQuery.length > 0,
	});

	// Mark watched mutation
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

	// Unmark watched mutation
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
		[user, markMutation, unmarkMutation, router, showToast]
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
		[]
	);

	const renderMovieItem: ListRenderItem<TmdbMovieResultDto> = useCallback(
		({ item }) => {
			const movieId = item.id.toString();
			const isWatched = watchedMovieIds.has(movieId);
			const isMarking =
				markMutation.isPending && markMutation.variables?.body?.movieId === movieId;
			const isUnmarking =
				unmarkMutation.isPending && unmarkMutation.variables?.path?.movieId === movieId;

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
		[watchedMovieIds, markMutation, unmarkMutation, handleToggleWatched, handleMoviePress]
	);

	const keyExtractor = useCallback((item: TmdbMovieResultDto) => item.id.toString(), []);

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
						No results found for "{debouncedQuery}"
					</Text>
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
	},
	searchInput: {
		marginHorizontal: spacing.lg,
		marginBottom: spacing.md,
	},
	listContent: {
		padding: spacing.lg,
	},
	movieItem: {
		flex: 1,
		marginBottom: spacing.lg,
		marginHorizontal: spacing.sm,
		minWidth: 140,
		maxWidth: "47%",
	},
	posterContainer: {
		aspectRatio: 2 / 3,
		borderRadius: borderRadius.lg,
		overflow: "hidden",
		backgroundColor: colors.card,
		position: "relative",
	},
	poster: {
		width: "100%",
		height: "100%",
	},
	noPoster: {
		justifyContent: "center",
		alignItems: "center",
	},
	noPosterText: {
		color: colors.textSecondary,
		fontSize: 12,
	},
	quickAddButton: {
		position: "absolute",
		top: spacing.sm,
		right: spacing.sm,
		width: 32,
		height: 32,
		borderRadius: borderRadius.full,
		backgroundColor: colors.primary,
		justifyContent: "center",
		alignItems: "center",
	},
	quickAddButtonWatched: {
		backgroundColor: colors.success,
	},
	movieTitle: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.text,
		marginTop: spacing.sm,
	},
	movieYear: {
		fontSize: 12,
		color: colors.textMuted,
		marginTop: 2,
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
	skeletonPoster: {
		aspectRatio: 2 / 3,
		borderRadius: borderRadius.lg,
		overflow: "hidden",
	},
});
