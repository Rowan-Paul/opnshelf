import type { ColorTheme, EpisodeSummary } from "./types";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
	showsControllerGetShowWatchHistoryQueryKey,
	showsControllerGetUserShowsQueryKey,
	showsControllerMarkWatchedMutation,
	showsControllerUnmarkWatchedMutation,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import { useToast } from "@/contexts/toast";

const STILL_BASE_URL = "https://image.tmdb.org/t/p/w300";

interface EpisodeCardProps {
	showId: string;
	seasonNumber: string;
	episode: EpisodeSummary;
	watchedCount?: number;
	colors: ColorTheme;
	userDid?: string;
	onPress: () => void;
}

function formatDateOnly(dateString?: string): string {
	if (!dateString) return "TBA";
	return new Date(dateString).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function EpisodeCard({
	showId,
	seasonNumber,
	episode,
	watchedCount = 0,
	colors,
	userDid,
	onPress,
}: EpisodeCardProps) {
	const { colors: themeColors } = useTheme();
	const { showToast } = useToast();
	const queryClient = useQueryClient();

	const stillUrl = episode.still_path
		? `${STILL_BASE_URL}${episode.still_path}`
		: null;

	const hasWatchedEpisodes = watchedCount > 0;

	const markMutation = useMutation({
		...showsControllerMarkWatchedMutation(),
		onSuccess: () => {
			if (userDid) {
				queryClient.invalidateQueries({
					queryKey: showsControllerGetUserShowsQueryKey({
						path: { userDid },
					}),
				});
				queryClient.invalidateQueries({
					queryKey: showsControllerGetShowWatchHistoryQueryKey({
						path: { userDid, showId },
					}),
				});
			}
			showToast("Episode marked watched");
		},
		onError: () => {
			showToast("Failed to mark episode watched", "error");
		},
	});

	const unmarkMutation = useMutation({
		...showsControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			if (userDid) {
				queryClient.invalidateQueries({
					queryKey: showsControllerGetUserShowsQueryKey({
						path: { userDid },
					}),
				});
				queryClient.invalidateQueries({
					queryKey: showsControllerGetShowWatchHistoryQueryKey({
						path: { userDid, showId },
					}),
				});
			}
			showToast("Removed from your shelf");
		},
		onError: () => {
			showToast("Failed to remove from shelf", "error");
		},
	});

	const isPending = markMutation.isPending || unmarkMutation.isPending;

	const handleToggleWatched = (e: any) => {
		e.preventDefault();
		e.stopPropagation();

		if (hasWatchedEpisodes) {
			unmarkMutation.mutate({
				path: { showId },
				query: {
					mode: "all",
					seasonNumber: Number(seasonNumber),
				},
			});
		} else {
			markMutation.mutate({
				body: {
					showId,
					seasonNumber: Number(seasonNumber),
					episodeNumber: episode.episode_number,
				},
			});
		}
	};

	return (
		<TouchableOpacity
			onPress={onPress}
			style={[
				styles.container,
				{
					borderColor: hasWatchedEpisodes ? `${colors.primary}40` : themeColors.outline,
					backgroundColor: `${themeColors.surfaceContainer}50`,
				},
			]}
			activeOpacity={0.8}
		>
			<View style={styles.row}>
				<View style={styles.thumbnail}>
					{stillUrl ? (
						<Image
							source={{ uri: stillUrl }}
							style={styles.still}
							contentFit="cover"
						/>
					) : (
						<View style={[styles.still, styles.noStill]}>
							<Ionicons name="film-outline" size={20} color="#6b7280" />
						</View>
					)}
				</View>

				<View style={styles.content}>
					<View style={styles.header}>
						<Text style={[styles.title, { color: themeColors.onSurface }]} numberOfLines={1}>
							E{episode.episode_number} · {episode.name}
						</Text>
						{episode.vote_average ? (
							<View style={styles.rating}>
								<Ionicons name="star" size={12} color="#fbbf24" />
								<Text style={styles.ratingText}>
									{episode.vote_average.toFixed(1)}
								</Text>
							</View>
						) : null}
					</View>

					<Text
						style={[styles.overview, { color: themeColors.onSurfaceVariant }]}
						numberOfLines={2}
					>
						{episode.overview || "No overview available."}
					</Text>

					<View style={styles.footer}>
						<View style={styles.dateRow}>
							<Ionicons
								name="calendar-outline"
								size={12}
								color={themeColors.onSurfaceVariant}
							/>
							<Text style={[styles.date, { color: themeColors.onSurfaceVariant }]}>
								{formatDateOnly(episode.air_date)}
							</Text>
						</View>
						{watchedCount > 0 && (
							<View style={styles.watchedBadge}>
								<Ionicons name="checkmark-circle" size={12} color={colors.primary} />
								<Text style={[styles.watchedText, { color: colors.primary }]}>
									{watchedCount} watched
								</Text>
							</View>
						)}
					</View>

					{userDid && (
						<TouchableOpacity
							onPress={handleToggleWatched}
							disabled={isPending}
							style={[
								styles.addButton,
								{
									backgroundColor: hasWatchedEpisodes
										? `${themeColors.error}20`
										: `${colors.primary}20`,
									borderColor: hasWatchedEpisodes
										? themeColors.error
										: colors.primary,
								},
							]}
							activeOpacity={0.7}
						>
							{isPending ? (
								<><ActivityIndicator
									size="small"
									color={hasWatchedEpisodes ? themeColors.error : colors.primary}
								/>
								<Text style={[styles.addButtonText, { color: hasWatchedEpisodes ? themeColors.error : colors.primary }]}>Loading</Text>
								</>
							) : (
								<>
									<Ionicons
										name={hasWatchedEpisodes ? "trash-outline" : "add"}
										size={14}
										color={hasWatchedEpisodes ? themeColors.error : colors.primary}
									/>
									<Text
										style={[
											styles.addButtonText,
											{ color: hasWatchedEpisodes ? themeColors.error : colors.primary },
										]}
									>
										{hasWatchedEpisodes ? "Remove from Shelf" : "Add to Shelf"}
									</Text>
								</>
							)}
						</TouchableOpacity>
					)}
				</View>
			</View>
		</TouchableOpacity>
	);
}

