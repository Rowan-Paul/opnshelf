import type { TrackedMovieDto } from "@opnshelf/api";
import {
	moviesControllerGetUserMoviesOptions,
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerUnmarkWatchedMutation,
} from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { BookOpen } from "lucide-react-native";
import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MovieCard } from "@/components/MovieCard";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { borderRadius, colors, spacing } from "@/constants/theme";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/contexts/toast";
import { useUserSettings } from "@/hooks/useUserSettings";
import { createTitleSlug } from "@/lib/utils";

export default function ShelfScreen() {
	const { user } = useAuth();
	const { showToast } = useToast();
	const queryClient = useQueryClient();
	const { timezone, is24Hour } = useUserSettings();

	const { data: trackedMovies, isLoading: isMoviesLoading } = useQuery({
		...moviesControllerGetUserMoviesOptions({
			path: { userDid: user?.did || "" },
		}),
		enabled: !!user?.did,
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

	const handleRemove = useCallback(
		(movieId: string) => {
			unmarkMutation.mutate({ path: { movieId } });
		},
		[unmarkMutation],
	);

	const handleMoviePress = useCallback((tracked: TrackedMovieDto) => {
		router.push({
			pathname: "/movie/[id]",
			params: {
				id: tracked.movieId,
				title: createTitleSlug(tracked.movie.title),
			},
		});
	}, []);

	const renderItem = useCallback(
		({ item }: { item: TrackedMovieDto }) => {
			const isRemoving =
				unmarkMutation.isPending &&
				unmarkMutation.variables?.path?.movieId === item.movieId;

			return (
				<MovieCard
					tracked={item}
					isRemoving={isRemoving}
					onRemove={handleRemove}
					onPress={() => handleMoviePress(item)}
					timezone={timezone}
					is24Hour={is24Hour}
				/>
			);
		},
		[unmarkMutation, handleRemove, handleMoviePress, timezone, is24Hour],
	);

	const keyExtractor = useCallback((item: TrackedMovieDto) => item.id, []);

	if (isMoviesLoading) {
		return (
			<SafeAreaView
				style={styles.container}
				edges={["left", "right", "bottom"]}
			>
				<View style={styles.skeletonContainer}>
					{[...Array(6)].map((_, i) => (
						<View key={i} style={styles.skeleton}>
							<View
								style={[
									styles.skeletonPoster,
									{ backgroundColor: colors.cardMuted },
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
		<SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
			{trackedMovies && trackedMovies.length > 0 && (
				<>
					<Text style={styles.resultsCount}>
						{trackedMovies.length} movie{trackedMovies.length !== 1 ? "s" : ""}{" "}
						watched
					</Text>
					<FlashList
						data={trackedMovies}
						renderItem={renderItem}
						keyExtractor={keyExtractor}
						contentContainerStyle={styles.listContent}
						ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
					/>
				</>
			)}

			{trackedMovies && trackedMovies.length === 0 && (
				<View style={styles.centerContent}>
					<Card style={styles.emptyCard}>
						<CardHeader style={styles.emptyCardHeader}>
							<BookOpen
								size={64}
								color={colors.textSecondary}
								style={styles.emptyIcon}
							/>
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
	resultsCount: {
		fontSize: 14,
		color: colors.textMuted,
		marginHorizontal: spacing.lg,
		marginBottom: spacing.sm,
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
	skeleton: {
		flexDirection: "row",
		marginBottom: spacing.md,
		backgroundColor: colors.card,
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
