import { Injectable } from "@nestjs/common";
import { PeopleTmdbService } from "./people-tmdb.service";
import type {
	TmdbPersonDetailDto,
	PersonFilmographyResponseDto,
	PersonSearchResponseDto,
} from "./dto/person.dto";

@Injectable()
export class PeopleService {
	constructor(private readonly peopleTmdbService: PeopleTmdbService) {}

	async searchPeople(
		query: string,
		page: number = 1,
	): Promise<PersonSearchResponseDto> {
		const {
			results,
			page: tmdbPage,
			total_results,
			total_pages,
		} = await this.peopleTmdbService.searchPeople(query, page);

		return {
			results: results.map((p) => ({
				id: p.id,
				name: p.name,
				profile_path: p.profile_path,
				known_for_department: p.known_for_department,
				popularity: p.popularity,
			})),
			page: tmdbPage,
			total_results,
			total_pages,
		};
	}

	async getPersonDetails(personId: string): Promise<TmdbPersonDetailDto> {
		const person = await this.peopleTmdbService.getPersonDetails(personId);

		return {
			id: person.id,
			name: person.name,
			profile_path: person.profile_path,
			biography: person.biography,
			birthday: person.birthday,
			deathday: person.deathday,
			place_of_birth: person.place_of_birth,
			known_for_department: person.known_for_department,
			popularity: person.popularity,
			filmography: [], // Filmography is now fetched separately with pagination
		};
	}

	async getPersonFilmography(
		personId: string,
		page: number = 1,
		pageSize: number = 20,
	): Promise<PersonFilmographyResponseDto> {
		const filmography =
			await this.peopleTmdbService.getCombinedFilmography(personId);

		const total = filmography.length;
		const totalPages = Math.ceil(total / pageSize);
		const startIndex = (page - 1) * pageSize;
		const endIndex = startIndex + pageSize;
		const paginatedItems = filmography.slice(startIndex, endIndex);

		return {
			items: paginatedItems,
			total,
			page,
			pageSize,
			totalPages,
		};
	}
}
