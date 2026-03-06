import {
	showsControllerGetUserShowsQueryKey,
	showsControllerMarkWatchedMutation,
	type UpNextShowDto,
} from "@opnshelf/api";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Tv } from "lucide-react-native";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import { useToast } from "@/contexts/toast";
import {
	invalidateUserShelfQueries,
	invalidateUserUpNextQueries,
} from "@/lib/invalidate-shelf";
import { getTmdbPosterUrl } from "@/lib/utils";

type UpNextSectionProps = {
	isLoading: boolean;
	items: UpNextShowDto[];
	userDid: string;
};

export function UpNextSection({
	isLoading,
	items,
	userDid,
}: UpNextSectionProps) {
	const { colors } = useTheme();
	const { showToast } = useToast();
	const queryClient = useQueryClient();
	const markMutation = useMutation({
		...showsControllerMarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({
					path: { userDid },
				}),
			});
			invalidateUserShelfQueries(queryClient, userDid);
			invalidateUserUpNextQueries(queryClient, userDid);
			showToast("Episode marked watched");
		},
		onError: () => {
			showToast("Failed to mark episode watched", "error");
		},
	});

	return (
		<View style={styles.section}>
			<View style={styles.sectionHeader}>
				<Text style={[styles.sectionTitle, { color: colors.onBackground }]}>Up Next</Text>
				<Text style={[styles.sectionSubtitle, { color: colors.onSurfaceVariant }]}>Continue the shows you already have in motion.</Text>
			</View>

			{isLoading ? (
				<View style={styles.sectionSkeleton}>
					{[1, 2].map((i) => (
						<Skeleton key={i} width="100%" height={148} style={{ marginBottom: spacing.sm }} />
					))}
				</View>
			) : items.length > 0 ? (
				<View style={styles.upNextList}>
					{items.slice(0, 4).map((item) => {
						const posterUrl = getTmdbPosterUrl(item.show.posterPath, "w500");

						const isPending =
							markMutation.isPending &&
							markMutation.variables?.body?.showId === item.showId &&
							markMutation.variables?.body?.seasonNumber ===
								item.nextEpisode.seasonNumber &&
							markMutation.variables?.body?.episodeNumber ===
								item.nextEpisode.episodeNumber;

						return (
							<Pressable
								key={`${item.showId}-${item.nextEpisode.seasonNumber}-${item.nextEpisode.episodeNumber}`}
								onPress={() =>
									router.push({
										pathname: "/show/[id]/season/[seasonNumber]/episode/[episodeNumber]",
										params: {
											id: item.showId,
											seasonNumber: String(item.nextEpisode.seasonNumber),
											episodeNumber: String(item.nextEpisode.episodeNumber),
										},
									})
								}
								style={[
									styles.upNextCard,
									{
										backgroundColor: colors.surfaceContainer,
										borderColor: colors.outline,
									},
								]}
							>
								<View style={styles.posterColumn}>
									<View style={[styles.posterWrap, { backgroundColor: colors.surfaceContainerHigh }]}>
										{posterUrl ? (
											<Image
												source={{ uri: posterUrl }}
												style={styles.posterImage}
												contentFit="cover"
												transition={150}
											/>
										) : (
											<View style={styles.posterFallbackWrap}>
												<Tv size={18} color={colors.onSurfaceVariant} />
												<Text style={[styles.posterFallbackText, { color: colors.onSurfaceVariant }]}>No poster</Text>
											</View>
										)}
									</View>
								</View>

								<View style={styles.upNextMeta}>
									<View style={styles.metaTop}>
										<View style={styles.pillRow}>
											<View style={[styles.pill, { backgroundColor: colors.primaryContainer }]}>
												<Text style={[styles.pillText, { color: colors.onPrimaryContainer }]}>Up next</Text>
											</View>
											<View style={[styles.pill, { backgroundColor: colors.secondaryContainer }]}>
												<Text style={[styles.pillText, { color: colors.onSecondaryContainer }]}>S{item.nextEpisode.seasonNumber} E{item.nextEpisode.episodeNumber}</Text>
											</View>
										</View>
										<Text style={[styles.showTitle, { color: colors.onSurface }]} numberOfLines={2}>
											{item.show.title}
										</Text>
										<Text style={[styles.episodeTitle, { color: colors.onSurfaceVariant }]} numberOfLines={2}>
											{item.nextEpisode.name}
										</Text>
									</View>
									<Pressable
										onPress={(event) => {
											event.stopPropagation();
											markMutation.mutate({
												body: {
													showId: item.showId,
													seasonNumber: item.nextEpisode.seasonNumber,
													episodeNumber: item.nextEpisode.episodeNumber,
												},
											});
										}}
										disabled={isPending}
										style={[
											styles.watchButton,
											{ backgroundColor: colors.primaryContainer },
										]}
									>
										{isPending ? (
											<ActivityIndicator size="small" color={colors.onPrimaryContainer} />
										) : (
											<Check size={14} color={colors.onPrimaryContainer} />
										)}
										<Text style={[styles.watchButtonText, { color: colors.onPrimaryContainer }]}>Watch</Text>
									</Pressable>
								</View>
							</Pressable>
						);
					})}
				</View>
			) : (
				<Card>
					<CardHeader>
						<Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Nothing queued up yet</Text>
					</CardHeader>
					<CardContent>
						<Text style={[styles.emptyDescription, { color: colors.onSurfaceVariant }]}>Watch a few episodes and OpnShelf will line up what comes next.</Text>
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
		marginBottom: spacing.sm,
		gap: spacing.xs,
	},
	sectionTitle: {
		fontSize: 22,
		fontWeight: "700",
	},
	sectionSubtitle: {
		fontSize: 14,
		lineHeight: 20,
	},
	sectionSkeleton: {
		marginTop: spacing.sm,
	},
	upNextList: {
		gap: spacing.sm,
	},
	upNextCard: {
		flexDirection: "row",
		minHeight: 148,
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		overflow: "hidden",
		alignItems: "stretch",
		padding: spacing.md,
		gap: spacing.md,
	},
	posterColumn: {
		justifyContent: "center",
	},
	posterWrap: {
		width: 84,
		aspectRatio: 2 / 3,
		borderRadius: borderRadius.md,
		overflow: "hidden",
		alignItems: "center",
		justifyContent: "center",
	},
	posterImage: {
		width: "100%",
		height: "100%",
	},
	posterFallbackWrap: {
		alignItems: "center",
		gap: spacing.xs,
	},
	posterFallbackText: {
		fontSize: 10,
		fontWeight: "600",
	},
	upNextMeta: {
		flex: 1,
		justifyContent: "space-between",
		minHeight: 116,
	},
	metaTop: {
		gap: spacing.xs,
	},
	pillRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.xs,
		marginBottom: spacing.xs,
	},
	pill: {
		paddingHorizontal: spacing.sm,
		paddingVertical: 4,
		borderRadius: borderRadius.full,
	},
	pillText: {
		fontSize: 11,
		fontWeight: "700",
	},
	showTitle: {
		fontSize: 18,
		fontWeight: "700",
		lineHeight: 22,
	},
	episodeTitle: {
		fontSize: 15,
		fontWeight: "600",
		lineHeight: 20,
	},
	watchButton: {
		alignSelf: "flex-end",
		borderRadius: borderRadius.full,
		paddingHorizontal: spacing.md,
		paddingVertical: 8,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
	},
	watchButtonText: {
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
});
