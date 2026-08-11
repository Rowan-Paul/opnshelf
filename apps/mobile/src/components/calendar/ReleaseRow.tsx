import type { ReleaseCalendarItemDto } from "@opnshelf/api";
import { type Href, Link } from "expo-router";
import { ChevronRight, Film, Tv } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { PosterImage } from "@/components/media/PosterImage";
import { Text } from "@/components/ui/text";
import { movieHref, showHref } from "@/lib/media-href";
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

/** Short absolute day, e.g. `Jun 25`. */
function shortDate(dateStr: string): string {
	const d = new Date(dateStr);
	if (Number.isNaN(d.getTime())) return "";
	return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Relative label mirroring the web dashboard: Today / Tomorrow / in N days. */
function relativeDate(dateStr: string): string | undefined {
	const release = new Date(dateStr);
	if (Number.isNaN(release.getTime())) return undefined;
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	release.setHours(0, 0, 0, 0);
	const diffDays = Math.ceil(
		(release.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
	);
	if (diffDays < 0) return undefined;
	if (diffDays === 0) return "Today";
	if (diffDays === 1) return "Tomorrow";
	if (diffDays < 7) return `in ${diffDays} days`;
	return `in ${Math.ceil(diffDays / 7)} weeks`;
}

function hrefFor(item: ReleaseCalendarItemDto): Href | null {
	// `title` is the movie or show title; the episode detail is in `subtitle`.
	if (item.mediaType === "movie" && item.movieId) {
		return movieHref(item.movieId, item.title);
	}
	if (
		item.mediaType === "show" &&
		item.releaseKind === "episode" &&
		item.showId &&
		item.seasonNumber !== undefined &&
		item.episodeNumber !== undefined
	) {
		return showHref(
			item.showId,
			item.title,
			item.seasonNumber,
			item.episodeNumber,
		);
	}
	if (item.showId) return showHref(item.showId, item.title);
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
						{shortDate(item.releaseDate)}
					</Text>
					{relativeDate(item.releaseDate) ? (
						<Text className="font-medium text-primary text-xs">
							• {relativeDate(item.releaseDate)}
						</Text>
					) : null}
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
