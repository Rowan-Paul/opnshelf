import { Link } from "expo-router";
import { Star } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { PosterImage } from "@/components/media/PosterImage";
import { Text } from "@/components/ui/text";
import { stillUrl } from "@/lib/tmdb";

export type EpisodeCardData = {
	showId: number;
	seasonNumber: number;
	episodeNumber: number;
	name: string;
	overview?: string;
	stillPath?: string | null;
	airDate?: string;
	rating?: number;
};

/**
 * Episode list row: still thumbnail, number + title, air date/rating, and a
 * truncated overview. Links to the episode detail route. Reused by the season
 * detail screen and any future "up next" surfaces.
 */
export function EpisodeCard({ episode }: { episode: EpisodeCardData }) {
	return (
		<Link
			href={`/show/${episode.showId}/season/${episode.seasonNumber}/episode/${episode.episodeNumber}`}
			asChild
		>
			<Pressable className="flex-row gap-3 rounded-lg border border-border bg-card p-2">
				<View className="aspect-video w-28 overflow-hidden rounded-md bg-background-subtle">
					<PosterImage
						url={stillUrl(episode.stillPath)}
						className="aspect-video w-28"
					/>
				</View>
				<View className="flex-1 justify-center">
					<Text
						className="font-medium text-foreground text-sm"
						numberOfLines={2}
					>
						{episode.episodeNumber}. {episode.name}
					</Text>
					<View className="mt-0.5 flex-row items-center gap-2">
						{episode.airDate ? (
							<Text className="text-muted-foreground text-xs">
								{episode.airDate}
							</Text>
						) : null}
						{episode.rating && episode.rating > 0 ? (
							<View className="flex-row items-center gap-0.5">
								<Star color="#f3bc00" fill="#f3bc00" size={11} />
								<Text className="text-muted-foreground text-xs">
									{episode.rating.toFixed(1)}
								</Text>
							</View>
						) : null}
					</View>
					{episode.overview ? (
						<Text
							className="mt-1 text-muted-foreground text-xs leading-4"
							numberOfLines={2}
						>
							{episode.overview}
						</Text>
					) : null}
				</View>
			</Pressable>
		</Link>
	);
}
