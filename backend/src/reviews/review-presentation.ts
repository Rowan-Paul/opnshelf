import slugifyLib from "slugify";

/**
 * Pure presentation helpers shared by the API responses, the Blog Mirror and
 * the Bluesky Cross-post: the public page of the media a Review points at, and
 * the read-time excerpt of a Review body. No I/O lives here.
 */

// Canonical public site. NEVER opnshelf.social (that is only the PDS host).
export const PUBLIC_SITE_ORIGIN = "https://opnshelf.xyz";

// Poster size for the metadata header of the blog mirror (a review-sized image,
// not a full-bleed backdrop).
export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342";

export type MediaType = "movie" | "show" | "season" | "episode";

export const MEDIA_TYPE_LABEL: Record<MediaType, string> = {
	movie: "Movie",
	show: "TV series",
	season: "Season",
	episode: "Episode",
};

/**
 * Canonical media-name slug. Must stay identical to `slugifyName` in
 * @opnshelf/api — see the parity test in review-presentation.spec.ts. The
 * backend cannot import that package (it would pull the whole generated
 * client), so this is a deliberate second copy guarded by a test.
 */
export function slugifyMediaName(name: string): string {
	// The `|| "-"` matters: an empty slug collapses the URL to `/movies/603/`,
	// which matches no route. Kept identical to @opnshelf/api.
	return slugifyLib(name, { lower: true, strict: true, trim: true }) || "-";
}

/**
 * Public opnshelf page for a media item. The trailing slug is cosmetic — web
 * routes resolve by id (and season/episode numbers) — so a slug of the media
 * title is fine even for the composite season/episode titles.
 */
/**
 * Public opnshelf.xyz URL for a Media Item. These go out in Bluesky
 * Cross-posts and Blog Mirrors, so they are the most visible URLs we emit and
 * must be byte-identical to what the Web App and Mobile App build (ADR 0023).
 *
 * `mediaTitle` must be the movie or show title, never the composite label: web
 * slugs an episode URL from the show name alone. And the slug uses the same
 * options as `slugifyName` in @opnshelf/api, not the blog-path `slugify` in
 * blog-mirror.service.ts, which mangles accents ("Pokémon" -> "pok-mon").
 */
export function mediaPageUrl(
	mediaType: MediaType,
	mediaId: string,
	seasonNumber: number | undefined,
	episodeNumber: number | undefined,
	mediaTitle: string,
): string {
	const slug = slugifyMediaName(mediaTitle);
	switch (mediaType) {
		case "movie":
			return `${PUBLIC_SITE_ORIGIN}/movies/${mediaId}/${slug}`;
		case "show":
			return `${PUBLIC_SITE_ORIGIN}/shows/${mediaId}/${slug}`;
		case "season":
			return `${PUBLIC_SITE_ORIGIN}/shows/${mediaId}/${slug}/seasons/${seasonNumber}`;
		case "episode":
			return `${PUBLIC_SITE_ORIGIN}/shows/${mediaId}/${slug}/seasons/${seasonNumber}/episodes/${episodeNumber}`;
	}
}

/** Strip a small plaintext excerpt out of markdown for previews/mirror. */
export function toPlainText(markdown: string): string {
	return markdown
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/`[^`]*`/g, " ")
		.replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
		.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/^#{1,6}\s+/gm, "")
		.replace(/[*_~>#-]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

export function excerpt(plain: string, max = 280): string {
	if (plain.length <= max) return plain;
	return `${plain.slice(0, max - 1).trimEnd()}…`;
}

/** Short plaintext excerpt of a review body, computed on read (not stored). */
export function excerptOf(markdown: string): string {
	return excerpt(toPlainText(markdown));
}
