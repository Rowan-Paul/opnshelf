import { Link } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { PosterImage } from "@/components/media/PosterImage";
import { Text } from "@/components/ui/text";
import { posterUrl } from "@/lib/tmdb";

export type SeasonCardData = {
	showId: number;
	seasonNumber: number;
	name: string;
	posterPath?: string | null;
	episodeCount?: number;
	year?: string;
};

/**
 * Season list row used on the show detail screen. Links to the season detail
 * route. Shows a poster thumbnail, name, year, and episode count.
 */
export function SeasonCard({ season }: { season: SeasonCardData }) {
	const meta = [
		season.year,
		season.episodeCount ? `${season.episodeCount} episodes` : undefined,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<Link href={`/show/${season.showId}/season/${season.seasonNumber}`} asChild>
			<Pressable className="flex-row items-center gap-3 rounded-lg border border-border bg-card p-2">
				<View className="aspect-2/3 w-14 overflow-hidden rounded-md bg-background-subtle">
					<PosterImage
						url={posterUrl(season.posterPath, "w185")}
						className="aspect-2/3 w-14"
					/>
				</View>
				<View className="flex-1">
					<Text
						className="font-medium text-foreground text-sm"
						numberOfLines={1}
					>
						{season.name}
					</Text>
					{meta ? (
						<Text className="mt-0.5 text-muted-foreground text-xs">{meta}</Text>
					) : null}
				</View>
				<ChevronRight color="#94a3b8" size={20} />
			</Pressable>
		</Link>
	);
}
