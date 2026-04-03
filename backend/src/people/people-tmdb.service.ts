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
	backdrop_path?: string;
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
	backdrop_path?: string;
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

		// Use a Map to deduplicate and merge cast/crew credits
		const itemsMap = new Map<string, PersonFilmographyItemDto>();

		// Helper to get or create item
		const getOrCreateItem = (
			key: string,
			baseItem: Omit<PersonFilmographyItemDto, "roles">,
		): PersonFilmographyItemDto => {
			if (!itemsMap.has(key)) {
				itemsMap.set(key, { ...baseItem, roles: [] });
			}
			return itemsMap.get(key)!;
		};

		// Process movie cast credits
		for (const credit of movieCredits.cast) {
			const key = `movie-${credit.id}`;
			const item = getOrCreateItem(key, {
				id: credit.id,
				media_type: "movie",
				title: credit.title,
				poster_path: credit.poster_path,
				backdrop_path: credit.backdrop_path,
				release_date: credit.release_date,
				vote_average: credit.vote_average,
			});
			item.roles?.push({
				type: "cast",
				character: credit.character,
				order: credit.order,
			});
		}

		// Process movie crew credits
		for (const credit of movieCredits.crew) {
			const key = `movie-${credit.id}`;
			const item = getOrCreateItem(key, {
				id: credit.id,
				media_type: "movie",
				title: credit.title,
				poster_path: credit.poster_path,
				backdrop_path: credit.backdrop_path,
				release_date: credit.release_date,
				vote_average: credit.vote_average,
			});
			item.roles?.push({
				type: "crew",
				job: credit.job,
				department: credit.department,
			});
		}

		// Process TV cast credits
		for (const credit of tvCredits.cast) {
			const key = `tv-${credit.id}`;
			const item = getOrCreateItem(key, {
				id: credit.id,
				media_type: "tv",
				title: credit.name,
				poster_path: credit.poster_path,
				backdrop_path: credit.backdrop_path,
				first_air_date: credit.first_air_date,
				vote_average: credit.vote_average,
			});
			item.roles?.push({
				type: "cast",
				character: credit.character,
				order: credit.order,
			});
		}

		// Process TV crew credits
		for (const credit of tvCredits.crew) {
			const key = `tv-${credit.id}`;
			const item = getOrCreateItem(key, {
				id: credit.id,
				media_type: "tv",
				title: credit.name,
				poster_path: credit.poster_path,
				backdrop_path: credit.backdrop_path,
				first_air_date: credit.first_air_date,
				vote_average: credit.vote_average,
			});
			item.roles?.push({
				type: "crew",
				job: credit.job,
				department: credit.department,
			});
		}

		// Convert map to array and sort roles for each item
		const allItems = Array.from(itemsMap.values());

		for (const item of allItems) {
			if (item.roles && item.roles.length > 0) {
				// Sort roles: cast first (by order), then crew (alphabetically by job)
				item.roles.sort((a, b) => {
					// Cast roles come first
					if (a.type === "cast" && b.type !== "cast") return -1;
					if (a.type !== "cast" && b.type === "cast") return 1;

					// For cast roles, sort by order (lower order = higher billing)
					if (a.type === "cast" && b.type === "cast") {
						const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
						const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
						return orderA - orderB;
					}

					// For crew roles, sort alphabetically by job
					const jobA = a.job ?? "";
					const jobB = b.job ?? "";
					return jobA.localeCompare(jobB);
				});

				// Set legacy fields from first role for backward compatibility
				const firstRole = item.roles[0];
				if (firstRole.type === "cast") {
					item.character = firstRole.character;
					item.order = firstRole.order;
				} else {
					item.job = firstRole.job;
					item.department = firstRole.department;
				}
			}
		}

		// Sort items by release date (newest first), with unknown dates at the end
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
