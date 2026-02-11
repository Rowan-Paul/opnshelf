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
	Pressable,
	StyleSheet,
	Text,
	View,
	Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/contexts/toast";
import { SearchInput } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { colors, spacing, borderRadius } from "@/constants/theme";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withSpring,
	withTiming,
	withRepeat,
	Easing,
} from "react-native-reanimated";

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

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Spinning loader component
const SpinningLoader = ({ size, color }: { size: number; color: string }) => {
	const rotation = useSharedValue(0);

	rotation.value = withRepeat(
		withTiming(360, { duration: 1000, easing: Easing.linear }),
		-1,
		false
	);

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ rotate: `${rotation.value}deg` }],
	}));

	return (
		<Animated.View style={animatedStyle}>
			<Loader2 size={size} color={color} />
		</Animated.View>
	);
};

const MovieItem = ({ movie, isWatched, isMarking, isUnmarking, onToggle, onPress }: MovieItemProps) => {
	const scale = useSharedValue(1);
	const opacity = useSharedValue(1);

	const handleToggle = useCallback((e: any) => {
		e.stopPropagation();
		
		if (Platform.OS !== "web") {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
		}
		
		onToggle(movie.id.toString(), isWatched);
	}, [movie.id, isWatched, onToggle]);

	const handlePressIn = useCallback(() => {
		scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
		opacity.value = withTiming(0.8, { duration: 100 });
	}, [scale, opacity]);

	const handlePressOut = useCallback(() => {
		scale.value = withSpring(1, { damping: 15, stiffness: 300 });
		opacity.value = withTiming(1, { duration: 100 });
	}, [scale, opacity]);

	const animatedButtonStyle = useAnimatedStyle(() => ({
		transform: [{ scale: scale.value }],
		opacity: opacity.value,
	}));

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
				
				{/* Quick add button - icon only, top-right with expanded touch area */}
				<AnimatedPressable
					onPress={handleToggle}
					onPressIn={handlePressIn}
					onPressOut={handlePressOut}
					disabled={isPending}
					hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
					style={[
						styles.actionButton,
						isWatched && styles.actionButtonWatched,
						animatedButtonStyle,
					]}
				>
					<View style={styles.iconContainer}>
						{isPending ? (
							<SpinningLoader size={22} color={colors.text} />
						) : isWatched ? (
							<Check size={22} color={colors.text} strokeWidth={2.5} />
						) : (
							<Plus size={22} color={colors.text} strokeWidth={2.5} />
						)}
					</View>
				</AnimatedPressable>
			</Pressable>
			<Pressable onPress={onPress} style={styles.titleContainer}>
				<Text style={styles.movieTitle} numberOfLines={2}>
					{movie.title}
				</Text>
				{movie.release_date && (
					<View style={styles.yearBadge}>
						<Text style={styles.movieYear}>
							{movie.release_date.split("-")[0]}
						</Text>
					</View>
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
		[user, markMutation, unmarkMutation, showToast]
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
						No results found for &quot;{debouncedQuery}&quot;
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
		letterSpacing: -0.5,
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
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 8,
		elevation: 8,
	},
	poster: {
		width: "100%",
		height: "100%",
	},
	noPoster: {
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: colors.cardMuted,
	},
	noPosterText: {
		color: colors.textSecondary,
		fontSize: 12,
		fontWeight: "500",
	},
	// Icon-only action button - top right
	actionButton: {
		position: "absolute",
		top: spacing.sm,
		right: spacing.sm,
		width: 44,
		height: 44,
		borderRadius: borderRadius.full,
		backgroundColor: colors.primary,
		justifyContent: "center",
		alignItems: "center",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 3 },
		shadowOpacity: 0.4,
		shadowRadius: 5,
		elevation: 5,
	},
	actionButtonWatched: {
		backgroundColor: colors.success,
	},
	iconContainer: {
		width: 22,
		height: 22,
		justifyContent: "center",
		alignItems: "center",
	},
	titleContainer: {
		marginTop: spacing.sm,
		minHeight: 40,
	},
	movieTitle: {
		fontSize: 15,
		fontWeight: "600",
		color: colors.text,
		letterSpacing: -0.2,
		lineHeight: 20,
		flexWrap: "wrap",
	},
	yearBadge: {
		marginTop: spacing.xs,
	},
	movieYear: {
		fontSize: 12,
		color: colors.textMuted,
		fontWeight: "500",
		letterSpacing: 0.5,
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
