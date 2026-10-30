import { Injectable } from "@nestjs/common";
import { MoviesTmdbService } from "../movies/movies-tmdb.service";
import { ShowsTmdbService } from "../shows/shows-tmdb.service";
import type { PopfeedMedia, PopfeedMediaLookup } from "./popfeed-writer";

/** TMDB details for the fields Popfeed records carry next to their identifiers. */
@Injectable()
export class PopfeedMediaService implements PopfeedMediaLookup {
	constructor(
		private readonly movies: MoviesTmdbService,
		private readonly shows: ShowsTmdbService,
	) {}

	async media(type: "movie" | "show", tmdbId: string): Promise<PopfeedMedia> {
		if (type === "movie") {
			const [movie, credits] = await Promise.all([
				this.movies.getMovieDetails(tmdbId),
				this.movies.getMovieCredits(tmdbId).catch(() => null),
			]);
			return {
				title: movie.title,
				releaseDate: movie.release_date || undefined,
				genres: (movie.genres ?? []).map((genre) => genre.name),
				mainCredit: credits?.crew.find((member) => member.job === "Director")
					?.name,
				posterPath: movie.poster_path,
				backdropPath: movie.backdrop_path,
			};
		}
		const show = await this.shows.getShowDetails(tmdbId);
		return {
			title: show.name,
			releaseDate: show.first_air_date || undefined,
			genres: (show.genres ?? []).map((genre) => genre.name),
			mainCredit: show.created_by?.[0]?.name,
			posterPath: show.poster_path,
			backdropPath: show.backdrop_path,
		};
	}
}
