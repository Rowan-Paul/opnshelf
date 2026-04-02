import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { TmdbPersonDetailDto } from "./dto/person.dto";
import { PeopleService } from "./people.service";

@ApiTags("People")
@Controller("people")
export class PeopleController {
	constructor(private readonly peopleService: PeopleService) {}

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
}
