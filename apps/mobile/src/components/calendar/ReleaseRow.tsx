import type { ReleaseCalendarItemDto } from "@opnshelf/api";
import { type Href, Link } from "expo-router";
import { ChevronRight, Film, Tv } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { PosterImage } from "@/components/media/PosterImage";
import { Text } from "@/components/ui/text";
import { movieHref, showHref } from "@/lib/media-href";
import { posterUrl } from "@/lib/tmdb";
import { useThemeColors } from "@/theme/colors";

/** Same labels as the Web App's Home Upcoming rows ("S1E5", not "1x5"). */
function episodeInfo(item: ReleaseCalendarItemDto): string | undefined {
	if (item.releaseKind === "episode" && item.seasonNumber !== undefined) {
		if (item.episodeNumber !== undefined) {
			return `S${item.seasonNumber}E${item.episodeNumber}`;
		}
		return `Season ${item.seasonNumber}`;
	}
	if (item.releaseKind === "show") return "Season Premiere";
	return undefined;
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
	const weeks = Math.ceil(diffDays / 7);
	return weeks === 1 ? "in 1 week" : `in ${weeks} weeks`;
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

/** Loading placeholder with ReleaseRow's geometry: poster block + text lines. */
export function ReleaseRowSkeleton() {
	return (
		<View className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-3">
			<View className="h-20 w-14 rounded-lg bg-background-subtle" />
			<View className="flex-1 gap-2">
				<View className="h-3.5 w-3/5 rounded bg-background-subtle" />
				<View className="h-2.5 w-2/5 rounded bg-background-subtle" />
			</View>
		</View>
	);
}

/** A single upcoming release in the calendar week list. */
export function ReleaseRow({ item }: { item: ReleaseCalendarItemDto }) {
	const colors = useThemeColors();
	const href = hrefFor(item);
	const isMovie = item.mediaType === "movie";

	const body = (
		<View className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-3">
			<View className="h-20 w-14 items-center justify-center overflow-hidden rounded-lg bg-background-subtle">
				{item.posterPath ? (
					<PosterImage
						url={posterUrl(item.posterPath, "w185")}
						className="h-20 w-14"
					/>
				) : isMovie ? (
					<Film color={colors.mutedForeground} size={22} />
				) : (
					<Tv color={colors.mutedForeground} size={22} />
				)}
			</View>
			<View className="min-w-0 flex-1">
				<Text className="font-medium text-foreground text-sm" numberOfLines={2}>
					{item.title}
				</Text>
				<View className="mt-1 flex-row items-center gap-1.5">
					{isMovie ? (
						<Film color={colors.mutedForeground} size={13} />
					) : (
						<Tv color={colors.mutedForeground} size={13} />
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
				{episodeInfo(item) ? (
					<Text className="mt-0.5 text-muted-foreground text-xs">
						{episodeInfo(item)}
					</Text>
				) : null}
			</View>
			<ChevronRight color={colors.mutedForeground} size={18} />
		</View>
	);

	if (!href) return body;
	return (
		<Link href={href} asChild>
			<Pressable>{body}</Pressable>
		</Link>
	);
}
