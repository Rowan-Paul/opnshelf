import { Injectable } from "@nestjs/common";
import { PeopleTmdbService } from "./people-tmdb.service";
import type { TmdbPersonDetailDto } from "./dto/person.dto";

@Injectable()
export class PeopleService {
	constructor(private readonly peopleTmdbService: PeopleTmdbService) {}

	async getPersonDetails(personId: string): Promise<TmdbPersonDetailDto> {
		const [person, filmography] = await Promise.all([
			this.peopleTmdbService.getPersonDetails(personId),
			this.peopleTmdbService.getCombinedFilmography(personId),
		]);

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
			filmography,
		};
	}
}
