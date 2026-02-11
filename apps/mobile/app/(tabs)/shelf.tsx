import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	moviesControllerGetUserMoviesOptions,
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerUnmarkWatchedMutation,
} from "@opnshelf/api";
import type { TrackedMovieDto } from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { BookOpen, Loader2, LogIn, LogOut, Trash2 } from "lucide-react-native";
import { useCallback } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/contexts/toast";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { colors, spacing, borderRadius } from "@/constants/theme";
import { Image } from "expo-image";
import { format } from "date-fns";

const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w342";

function createTitleSlug(title: string): string {
	return title
		.replace(/[^a-zA-Z0-9\s-]/g, "")
		.trim()
		.replace(/\s+/g, "-");
}

interface TrackedMovieItemProps {
	tracked: TrackedMovieDto;
	isRemoving: boolean;
	onRemove: (movieId: string) => void;
	onPress: () => void;
}

const TrackedMovieItem = ({ tracked, isRemoving, onRemove, onPress }: TrackedMovieItemProps) => {
	const handleRemove = useCallback(() => {
		Alert.alert(
			"Remove from Shelf",
			`Are you sure you want to remove "${tracked.movie.title}" from your shelf?`,
			[
				{ text: "Cancel", style: "cancel" },
				{ text: "Remove", style: "destructive", onPress: () => onRemove(tracked.movieId) },
			]
		);
	}, [tracked.movie.title, tracked.movieId, onRemove]);

	return (
		<View style={styles.movieItem}>
			<Pressable onPress={onPress} style={styles.posterContainer}>
				{tracked.movie.posterPath ? (
					<Image
						source={{ uri: `${POSTER_BASE_URL}${tracked.movie.posterPath}` }}
						style={styles.poster}
						contentFit="cover"
						transition={200}
					/>
				) : (
					<View style={[styles.poster, styles.noPoster]}>
						<Text style={styles.noPosterText}>No poster</Text>
					</View>
				)}
				{/* Remove button */}
				<Pressable
					onPress={handleRemove}
					disabled={isRemoving}
					style={styles.removeButton}
				>
					{isRemoving ? (
						<Loader2 size={16} color={colors.text} />
					) : (
						<Trash2 size={16} color={colors.error} />
					)}
				</Pressable>
			</Pressable>
			<Pressable onPress={onPress}>
				<Text style={styles.movieTitle} numberOfLines={2}>
					{tracked.movie.title}
				</Text>
				{tracked.movie.releaseYear && (
					<Text style={styles.movieYear}>{tracked.movie.releaseYear}</Text>
				)}
				{tracked.watchedDate && (
					<View style={styles.watchedInfo}>
						<Text style={styles.watchedDate}>
							Watched {format(new Date(tracked.watchedDate), "MMM d, yyyy HH:mm")}
						</Text>
					</View>
				)}
			</Pressable>
		</View>
	);
};

