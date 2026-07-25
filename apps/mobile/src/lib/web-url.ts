import { env } from "@/lib/env";

// ponytail: cosmetic slug — web routes resolve by id, so no transliteration of
// non-latin scripts; bring in `slugify` only if a shared slug ever 404s.
function slugify(name: string): string {
	return name
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

type Target =
	| { type: "movie"; id: string | number; name: string }
	| { type: "show"; id: string | number; name: string }
	| {
			type: "season";
			showId: string | number;
			showName: string;
			seasonNumber: number;
	  }
	| {
			type: "episode";
			showId: string | number;
			showName: string;
			seasonNumber: number;
			episodeNumber: number;
	  };

/** Public web URL for a media item, mirroring apps/web `url-utils`. */
export function webMediaUrl(t: Target): string {
	const base = env.siteUrl;
	switch (t.type) {
		case "movie":
			return `${base}/movies/${t.id}/${slugify(t.name)}`;
		case "show":
			return `${base}/shows/${t.id}/${slugify(t.name)}`;
		case "season":
			return `${base}/shows/${t.showId}/${slugify(t.showName)}/seasons/${t.seasonNumber}`;
		case "episode":
			return `${base}/shows/${t.showId}/${slugify(t.showName)}/seasons/${t.seasonNumber}/episodes/${t.episodeNumber}`;
	}
}

/**
 * Public web URL for a review: the media page with the review reader already
 * open, so a first-time visitor lands on the title it is about. Same target the
 * backend puts in a Bluesky cross-post.
 */
export function webReviewUrl(
	media: {
		mediaType: string;
		mediaId: string;
		seasonNumber?: number;
		episodeNumber?: number;
		mediaTitle?: string | null;
	},
	handle: string,
	rkey: string,
): string {
	// The media title carries the show name as the first " — "-separated part.
	const name = media.mediaTitle?.split(" — ")[0] ?? "";
	const showId = media.mediaId;
	const base =
		media.mediaType === "season"
			? webMediaUrl({
					type: "season",
					showId,
					showName: name,
					seasonNumber: media.seasonNumber ?? 0,
				})
			: media.mediaType === "episode"
				? webMediaUrl({
						type: "episode",
						showId,
						showName: name,
						seasonNumber: media.seasonNumber ?? 0,
						episodeNumber: media.episodeNumber ?? 0,
					})
				: webMediaUrl({
						type: media.mediaType === "movie" ? "movie" : "show",
						id: showId,
						name,
					});
	return `${base}?review=${encodeURIComponent(`/reviews/${handle}/${rkey}`)}`;
}

/** Public web URL for a user's list, mirroring apps/web's `/profile/$handle/lists/$listSlug` route. */
export function webListUrl(handle: string, listSlug: string): string {
	return `${env.siteUrl}/profile/${handle}/lists/${listSlug}`;
}
