import slugify from "slugify";

/**
 * Convert a show/movie name to a URL-friendly slug
 */
export function slugifyName(name: string): string {
	return slugify(name, {
		lower: true,
		strict: true,
		trim: true,
	});
}

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
