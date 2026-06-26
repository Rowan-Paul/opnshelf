import {
	Controller,
	Get,
	NotFoundException,
	Param,
	Query,
} from "@nestjs/common";
import {
	ApiOperation,
	ApiParam,
	ApiQuery,
	ApiResponse,
	ApiTags,
} from "@nestjs/swagger";
import {
	TmdbPersonDetailDto,
	PersonFilmographyResponseDto,
	PersonSearchResponseDto,
} from "./dto/person.dto";
import { PeopleService } from "./people.service";

@ApiTags("People")
@Controller("people")
export class PeopleController {
	constructor(private readonly peopleService: PeopleService) {}

	// Declared before `tmdb/:personId` so "search" isn't matched as a personId.
	@Get("tmdb/search")
	@ApiOperation({ summary: "Search people (cast & crew) on TMDB" })
	@ApiQuery({ name: "query", required: true, description: "Search term" })
	@ApiQuery({
		name: "page",
		required: false,
		description: "Page number (1-based)",
		type: Number,
	})
	@ApiResponse({ status: 200, type: PersonSearchResponseDto })
	async searchPeople(
		@Query("query") query: string,
		@Query("page") page?: string,
	): Promise<PersonSearchResponseDto> {
		return this.peopleService.searchPeople(
			query ?? "",
			page ? parseInt(page, 10) : 1,
		);
	}

	@Get("tmdb/:personId")
	@ApiOperation({ summary: "Get person details from TMDB" })
	@ApiParam({
		name: "personId",
		description: "TMDB person ID",
		type: String,
	})
	@ApiResponse({
		status: 200,
		description: "Person details retrieved successfully",
		type: TmdbPersonDetailDto,
	})
	@ApiResponse({ status: 404, description: "Person not found" })
	async getPersonDetails(
		@Param("personId") personId: string,
	): Promise<TmdbPersonDetailDto> {
		try {
			return await this.peopleService.getPersonDetails(personId);
		} catch (error) {
			if (error instanceof Error && error.message === "Person not found") {
				throw new NotFoundException("Person not found");
			}
			throw error;
		}
	}

	@Get("tmdb/:personId/filmography")
	@ApiOperation({ summary: "Get paginated person filmography from TMDB" })
	@ApiParam({
		name: "personId",
		description: "TMDB person ID",
		type: String,
	})
	@ApiQuery({
		name: "page",
		required: false,
		description: "Page number (1-based)",
		type: Number,
	})
	@ApiQuery({
		name: "pageSize",
		required: false,
		description: "Items per page",
		type: Number,
	})
	@ApiResponse({
		status: 200,
		description: "Filmography retrieved successfully",
		type: PersonFilmographyResponseDto,
	})
	@ApiResponse({ status: 404, description: "Person not found" })
	async getPersonFilmography(
		@Param("personId") personId: string,
		@Query("page") page?: string,
		@Query("pageSize") pageSize?: string,
	): Promise<PersonFilmographyResponseDto> {
		try {
			const pageNum = page ? parseInt(page, 10) : 1;
			const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 20;
			return await this.peopleService.getPersonFilmography(
				personId,
				pageNum,
				pageSizeNum,
			);
		} catch (error) {
			if (error instanceof Error && error.message === "Person not found") {
				throw new NotFoundException("Person not found");
			}
			throw error;
		}
	}
}
