import type { PersonFilmographyItemDto } from "@opnshelf/api";
import { Link } from "expo-router";
import { Check, Plus } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { PosterImage } from "@/components/media/PosterImage";
import { Text } from "@/components/ui/text";
import { movieHref, showHref } from "@/lib/media-href";
import { posterUrl } from "@/lib/tmdb";

/** Best human-readable role label for a (possibly merged) filmography credit. */
export function getRoleText(
	item: PersonFilmographyItemDto,
): string | undefined {
	if (item.character) return item.character;
	if (item.job) return item.job;
	if (item.roles && item.roles.length > 0) {
		const roles = item.roles.map((r) => r.character || r.job).filter(Boolean);
		return [...new Set(roles)].join(" / ") || undefined;
	}
	return undefined;
}

/** 4-digit year from a filmography credit's release / first-air date. */
export function getYear(item: PersonFilmographyItemDto): string | undefined {
	const date = item.release_date || item.first_air_date;
	if (!date) return undefined;
	const year = new Date(date).getFullYear();
	return Number.isNaN(year) ? undefined : String(year);
}

/**
 * Poster card for a person's filmography. Links to the matching movie/show
 * detail and, for movies, overlays a quick watched toggle (powered by the
 * page-level `useMovieWatchToggle`). Shows have no single watched state, so
 * they just navigate.
 */
export function FilmographyCard({
	item,
	watched,
	canToggle,
	onToggleWatched,
}: {
	item: PersonFilmographyItemDto;
	watched?: boolean;
	canToggle?: boolean;
	onToggleWatched?: (item: PersonFilmographyItemDto) => void;
}) {
	const isMovie = item.media_type === "movie";
	const href = isMovie
		? movieHref(item.id, item.title)
		: showHref(item.id, item.title);
	const role = getRoleText(item);
	const year = getYear(item);
	const showToggle = isMovie && canToggle;

	return (
		<View className="flex-1">
			<Link href={href} asChild>
				<Pressable>
					<View className="overflow-hidden rounded-lg border border-border bg-card">
						<PosterImage
							url={posterUrl(item.poster_path)}
							className="aspect-2/3 w-full"
						/>
					</View>
					<Text
						className="mt-2 font-medium text-foreground text-sm"
						numberOfLines={1}
					>
						{item.title}
					</Text>
					<View className="mt-0.5 flex-row items-center gap-1.5">
						{year ? (
							<Text className="text-muted-foreground text-xs">{year}</Text>
						) : null}
						{role ? (
							<Text
								className="flex-1 text-muted-foreground text-xs"
								numberOfLines={1}
							>
								{role}
							</Text>
						) : null}
					</View>
				</Pressable>
			</Link>

			{showToggle ? (
				<Pressable
					hitSlop={8}
					onPress={() => onToggleWatched?.(item)}
					className={
						watched
							? "absolute top-1.5 right-1.5 size-7 items-center justify-center rounded-full bg-primary"
							: "absolute top-1.5 right-1.5 size-7 items-center justify-center rounded-full bg-black/55"
					}
				>
					{watched ? (
						<Check color="#3f2e00" size={16} strokeWidth={3} />
					) : (
						<Plus color="#ffffff" size={16} strokeWidth={2.5} />
					)}
				</Pressable>
			) : null}
		</View>
	);
}
