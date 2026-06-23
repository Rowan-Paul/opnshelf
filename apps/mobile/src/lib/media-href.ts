import type { Href } from "expo-router";

/**
 * Build Expo Router hrefs to the media detail screens from the loosely-typed
 * media references that notes / reviews / shelf items carry. The mobile detail
 * routes are id-based (`/movie/[id]`, `/show/[id]`, and the show season/episode
 * nesting), unlike the web's slug-based routes.
 */
export function mediaHref(ref: {
	mediaType: "movie" | "show" | "season" | "episode";
	mediaId: string;
	seasonNumber?: number | null;
	episodeNumber?: number | null;
	/** When set, the detail screen scrolls to + highlights this review. */
	reviewId?: string;
}): Href {
	const q = ref.reviewId ? `?reviewId=${encodeURIComponent(ref.reviewId)}` : "";
	if (ref.mediaType === "movie") {
		return `/movie/${ref.mediaId}${q}`;
	}
	if (
		ref.mediaType === "episode" &&
		ref.seasonNumber != null &&
		ref.episodeNumber != null
	) {
		return `/show/${ref.mediaId}/season/${ref.seasonNumber}/episode/${ref.episodeNumber}${q}`;
	}
	if (ref.mediaType === "season" && ref.seasonNumber != null) {
		return `/show/${ref.mediaId}/season/${ref.seasonNumber}${q}`;
	}
	return `/show/${ref.mediaId}${q}`;
}
