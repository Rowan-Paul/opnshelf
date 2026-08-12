import type { MediaInListDto } from "@opnshelf/api";
import type { MediaCardItem } from "@/components/media/MediaCard";
import { showHref } from "./media-href";

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

/**
 * Map a list item to a `MediaCard` item. Season/episode entries keep the parent
 * show's poster + id (so the show-keyed action hooks resolve) but carry their
 * scope in the label line and deep-link to the season/episode page — mirroring
 * the shelf cards and the web list page, so e.g. two specials of the same show
 * don't render as identical cards.
 */
export function listItemToMediaCardItem(item: MediaInListDto): MediaCardItem {
	const media = (item.media ?? {}) as Media;
	const showTitle = getMediaTitle(media);
	const base = {
		id: Number(item.mediaId),
		type: item.mediaType === "movie" ? ("movie" as const) : ("show" as const),
		title: showTitle,
		posterPath: getMediaPosterPath(media),
		year: getMediaYear(media),
		rating: getMediaRating(media),
	};
	if (item.seasonNumber != null && item.episodeNumber != null) {
		return {
			...base,
			// Title line shows the episode title; the show drops to the label line.
			title: item.episodeName ?? showTitle,
			href: showHref(
				item.mediaId,
				showTitle,
				item.seasonNumber,
				item.episodeNumber,
			),
			episode: {
				seasonNumber: item.seasonNumber,
				episodeNumber: item.episodeNumber,
				showTitle,
				episodeTitle: item.episodeName,
			},
		};
	}
	if (item.seasonNumber != null) {
		return {
			...base,
			href: showHref(item.mediaId, showTitle, item.seasonNumber),
			label: `Season ${item.seasonNumber}`,
		};
	}
	return base;
}
