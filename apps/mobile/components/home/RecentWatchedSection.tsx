import { Image } from "expo-image";
import { router } from "expo-router";
import { Loader2, Trash2 } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import type { DashboardShelfItem } from "@/components/home/types";
import { createTitleSlug, getTmdbPosterUrl } from "@/lib/utils";

type RecentWatchedSectionProps = {
	isLoading: boolean;
	recentWatched: DashboardShelfItem[];
	formatDate: (date: string, opts?: { includeTime?: boolean }) => string;
	onRemoveMovie: (trackedMovieId: string) => void;
	onRemoveEpisode: (trackedEpisodeId: string) => void;
	deletingMovieId?: string;
	deletingEpisodeId?: string;
};

export function RecentWatchedSection({
	isLoading,
	recentWatched,
	formatDate,
	onRemoveMovie,
	onRemoveEpisode,
	deletingMovieId,
	deletingEpisodeId,
}: RecentWatchedSectionProps) {
	const { colors } = useTheme();

	return (
		<View style={styles.section}>
			<View style={styles.sectionHeader}>
				<Text style={[styles.sectionTitle, { color: colors.onBackground }]}>Recent Watched</Text>
				<Pressable onPress={() => router.push("/(tabs)/profile/shelf")}>
					<Text style={[styles.sectionLink, { color: colors.primary }]}>View shelf</Text>
				</Pressable>
			</View>
			{isLoading ? (
				<View style={styles.sectionSkeleton}>
					{[1, 2, 3].map((i) => (
						<Skeleton key={i} width="100%" height={100} style={{ marginBottom: spacing.sm }} />
					))}
				</View>
			) : recentWatched.length > 0 ? (
				<View style={styles.recentList}>
					{recentWatched.map((tracked) => {
						const watchDate = tracked.watchedDate ?? tracked.createdAt;
						const formattedDate = formatDate(watchDate, { includeTime: false });
						const posterUrl = getTmdbPosterUrl(tracked.posterPath);
						const isEpisode = tracked.type === "episode";
						const isDeleting = isEpisode
							? deletingEpisodeId === tracked.id
							: deletingMovieId === tracked.id;

						return (
							<Pressable
								key={tracked.id}
								onPress={() =>
									isEpisode
										? router.push({
												pathname: "/show/[id]/season/[seasonNumber]/episode/[episodeNumber]",
												params: {
													id: tracked.showId,
													seasonNumber: String(tracked.seasonNumber),
													episodeNumber: String(tracked.episodeNumber),
												},
										  })
										: router.push({
												pathname: "/movie/[id]",
												params: {
													id: tracked.movieId,
													title: createTitleSlug(tracked.title || "movie"),
												},
										  })
								}
								style={[
									styles.recentItem,
									{
										backgroundColor: colors.surfaceContainer,
										borderColor: colors.outline,
									},
								]}
							>
								<View style={[styles.recentPoster, { backgroundColor: colors.surfaceContainerHigh }]}> 
									{posterUrl ? (
										<Image source={{ uri: posterUrl }} style={styles.recentPosterImage} contentFit="cover" transition={150} />
									) : (
										<Text style={[styles.recentPosterFallback, { color: colors.onSurfaceVariant }]}>No poster</Text>
									)}
								</View>
								<View style={styles.recentMeta}>
									<Text style={[styles.recentTitle, { color: colors.onSurface }]} numberOfLines={2}>
										{isEpisode ? tracked.showTitle : tracked.title}
									</Text>
									<Text style={[styles.recentDate, { color: colors.onSurfaceVariant }]}>
										{isEpisode ? `S${tracked.seasonNumber} E${tracked.episodeNumber} • ` : ""}
										Watched {formattedDate}
									</Text>
									<Pressable
										onPress={(event) => {
											event.stopPropagation();
											if (isEpisode) {
												onRemoveEpisode(tracked.id);
											} else {
												onRemoveMovie(tracked.id);
											}
										}}
										disabled={isDeleting}
										style={[
											styles.removeButton,
											{ backgroundColor: colors.errorContainer },
										]}
									>
										{isDeleting ? (
											<Loader2 size={14} color={colors.onErrorContainer} />
										) : (
											<Trash2 size={14} color={colors.onErrorContainer} />
										)}
										<Text style={[styles.removeButtonText, { color: colors.onErrorContainer }]}>Remove</Text>
									</Pressable>
								</View>
							</Pressable>
						);
					})}
				</View>
			) : (
				<Card>
					<CardHeader>
						<Text style={[styles.emptyTitle, { color: colors.onSurface }]}>No items watched yet</Text>
					</CardHeader>
					<CardContent>
						<Text style={[styles.emptyDescription, { color: colors.onSurfaceVariant }]}> 
							Start adding watched items and your activity appears here.
						</Text>
						<Button onPress={() => router.push("/(tabs)/search")} style={styles.emptyButton}>
							<Text style={[styles.buttonText, { color: colors.onPrimary }]}>Search</Text>
						</Button>
					</CardContent>
				</Card>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	section: {
		marginBottom: spacing.xl,
	},
	sectionHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: spacing.sm,
	},
	sectionTitle: {
		fontSize: 22,
		fontWeight: "700",
	},
	sectionLink: {
		fontSize: 14,
		fontWeight: "600",
	},
	sectionSkeleton: {
		marginTop: spacing.sm,
	},
	recentList: {
		gap: spacing.sm,
	},
	recentItem: {
		flexDirection: "row",
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		overflow: "hidden",
	},
	recentPoster: {
		width: 68,
		height: 100,
		alignItems: "center",
		justifyContent: "center",
	},
	recentPosterImage: {
		width: "100%",
		height: "100%",
	},
	recentPosterFallback: {
		fontSize: 10,
		fontWeight: "600",
	},
	recentMeta: {
		flex: 1,
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.md,
		justifyContent: "center",
	},
	recentTitle: {
		fontSize: 15,
		fontWeight: "600",
		marginBottom: spacing.xs,
	},
	recentDate: {
		fontSize: 12,
		marginBottom: spacing.sm,
	},
	removeButton: {
		alignSelf: "flex-start",
		borderRadius: borderRadius.full,
		paddingHorizontal: spacing.sm,
		paddingVertical: 6,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
	},
	removeButtonText: {
		fontSize: 12,
		fontWeight: "700",
	},
	emptyTitle: {
		fontSize: 18,
		fontWeight: "700",
	},
	emptyDescription: {
		fontSize: 14,
		lineHeight: 20,
	},
	emptyButton: {
		marginTop: spacing.md,
		alignSelf: "flex-start",
	},
	buttonText: {
		fontSize: 16,
		fontWeight: "600",
	},
});
