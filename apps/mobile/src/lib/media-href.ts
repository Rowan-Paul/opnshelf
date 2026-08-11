import { slugifyName } from "@opnshelf/api";
import type { Href } from "expo-router";

/**
 * Build hrefs to the media detail screens.
 *
 * These are the same URLs the Web App serves (ADR 0023), because the Mobile App
 * captures `opnshelf.xyz` links (ADR 0022) — a shared link and an in-app
 * navigation must land on the same route.
 *
 * `mediaTitle` is the movie or show title that `mediaId` identifies, never the
 * composite label: an episode URL slugs the show name alone, so passing
 * "Breaking Bad — S1E1: Pilot" would build a URL the web never produces.
 *
 * The slug is decorative — every screen loads from the id — but it still has to
 * match, so it comes from the shared `slugifyName`.
 */
export function mediaHref(ref: {
	mediaType: "movie" | "show" | "season" | "episode";
	mediaId: string;
	/** Title of the movie or show, for the slug segment. */
	mediaTitle?: string | null;
	seasonNumber?: number | null;
	episodeNumber?: number | null;
	/** When set, the detail screen scrolls to + highlights this review. */
	reviewId?: string;
}): Href {
	const q = ref.reviewId ? `?reviewId=${encodeURIComponent(ref.reviewId)}` : "";
	const slug = slugifyName(ref.mediaTitle ?? "");

	if (ref.mediaType === "movie") {
		return `/movies/${ref.mediaId}/${slug}${q}`;
	}
	if (
		ref.mediaType === "episode" &&
		ref.seasonNumber != null &&
		ref.episodeNumber != null
	) {
		return `/shows/${ref.mediaId}/${slug}/seasons/${ref.seasonNumber}/episodes/${ref.episodeNumber}${q}`;
	}
	if (ref.mediaType === "season" && ref.seasonNumber != null) {
		return `/shows/${ref.mediaId}/${slug}/seasons/${ref.seasonNumber}${q}`;
	}
	return `/shows/${ref.mediaId}/${slug}${q}`;
}

/** Person detail, matching the Web App's `/people/{id}/{slug}`. */
export function personHref(id: string | number, name: string): Href {
	return `/people/${id}/${slugifyName(name)}`;
}

/** Movie detail. Prefer this over hand-writing the path. */
export function movieHref(id: string | number, title: string): Href {
	return `/movies/${id}/${slugifyName(title)}`;
}

/** Show detail, optionally down to a season or episode. */
export function showHref(
	id: string | number,
	title: string,
	seasonNumber?: number,
	episodeNumber?: number,
): Href {
	const base = `/shows/${id}/${slugifyName(title)}`;
	if (seasonNumber == null) return base as Href;
	if (episodeNumber == null) return `${base}/seasons/${seasonNumber}` as Href;
	return `${base}/seasons/${seasonNumber}/episodes/${episodeNumber}` as Href;
}
