import type { TMDBMovie } from "../movies/movies-tmdb.service";
import type { TMDBShow } from "../shows/shows-tmdb.service";
import type { TraktMatchCandidateDto } from "./trakt-sync.dto";
function yearFromDate(value?: string): number | undefined {
	if (!value) return undefined;
	const year = Number.parseInt(value.slice(0, 4), 10);
	return Number.isInteger(year) ? year : undefined;
}
function candidateYearScore(
	value: string | undefined,
	sourceYear: number | null,
): number {
	if (!sourceYear) return 0;
	return yearFromDate(value) === sourceYear ? 1 : 0;
}
/** Top 10 TMDB movie results, same-year titles first. */
export function rankMovieMatchCandidates(
	results: TMDBMovie[],
	sourceYear: number | null,
): TraktMatchCandidateDto[] {
	return [...results]
		.sort(
			(a, b) =>
				candidateYearScore(b.release_date, sourceYear) -
				candidateYearScore(a.release_date, sourceYear),
		)
		.slice(0, 10)
		.map((movie) => ({
			tmdbId: String(movie.id),
			mediaType: "movie" as const,
			title: movie.title,
			year: yearFromDate(movie.release_date),
			posterPath: movie.poster_path,
			overview: movie.overview,
		}));
}

/** Top 10 TMDB show results, same-year titles first. */
export function rankShowMatchCandidates(
	results: TMDBShow[],
	sourceYear: number | null,
): TraktMatchCandidateDto[] {
	return [...results]
		.sort(
			(a, b) =>
				candidateYearScore(b.first_air_date, sourceYear) -
				candidateYearScore(a.first_air_date, sourceYear),
		)
		.slice(0, 10)
		.map((show) => ({
			tmdbId: String(show.id),
			mediaType: "show" as const,
			title: show.name,
			year: yearFromDate(show.first_air_date),
			posterPath: show.poster_path,
			overview: show.overview,
		}));
}
