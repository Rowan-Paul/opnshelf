import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { PersonFilmographyItemDto } from "./dto/person.dto";

export interface TMDBPerson {
	id: number;
	name: string;
	profile_path?: string;
	biography?: string;
	birthday?: string;
	deathday?: string;
	place_of_birth?: string;
	known_for_department?: string;
	popularity?: number;
}

export interface TMDBMovieCredit {
	id: number;
	title: string;
	poster_path?: string;
	release_date?: string;
	vote_average?: number;
	character?: string;
	job?: string;
	department?: string;
	order?: number;
}

export interface TMDBTvCredit {
	id: number;
	name: string;
	poster_path?: string;
	first_air_date?: string;
	vote_average?: number;
	character?: string;
	job?: string;
	department?: string;
	order?: number;
}

export interface TMDBMovieCreditsResponse {
	cast: TMDBMovieCredit[];
	crew: TMDBMovieCredit[];
}

export interface TMDBTvCreditsResponse {
	cast: TMDBTvCredit[];
	crew: TMDBTvCredit[];
}

@Injectable()
export class PeopleTmdbService {
	private readonly logger = new Logger(PeopleTmdbService.name);
	private readonly tmdbApiKey: string;
	private readonly tmdbBaseUrl = "https://api.themoviedb.org/3";

	constructor(private config: ConfigService) {
		this.tmdbApiKey = this.config.get("TMDB_API_KEY") ?? "";
	}

	async getPersonDetails(personId: string): Promise<TMDBPerson> {
		const response = await fetch(
			`${this.tmdbBaseUrl}/person/${personId}?api_key=${this.tmdbApiKey}`,
		);

		if (!response.ok) {
			throw new Error("Person not found");
		}

		return response.json() as Promise<TMDBPerson>;
	}

	async getPersonMovieCredits(
		personId: string,
	): Promise<TMDBMovieCreditsResponse> {
		const response = await fetch(
			`${this.tmdbBaseUrl}/person/${personId}/movie_credits?api_key=${this.tmdbApiKey}`,
		);

		if (!response.ok) {
			this.logger.warn(`Failed to fetch movie credits for person ${personId}`);
			return { cast: [], crew: [] };
		}

		return response.json() as Promise<TMDBMovieCreditsResponse>;
	}

	async getPersonTvCredits(personId: string): Promise<TMDBTvCreditsResponse> {
		const response = await fetch(
			`${this.tmdbBaseUrl}/person/${personId}/tv_credits?api_key=${this.tmdbApiKey}`,
		);

		if (!response.ok) {
			this.logger.warn(`Failed to fetch TV credits for person ${personId}`);
			return { cast: [], crew: [] };
		}

		return response.json() as Promise<TMDBTvCreditsResponse>;
	}

	async getCombinedFilmography(
		personId: string,
	): Promise<PersonFilmographyItemDto[]> {
		const [movieCredits, tvCredits] = await Promise.all([
			this.getPersonMovieCredits(personId),
			this.getPersonTvCredits(personId),
		]);

		// Transform movie credits
		const movieItems: PersonFilmographyItemDto[] = [
			...movieCredits.cast.map(
				(credit): PersonFilmographyItemDto => ({
					id: credit.id,
					media_type: "movie",
					title: credit.title,
					poster_path: credit.poster_path,
					release_date: credit.release_date,
					character: credit.character,
					department: "Acting",
					order: credit.order,
					vote_average: credit.vote_average,
				}),
			),
			...movieCredits.crew.map(
				(credit): PersonFilmographyItemDto => ({
					id: credit.id,
					media_type: "movie",
					title: credit.title,
					poster_path: credit.poster_path,
					release_date: credit.release_date,
					job: credit.job,
					department: credit.department,
					vote_average: credit.vote_average,
				}),
			),
		];

		// Transform TV credits
		const tvItems: PersonFilmographyItemDto[] = [
			...tvCredits.cast.map(
				(credit): PersonFilmographyItemDto => ({
					id: credit.id,
					media_type: "tv",
					title: credit.name,
					poster_path: credit.poster_path,
					first_air_date: credit.first_air_date,
					character: credit.character,
					department: "Acting",
					order: credit.order,
					vote_average: credit.vote_average,
				}),
			),
			...tvCredits.crew.map(
				(credit): PersonFilmographyItemDto => ({
					id: credit.id,
					media_type: "tv",
					title: credit.name,
					poster_path: credit.poster_path,
					first_air_date: credit.first_air_date,
					job: credit.job,
					department: credit.department,
					vote_average: credit.vote_average,
				}),
			),
		];

		// Combine all items
		const allItems = [...movieItems, ...tvItems];

		// Sort by release date (newest first), with unknown dates at the end
		allItems.sort((a, b) => {
			const dateA = a.release_date || a.first_air_date || "";
			const dateB = b.release_date || b.first_air_date || "";

			if (!dateA && !dateB) return 0;
			if (!dateA) return 1; // Unknown dates go to the end
			if (!dateB) return -1;

			return new Date(dateB).getTime() - new Date(dateA).getTime();
		});

		return allItems;
	}
}
