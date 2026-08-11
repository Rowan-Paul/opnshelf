// The slug lives in @opnshelf/api so the Web App and the Mobile App build
// byte-identical URLs (ADR 0023). Re-exported for callers that import it here.
import { slugifyName } from "@opnshelf/api";

export { slugifyName };

/**
 * Build a show detail URL
 * Format: /shows/[showId]/[showName]
 */
export function buildShowUrl(
	showId: string | number,
	showName: string,
): string {
	const slug = slugifyName(showName);
	return `/shows/${showId}/${slug}`;
}

/**
 * Build a season detail URL
 * Format: /shows/[showId]/[showName]/seasons/[seasonNumber]
 */
export function buildSeasonUrl(
	showId: string | number,
	showName: string,
	seasonNumber: number,
): string {
	const slug = slugifyName(showName);
	return `/shows/${showId}/${slug}/seasons/${seasonNumber}`;
}

/**
 * Build an episode detail URL
 * Format: /shows/[showId]/[showName]/seasons/[seasonNumber]/episodes/[episodeNumber]
 */
export function buildEpisodeUrl(
	showId: string | number,
	showName: string,
	seasonNumber: number,
	episodeNumber: number,
): string {
	const slug = slugifyName(showName);
	return `/shows/${showId}/${slug}/seasons/${seasonNumber}/episodes/${episodeNumber}`;
}

/**
 * Build a movie detail URL
 * Format: /movies/[movieId]/[movieName]
 */
export function buildMovieUrl(
	movieId: string | number,
	movieName: string,
): string {
	const slug = slugifyName(movieName);
	return `/movies/${movieId}/${slug}`;
}

/**
 * Build a person detail URL
 * Format: /people/[personId]/[personName]
 */
export function buildPersonUrl(
	personId: string | number,
	personName: string,
): string {
	const slug = slugifyName(personName);
	return `/people/${personId}/${slug}`;
}
