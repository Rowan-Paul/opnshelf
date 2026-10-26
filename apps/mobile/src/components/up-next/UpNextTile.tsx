import type { UpNextShowDto } from "@opnshelf/api";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { Plus, Tv } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { PosterProgress } from "@/components/media/poster-progress";
import { Text } from "@/components/ui/text";
import { showHref } from "@/lib/media-href";
import { backdropUrl } from "@/lib/tmdb";
import { useMarkUpNextEpisode } from "@/lib/use-up-next";
import { useThemeColors } from "@/theme/colors";

/**
 * Compact Up Next tile for Home, the Mobile counterpart of the Web App's Home
 * Up Next card: the episode still with the episode, show and progress written
 * over it, and a corner button that adds the episode to the shelf. The full
 * Up Next screen keeps the larger `UpNextEpisodeCard` with the overview.
 *
 * The tile owns its mutation, so only the episode being added shows pending.
 */
export function UpNextTile({ item }: { item: UpNextShowDto }) {
	const colors = useThemeColors();
	const markEpisode = useMarkUpNextEpisode();
	const { show, nextEpisode: ep } = item;
	const [failedImages, setFailedImages] = useState<string[]>([]);
	const imagePath = [ep.stillPath, show.backdropPath].find(
		(path) => path && !failedImages.includes(path),
	);
	const progress = {
		episodesWatched: item.episodesWatched,
		episodesTotal: item.totalEpisodes,
		percentage:
			item.totalEpisodes > 0
				? Math.round((item.episodesWatched / item.totalEpisodes) * 100)
				: 0,
	};
	const code = `S${ep.seasonNumber}E${ep.episodeNumber}`;

	return (
		<View
			style={{ aspectRatio: 16 / 9 }}
			className="overflow-hidden rounded-xl border border-border bg-background-subtle"
		>
			<Link
				href={showHref(
					show.showId,
					show.title,
					ep.seasonNumber,
					ep.episodeNumber,
				)}
				asChild
			>
				<Pressable
					accessibilityRole="link"
					accessibilityLabel={`${show.title}, ${code}, ${ep.name || `Episode ${ep.episodeNumber}`}`}
					style={{ position: "absolute", inset: 0 }}
				>
					{imagePath ? (
						<Image
							source={{ uri: backdropUrl(imagePath, "w780") }}
							style={{ position: "absolute", inset: 0 }}
							contentFit="cover"
							transition={{ duration: 200, skipOnCacheHit: "all" }}
							onError={() => setFailedImages((paths) => [...paths, imagePath])}
						/>
					) : (
						<View className="absolute inset-0 items-center justify-center">
							<Tv color={colors.mutedForeground} size={32} />
						</View>
					)}
					<LinearGradient
						colors={["transparent", "rgba(0,0,0,0.85)"]}
						style={{ position: "absolute", inset: 0 }}
					/>
					<View className="absolute right-0 bottom-0 left-0 gap-0.5 p-3 pb-3.5">
						<Text
							className="font-semibold text-base text-white"
							numberOfLines={1}
						>
							{ep.name || `Episode ${ep.episodeNumber}`}
						</Text>
						<Text className="text-sm text-white/80" numberOfLines={1}>
							{show.title} • {code}
						</Text>
						{progress.episodesTotal > 0 ? (
							<Text
								className="text-white/70 text-xs"
								style={{ fontVariant: ["tabular-nums"] }}
							>
								{progress.episodesWatched} of {progress.episodesTotal} ·{" "}
								{progress.percentage}% watched
							</Text>
						) : null}
					</View>
					<PosterProgress progress={progress} label="Show progress" />
				</Pressable>
			</Link>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={`Add ${show.title} ${code} to shelf`}
				accessibilityState={{ busy: markEpisode.isPending }}
				hitSlop={8}
				disabled={markEpisode.isPending}
				onPress={() =>
					markEpisode.mutate({
						body: {
							showId: item.showId,
							seasonNumber: ep.seasonNumber,
							episodeNumber: ep.episodeNumber,
						},
					})
				}
				className="absolute top-2 right-2 size-8 items-center justify-center rounded-full bg-black/70"
			>
				{markEpisode.isPending ? (
					<ActivityIndicator size="small" color="#ffffff" />
				) : (
					<Plus color="#ffffff" size={16} strokeWidth={2.5} />
				)}
			</Pressable>
		</View>
	);
}