const styles = StyleSheet.create({
	container: {
		borderRadius: borderRadius.lg,
		borderWidth: 1,
	},
	row: {
		flexDirection: "row",
		gap: spacing.md,
	},
	thumbnail: {
		width: 100,
		height: 100,
	},
	still: {
		width: "100%",
		height: "100%",
	},
	noStill: {
		backgroundColor: "#1f2937",
		justifyContent: "center",
		alignItems: "center",
	},
	content: {
		flex: 1,
		paddingVertical: spacing.sm,
		paddingRight: spacing.sm,
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		gap: spacing.xs,
		marginBottom: 4,
	},
	title: {
		fontSize: 14,
		fontWeight: "600",
		flex: 1,
	},
	rating: {
		flexDirection: "row",
		alignItems: "center",
		gap: 2,
	},
	ratingText: {
		fontSize: 12,
		color: "#fbbf24",
		fontWeight: "600",
	},
	overview: {
		fontSize: 12,
		lineHeight: 16,
		marginBottom: 4,
	},
	footer: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
	dateRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
	},
	date: {
		fontSize: 11,
	},
	watchedBadge: {
		flexDirection: "row",
		alignItems: "center",
		gap: 2,
	},
	watchedText: {
		fontSize: 11,
		fontWeight: "600",
	},
	addButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: spacing.xs,
		marginTop: spacing.sm,
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.md,
		borderRadius: borderRadius.md,
		borderWidth: 1,
	},
	addButtonText: {
		fontSize: 12,
		fontWeight: "600",
	},
});
