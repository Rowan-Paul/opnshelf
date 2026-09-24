import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TMDB_CACHE_STORE } from "../tmdb/tmdb-cache.module";
import type { TmdbCacheStore } from "../tmdb/tmdb-cache.store";
import {
	groupCrewByDepartment,
	sortCrewByJob,
	SUMMARY_CAST_LIMIT,
	summarizeCrew,
	type TMDBCreditsSummary,
	type TMDBFullCredits,
	trimCast,
	trimCrew,
} from "../tmdb/tmdb-credits.util";
import {
	TMDB_DETAIL_CACHE_TTL_MS,
	TMDB_LIST_CACHE_TTL_MS,
	TmdbHttpClient,
	tmdbErrorForResponse,
} from "../tmdb/tmdb-http";
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

/** Crew jobs hoisted to the front of a movie's crew list. */
const KEY_CREW_JOBS = [
	"Director",
	"Producer",
	"Executive Producer",
	"Screenplay",
	"Writer",
	"Director of Photography",
	"Original Music Composer",
	"Composer",
];

@Injectable()
export class MoviesTmdbService {
	private readonly logger = new Logger(MoviesTmdbService.name);
	private readonly tmdbApiKey: string;
	private readonly tmdbBaseUrl = "https://api.themoviedb.org/3";
	private readonly http: TmdbHttpClient;

	constructor(
		private config: ConfigService,
		@Optional() @Inject(TMDB_CACHE_STORE) cacheStore?: TmdbCacheStore,
	) {
		this.tmdbApiKey = this.config.get("TMDB_API_KEY") ?? "";
		this.http = new TmdbHttpClient(
			this.tmdbApiKey,
			MoviesTmdbService.name,
			cacheStore,
		);
	}

	async searchMovies(
		query: string,
		page: number = 1,
	): Promise<TMDBSearchResponse> {
		const response = await this.http.fetchCached(
			`${this.tmdbBaseUrl}/search/movie?api_key=${this.tmdbApiKey}&query=${encodeURIComponent(query)}&page=${page}`,
			`search:movie:${query}:${page}`,
			TMDB_LIST_CACHE_TTL_MS,
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
			TMDB_LIST_CACHE_TTL_MS,
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
			TMDB_LIST_CACHE_TTL_MS,
		);
		if (recs.ok) {
			const data = await recs.json<TMDBSearchResponse>();
			if (data.results.length > 0) return data;
		}

		const similar = await this.http.fetchCached(
			`${this.tmdbBaseUrl}/movie/${movieId}/similar?api_key=${this.tmdbApiKey}&page=${page}`,
			`movie:similar:${movieId}:${page}`,
			TMDB_LIST_CACHE_TTL_MS,
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
				TMDB_DETAIL_CACHE_TTL_MS,
			),
			this.http.fetchCached(
				`${this.tmdbBaseUrl}/movie/${movieId}/videos?api_key=${this.tmdbApiKey}`,
				`movie:videos:${movieId}`,
				TMDB_DETAIL_CACHE_TTL_MS,
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

	private async fetchCredits(movieId: string): Promise<TMDBCredits | null> {
		const response = await this.http.fetchCached(
			`${this.tmdbBaseUrl}/movie/${movieId}/credits?api_key=${this.tmdbApiKey}`,
			`movie:credits:${movieId}`,
			TMDB_DETAIL_CACHE_TTL_MS,
		);

		if (!response.ok) {
			this.logger.warn(`Failed to fetch credits for movie ${movieId}`);
			return null;
		}

		const data = await response.json<TMDBCredits>();
		return {
			cast: trimCast(data.cast).sort((a, b) => (a.order || 0) - (b.order || 0)),
			crew: sortCrewByJob(trimCrew(data.crew), KEY_CREW_JOBS),
		};
	}

	/** Summary for the detail page: top billing and key jobs, plus the totals. */
	async getMovieCredits(movieId: string): Promise<TMDBCreditsSummary | null> {
		const data = await this.fetchCredits(movieId);
		if (!data) return null;

		return {
			cast: data.cast.slice(0, SUMMARY_CAST_LIMIT),
			crew: summarizeCrew(data.crew, KEY_CREW_JOBS),
			cast_total: data.cast.length,
			crew_total: data.crew.length,
		};
	}

	/** Everything, grouped by department, for the expanded credits view. */
	async getFullMovieCredits(movieId: string): Promise<TMDBFullCredits | null> {
		const data = await this.fetchCredits(movieId);
		if (!data) return null;

		return {
			cast: data.cast,
			crew: groupCrewByDepartment(data.crew),
		};
	}

	async getWatchProviders(
		movieId: string,
	): Promise<WatchProvidersResponse | null> {
		const response = await this.http.fetchCached(
			`${this.tmdbBaseUrl}/movie/${movieId}/watch/providers?api_key=${this.tmdbApiKey}`,
			`movie:watchProviders:${movieId}`,
			TMDB_DETAIL_CACHE_TTL_MS,
		);

		if (!response.ok) {
			this.logger.warn(`Failed to fetch watch providers for movie ${movieId}`);
			return null;
		}

		return response.json<WatchProvidersResponse>();
	}
}
