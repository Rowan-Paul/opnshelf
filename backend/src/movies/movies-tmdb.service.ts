import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

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
}

export interface TMDBSearchResponse {
	page: number;
	results: TMDBMovie[];
	total_results: number;
	total_pages: number;
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

@Injectable()
export class MoviesTmdbService {
	private readonly logger = new Logger(MoviesTmdbService.name);
	private readonly tmdbApiKey: string;
	private readonly tmdbBaseUrl = "https://api.themoviedb.org/3";

	constructor(private config: ConfigService) {
		this.tmdbApiKey = this.config.get("TMDB_API_KEY") ?? "";
	}

	async searchMovies(
		query: string,
		page: number = 1,
	): Promise<TMDBSearchResponse> {
		const response = await fetch(
			`${this.tmdbBaseUrl}/search/movie?api_key=${this.tmdbApiKey}&query=${encodeURIComponent(query)}&page=${page}`,
		);

		if (!response.ok) {
			throw new Error("Failed to search movies");
		}

		return response.json() as Promise<TMDBSearchResponse>;
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

		const response = await fetch(url);

		if (!response.ok) {
			throw new Error("Failed to discover movies");
		}

		return response.json() as Promise<TMDBSearchResponse>;
	}

	async getMovieDetails(movieId: string): Promise<TMDBMovie> {
		const response = await fetch(
			`${this.tmdbBaseUrl}/movie/${movieId}?api_key=${this.tmdbApiKey}`,
		);

		if (!response.ok) {
			throw new Error("Movie not found");
		}

		return response.json() as Promise<TMDBMovie>;
	}

	async getMovieCredits(movieId: string): Promise<TMDBCredits | null> {
		const response = await fetch(
			`${this.tmdbBaseUrl}/movie/${movieId}/credits?api_key=${this.tmdbApiKey}`,
		);

		if (!response.ok) {
			this.logger.warn(`Failed to fetch credits for movie ${movieId}`);
			return null;
		}

		const data = (await response.json()) as TMDBCredits;

		const sortedCast = (data.cast || [])
			.sort((a, b) => (a.order || 0) - (b.order || 0))
			.slice(0, 15);

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
		const filteredCrew = (data.crew || [])
			.filter((member) => keyJobs.includes(member.job || ""))
			.slice(0, 10);

		return {
			cast: sortedCast,
			crew: filteredCrew,
		};
	}
}
