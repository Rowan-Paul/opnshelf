import type { ReleaseCalendarItemDto } from "@opnshelf/api";
import { type Href, Link } from "expo-router";
import { ChevronRight, Film, Tv } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { PosterImage } from "@/components/media/PosterImage";
import { Text } from "@/components/ui/text";
import { posterUrl } from "@/lib/tmdb";

function displayTitle(item: ReleaseCalendarItemDto): string {
	if (
		item.mediaType === "show" &&
		item.releaseKind === "episode" &&
		item.seasonNumber !== undefined
	) {
		if (item.episodeNumber !== undefined) {
			return `${item.seasonNumber}x${item.episodeNumber} ${item.title}`;
		}
		return `S${item.seasonNumber} ${item.title}`;
	}
	return item.title;
}

function hrefFor(item: ReleaseCalendarItemDto): Href | null {
	if (item.mediaType === "movie" && item.movieId) {
		return `/movie/${item.movieId}` as const;
	}
	if (
		item.mediaType === "show" &&
		item.releaseKind === "episode" &&
		item.showId &&
		item.seasonNumber !== undefined &&
		item.episodeNumber !== undefined
	) {
		return `/show/${item.showId}/season/${item.seasonNumber}/episode/${item.episodeNumber}` as Href;
	}
	if (item.showId) return `/show/${item.showId}` as const;
	return null;
}

/** A single upcoming release in the calendar week list. */
export function ReleaseRow({ item }: { item: ReleaseCalendarItemDto }) {
	const href = hrefFor(item);
	const isMovie = item.mediaType === "movie";

	const body = (
		<View className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-3">
			<View className="h-20 w-14 items-center justify-center overflow-hidden rounded-lg bg-background-subtle">
				{item.posterPath ? (
					<PosterImage url={posterUrl(item.posterPath)} className="h-20 w-14" />
				) : isMovie ? (
					<Film color="#94a3b8" size={22} />
				) : (
					<Tv color="#94a3b8" size={22} />
				)}
			</View>
			<View className="min-w-0 flex-1">
				<Text className="font-medium text-foreground text-sm" numberOfLines={2}>
					{displayTitle(item)}
				</Text>
				<View className="mt-1 flex-row items-center gap-1.5">
					{isMovie ? (
						<Film color="#94a3b8" size={13} />
					) : (
						<Tv color="#94a3b8" size={13} />
					)}
					<Text className="text-muted-foreground text-xs">
						{isMovie ? "Movie" : "TV"}
					</Text>
				</View>
			</View>
			<ChevronRight color="#94a3b8" size={18} />
		</View>
	);

	if (!href) return body;
	return (
		<Link href={href} asChild>
			<Pressable>{body}</Pressable>
		</Link>
	);
}