export default function ShelfScreen() {
	const { user, isLoading: isAuthLoading, isAuthenticated, logout } = useAuth();
	const { showToast } = useToast();
	const queryClient = useQueryClient();

	// Fetch user's tracked movies
	const { data: trackedMovies, isLoading: isMoviesLoading } = useQuery({
		...moviesControllerGetUserMoviesOptions({
			path: { userDid: user?.did || "" },
		}),
		enabled: !!user?.did,
	});

	// Remove from shelf mutation
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

	const handleRemove = useCallback(
		(movieId: string) => {
			unmarkMutation.mutate({ path: { movieId } });
		},
		[unmarkMutation]
	);

	const handleMoviePress = useCallback(
		(tracked: TrackedMovieDto) => {
			router.push({
				pathname: "/movie/[id]",
				params: {
					id: tracked.movieId,
					title: createTitleSlug(tracked.movie.title),
				},
			});
		},
		[]
	);

	const renderMovieItem = useCallback(
		({ item }: { item: TrackedMovieDto }) => {
			const isRemoving =
				unmarkMutation.isPending && unmarkMutation.variables?.path?.movieId === item.movieId;

			return (
				<TrackedMovieItem
					tracked={item}
					isRemoving={isRemoving}
					onRemove={handleRemove}
					onPress={() => handleMoviePress(item)}
				/>
			);
		},
		[unmarkMutation, handleRemove, handleMoviePress]
	);

	const keyExtractor = useCallback((item: TrackedMovieDto) => item.id, []);

	// Loading state
	if (isAuthLoading) {
		return (
			<SafeAreaView style={styles.container} edges={["top"]}>
				<View style={styles.header}>
					<Text style={styles.title}>My Shelf</Text>
				</View>
				<View style={styles.skeletonGrid}>
					{[...Array(8)].map((_, i) => (
						<View key={i} style={styles.skeletonItem}>
							<View style={[styles.skeletonPoster, { backgroundColor: colors.cardMuted }]} />
							<View style={{ marginTop: spacing.sm }}>
								<Skeleton width="80%" height={16} />
							</View>
							<View style={{ marginTop: spacing.xs }}>
								<Skeleton width="50%" height={14} />
							</View>
						</View>
					))}
				</View>
			</SafeAreaView>
		);
	}

	// Not authenticated state
	if (!isAuthenticated) {
		return (
			<SafeAreaView style={styles.container} edges={["top"]}>
				<View style={styles.centerContent}>
					<Card style={styles.authCard}>
						<CardHeader>
							<BookOpen size={64} color={colors.primary} style={styles.authIcon} />
							<Text style={styles.authTitle}>My Shelf</Text>
							<Text style={styles.authDescription}>
								Sign in to track movies you&apos;ve watched
							</Text>
						</CardHeader>
						<CardContent>
							<Button size="lg" onPress={() => router.push("/login")}>
								<LogIn size={20} color={colors.text} style={styles.buttonIcon} />
								<Text style={styles.buttonText}>Sign in</Text>
							</Button>
						</CardContent>
					</Card>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.container} edges={["top"]}>
			<View style={styles.header}>
				<View style={styles.headerContent}>
					<BookOpen size={32} color={colors.primary} />
					<Text style={styles.title}>My Shelf</Text>
				</View>
				<Pressable
					onPress={async () => {
						await logout();
						showToast("Logged out successfully", "success");
					}}
					style={styles.logoutButton}
				>
					<LogOut size={20} color={colors.textMuted} />
					<Text style={styles.logoutButtonText}>Logout</Text>
				</Pressable>
			</View>

			{isMoviesLoading && (
				<View style={styles.skeletonGrid}>
					{[...Array(8)].map((_, i) => (
						<View key={i} style={styles.skeletonItem}>
							<View style={[styles.skeletonPoster, { backgroundColor: colors.cardMuted }]} />
							<View style={{ marginTop: spacing.sm }}>
								<Skeleton width="80%" height={16} />
							</View>
							<View style={{ marginTop: spacing.xs }}>
								<Skeleton width="50%" height={14} />
							</View>
						</View>
					))}
				</View>
			)}

			{trackedMovies && trackedMovies.length > 0 && (
				<FlashList
					data={trackedMovies}
					renderItem={renderMovieItem}
					keyExtractor={keyExtractor}
					numColumns={2}
					contentContainerStyle={styles.listContent}
					ListHeaderComponent={
						<Text style={styles.resultsCount}>
							{trackedMovies.length} movie
							{trackedMovies.length !== 1 ? "s" : ""} watched
						</Text>
					}
				/>
			)}

			{trackedMovies && trackedMovies.length === 0 && (
				<View style={styles.centerContent}>
					<Card style={styles.emptyCard}>
						<CardHeader>
							<BookOpen size={64} color={colors.textSecondary} style={styles.emptyIcon} />
							<Text style={styles.emptyTitle}>Your shelf is empty</Text>
							<Text style={styles.emptyDescription}>
								Start tracking movies you&apos;ve watched
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
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	headerContent: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
	logoutButton: {
		padding: spacing.sm,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
	logoutButtonText: {
		color: colors.textMuted,
		fontSize: 16,
		fontWeight: "600",
	},
	title: {
		fontSize: 28,
		fontWeight: "bold",
		color: colors.text,
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
	removeButton: {
		position: "absolute",
		top: spacing.sm,
		right: spacing.sm,
		width: 32,
		height: 32,
		borderRadius: borderRadius.full,
		backgroundColor: colors.card,
		justifyContent: "center",
		alignItems: "center",
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
	watchedInfo: {
		flexDirection: "row",
		alignItems: "center",
		marginTop: 4,
		gap: spacing.xs,
	},
	watchedDate: {
		fontSize: 11,
		color: colors.textMuted,
	},
	watchCount: {
		paddingHorizontal: 6,
		paddingVertical: 2,
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
	authCard: {
		width: "100%",
		maxWidth: 400,
		alignItems: "center",
	},
	authIcon: {
		marginBottom: spacing.md,
	},
	authTitle: {
		fontSize: 24,
		fontWeight: "bold",
		color: colors.text,
		textAlign: "center",
		marginBottom: spacing.sm,
	},
	authDescription: {
		fontSize: 16,
		color: colors.textMuted,
		textAlign: "center",
	},
	emptyCard: {
		width: "100%",
		maxWidth: 400,
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
	buttonIcon: {
		marginRight: spacing.sm,
	},
	buttonText: {
		color: colors.text,
		fontSize: 16,
		fontWeight: "600",
	},
	skeletonGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		padding: spacing.lg,
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
