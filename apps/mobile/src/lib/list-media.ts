import type { MediaInListDto } from "@opnshelf/api";
import type { MediaCardItem } from "@/components/media/MediaCard";

/**
 * `MediaInListDto.media` arrives as loosely-typed JSON (TMDB shape). These
 * helpers read the fields the mobile cards need defensively, accepting both
 * snake_case (TMDB) and camelCase (backend) variants, mirroring the web list
 * page helpers.
 */
type Media = Record<string, unknown>;

function str(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function num(value: unknown): number | undefined {
	return typeof value === "number" ? value : undefined;
}

export function getMediaTitle(media: Media): string {
	return str(media.title) ?? str(media.name) ?? "Untitled";
}

export function getMediaPosterPath(media: Media): string | undefined {
	return str(media.poster_path) ?? str(media.posterPath);
}

export function getMediaYear(media: Media): string | undefined {
	const date = str(media.release_date) ?? str(media.first_air_date);
	if (date) {
		const year = new Date(date).getFullYear();
		if (!Number.isNaN(year)) return String(year);
	}
	const releaseYear = num(media.releaseYear) ?? num(media.firstAirYear);
	return releaseYear ? String(releaseYear) : undefined;
}

export function getMediaRating(media: Media): number | undefined {
	return num(media.vote_average) ?? num(media.voteAverage);
}

/** Map a list item to a `MediaCard` item (season/episode entries point at the show). */
export function listItemToMediaCardItem(item: MediaInListDto): MediaCardItem {
	const media = (item.media ?? {}) as Media;
	return {
		id: Number(item.mediaId),
		type: item.mediaType === "movie" ? "movie" : "show",
		title: getMediaTitle(media),
		posterPath: getMediaPosterPath(media),
		year: getMediaYear(media),
		rating: getMediaRating(media),
	};
}
