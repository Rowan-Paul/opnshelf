import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sortCrewByJob } from "../tmdb/tmdb-credits.util";
import { TmdbHttpClient, tmdbErrorForResponse } from "../tmdb/tmdb-http";
import {
	selectBestTMDBTrailer,
	type TMDBTrailer,
	type TMDBVideo,
} from "../tmdb/tmdb-trailer.util";

export interface TMDBMovie {
	id: number;
	title: string;
	poster_path?: string;
	backdrop_path?: string;
	release_date?: string;
	overview?: string;
	popularity: number;
	vote_average: number;
	vote_count: number;
	trailer?: TMDBTrailer;
}

export interface TMDBSearchResponse {
	page: number;
	results: TMDBMovie[];
	total_results: number;
	total_pages: number;
}

export interface WatchProvider {
	logo_path: string;
	provider_id: number;
	provider_name: string;
	display_priority: number;
}

export interface WatchProvidersResult {
	link: string;
	flatrate?: WatchProvider[];
	rent?: WatchProvider[];
	buy?: WatchProvider[];
	ads?: WatchProvider[];
	free?: WatchProvider[];
}

export interface WatchProvidersResponse {
	id: number;
	results: Record<string, WatchProvidersResult>;
}

export interface TMDBCredits {
	cast: {
		id: number;
		name: string;
		character?: string;
		profile_path?: string;
		order: number;
	}[];
	crew: {
		id: number;
		name: string;
		job?: string;
		department?: string;
		profile_path?: string;
	}[];
}

type TMDBVideosResponse = {
	results?: TMDBVideo[];
};

@Injectable()
export class MoviesTmdbService {
	private readonly logger = new Logger(MoviesTmdbService.name);
	private readonly tmdbApiKey: string;
	private readonly tmdbBaseUrl = "https://api.themoviedb.org/3";
	private readonly http: TmdbHttpClient;

	constructor(private config: ConfigService) {
		this.tmdbApiKey = this.config.get("TMDB_API_KEY") ?? "";
		this.http = new TmdbHttpClient(this.tmdbApiKey, MoviesTmdbService.name);
	}

	async searchMovies(
		query: string,
		page: number = 1,
	): Promise<TMDBSearchResponse> {
		const response = await this.http.fetchCached(
			`${this.tmdbBaseUrl}/search/movie?api_key=${this.tmdbApiKey}&query=${encodeURIComponent(query)}&page=${page}`,
			`search:movie:${query}:${page}`,
		);

		if (!response.ok) {
			throw tmdbErrorForResponse(response, "Failed to search movies");
		}

		return response.json<TMDBSearchResponse>();
	}

	async discoverMovies(
		sortBy: string = "popularity.desc",
		page: number = 1,
		year?: number,
	): Promise<TMDBSearchResponse> {
		let url = `${this.tmdbBaseUrl}/discover/movie?api_key=${this.tmdbApiKey}&sort_by=${sortBy}&page=${page}`;

		if (year) {
			url += `&primary_release_year=${year}`;
		}

		const response = await this.http.fetchCached(
			url,
			`discover:movie:${sortBy}:${page}:${year ?? ""}`,
		);

		if (!response.ok) {
			throw tmdbErrorForResponse(response, "Failed to discover movies");
		}

		return response.json<TMDBSearchResponse>();
	}

	/**
	 * TMDB's per-title recommendations, falling back to /similar when
	 * recommendations come back empty (common for obscure or brand-new titles).
	 */
	async getRecommendations(
		movieId: string,
		page: number = 1,
	): Promise<TMDBSearchResponse> {
		const recs = await this.http.fetchCached(
			`${this.tmdbBaseUrl}/movie/${movieId}/recommendations?api_key=${this.tmdbApiKey}&page=${page}`,
			`movie:recommendations:${movieId}:${page}`,
		);
		if (recs.ok) {
			const data = await recs.json<TMDBSearchResponse>();
			if (data.results.length > 0) return data;
		}

		const similar = await this.http.fetchCached(
			`${this.tmdbBaseUrl}/movie/${movieId}/similar?api_key=${this.tmdbApiKey}&page=${page}`,
			`movie:similar:${movieId}:${page}`,
		);
		if (!similar.ok) {
			throw tmdbErrorForResponse(similar, "Failed to fetch recommendations");
		}
		return similar.json<TMDBSearchResponse>();
	}

	async getMovieDetails(movieId: string): Promise<TMDBMovie> {
		const [detailResponse, videosResponse] = await Promise.all([
			this.http.fetchCached(
				`${this.tmdbBaseUrl}/movie/${movieId}?api_key=${this.tmdbApiKey}`,
				`movie:detail:${movieId}`,
			),
			this.http.fetchCached(
				`${this.tmdbBaseUrl}/movie/${movieId}/videos?api_key=${this.tmdbApiKey}`,
				`movie:videos:${movieId}`,
			),
		]);

		if (!detailResponse.ok) {
			throw tmdbErrorForResponse(detailResponse, "Movie not found");
		}

		const movie = await detailResponse.json<TMDBMovie>();
		const videosData = videosResponse.ok
			? await videosResponse.json<TMDBVideosResponse>()
			: undefined;

		return {
			...movie,
			trailer: selectBestTMDBTrailer(videosData?.results, "movie"),
		};
	}

	async getMovieCredits(movieId: string): Promise<TMDBCredits | null> {
		const response = await this.http.fetch(
			`${this.tmdbBaseUrl}/movie/${movieId}/credits?api_key=${this.tmdbApiKey}`,
		);

		if (!response.ok) {
			this.logger.warn(`Failed to fetch credits for movie ${movieId}`);
			return null;
		}

		const data = await response.json<TMDBCredits>();

		const sortedCast = (data.cast || []).sort(
			(a, b) => (a.order || 0) - (b.order || 0),
		);

		const keyJobs = [
			"Director",
			"Producer",
			"Executive Producer",
			"Screenplay",
			"Writer",
			"Director of Photography",
			"Original Music Composer",
			"Composer",
		];
		return {
			cast: sortedCast,
			crew: sortCrewByJob(data.crew, keyJobs),
		};
	}

	async getWatchProviders(
		movieId: string,
	): Promise<WatchProvidersResponse | null> {
		const response = await this.http.fetch(
			`${this.tmdbBaseUrl}/movie/${movieId}/watch/providers?api_key=${this.tmdbApiKey}`,
		);

		if (!response.ok) {
			this.logger.warn(`Failed to fetch watch providers for movie ${movieId}`);
			return null;
		}

		return response.json<WatchProvidersResponse>();
	}
}
