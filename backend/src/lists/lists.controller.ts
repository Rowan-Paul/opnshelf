import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Post,
	Put,
	Req,
	UseGuards,
} from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiCreatedResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
	ApiParam,
	ApiTags,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import { ListsService, type ATSession } from "./lists.service";
import {
	AddToListDto,
	CreateListDto,
	MovieListDto,
	MovieListsForMovieDto,
	MovieListSummaryDto,
	MovieListWithMoviesDto,
	UpdateListDto,
} from "./dto/list.dto";

@ApiTags("lists")
@Controller("lists")
export class ListsController {
	constructor(private readonly listsService: ListsService) {}

	@Get()
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Get all lists for the authenticated user" })
	@ApiOkResponse({
		description: "List of user's lists",
		type: [MovieListSummaryDto],
	})
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async getUserLists(
		@Req() req: AuthenticatedRequest,
	): Promise<MovieListSummaryDto[]> {
		await this.listsService.ensureDefaultLists(
			req.user.did,
			req.user.session as ATSession,
		);
		return this.listsService.getUserLists(req.user.did);
	}

	@Post()
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Create a new list" })
	@ApiCreatedResponse({ description: "List created", type: MovieListDto })
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async createList(
		@Req() req: AuthenticatedRequest,
		@Body() dto: CreateListDto,
	): Promise<MovieListDto> {
		return this.listsService.createList(
			req.user.did,
			req.user.session as ATSession,
			dto,
		);
	}

	@Post("init-defaults")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Initialize default lists (watchlist, favorites)" })
	@ApiOkResponse({ description: "Default lists", type: [MovieListDto] })
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async initDefaultLists(
		@Req() req: AuthenticatedRequest,
	): Promise<MovieListDto[]> {
		return this.listsService.ensureDefaultLists(
			req.user.did,
			req.user.session as ATSession,
		);
	}

	@Get(":slug")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Get a specific list with its movies" })
	@ApiParam({ name: "slug", description: "List slug identifier" })
	@ApiOkResponse({
		description: "List details with movies",
		type: MovieListWithMoviesDto,
	})
	@ApiNotFoundResponse({ description: "List not found" })
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async getList(
		@Req() req: AuthenticatedRequest,
		@Param("slug") slug: string,
	): Promise<MovieListDto | null> {
		return this.listsService.getList(req.user.did, slug);
	}

	@Put(":slug")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Update a list" })
	@ApiParam({ name: "slug", description: "List slug identifier" })
	@ApiOkResponse({ description: "List updated", type: MovieListDto })
	@ApiNotFoundResponse({ description: "List not found" })
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async updateList(
		@Req() req: AuthenticatedRequest,
		@Param("slug") slug: string,
		@Body() dto: UpdateListDto,
	): Promise<MovieListDto> {
		return this.listsService.updateList(
			req.user.did,
			req.user.session as ATSession,
			slug,
			dto,
		);
	}

	@Delete(":slug")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Delete a list (not allowed for default lists)" })
	@ApiParam({ name: "slug", description: "List slug identifier" })
	@ApiOkResponse({ description: "List deleted" })
	@ApiNotFoundResponse({ description: "List not found" })
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async deleteList(
		@Req() req: AuthenticatedRequest,
		@Param("slug") slug: string,
	): Promise<void> {
		return this.listsService.deleteList(
			req.user.did,
			req.user.session as ATSession,
			slug,
		);
	}

	@Post(":slug/movies")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Add a movie to a list" })
	@ApiParam({ name: "slug", description: "List slug identifier" })
	@ApiOkResponse({ description: "Movie added to list" })
	@ApiNotFoundResponse({ description: "List or movie not found" })
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async addToList(
		@Req() req: AuthenticatedRequest,
		@Param("slug") slug: string,
		@Body() dto: AddToListDto,
	): Promise<{ success: boolean }> {
		await this.listsService.addToList(
			req.user.did,
			req.user.session as ATSession,
			slug,
			dto,
		);
		return { success: true };
	}

	@Delete(":slug/movies/:movieId")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Remove a movie from a list" })
	@ApiParam({ name: "slug", description: "List slug identifier" })
	@ApiParam({ name: "movieId", description: "TMDB movie ID" })
	@ApiOkResponse({ description: "Movie removed from list" })
	@ApiNotFoundResponse({ description: "List not found" })
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async removeFromList(
		@Req() req: AuthenticatedRequest,
		@Param("slug") slug: string,
		@Param("movieId") movieId: string,
	): Promise<{ success: boolean }> {
		await this.listsService.removeFromList(
			req.user.did,
			req.user.session as ATSession,
			slug,
			movieId,
		);
		return { success: true };
	}

	@Get("for-movie/:movieId")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Get all lists with membership status for a movie" })
	@ApiParam({ name: "movieId", description: "TMDB movie ID" })
	@ApiOkResponse({
		description: "Lists with membership status",
		type: [MovieListsForMovieDto],
	})
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async getListsForMovie(
		@Req() req: AuthenticatedRequest,
		@Param("movieId") movieId: string,
	): Promise<MovieListsForMovieDto[]> {
		await this.listsService.ensureDefaultLists(
			req.user.did,
			req.user.session as ATSession,
		);
		return this.listsService.getListsForMovie(req.user.did, movieId);
	}
}
