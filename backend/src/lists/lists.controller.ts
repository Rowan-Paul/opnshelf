import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Post,
	Put,
	Query,
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
	GetListQueryDto,
	MovieListDto,
	MovieListsForItemDto,
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

	@Get("user/:userDid")
	@ApiOperation({ summary: "Get public list summaries for a user" })
	@ApiParam({ name: "userDid", description: "User DID" })
	@ApiOkResponse({
		description: "Public list summaries for the user",
		type: [MovieListSummaryDto],
	})
	async getPublicUserLists(
		@Param("userDid") userDid: string,
	): Promise<MovieListSummaryDto[]> {
		return this.listsService.getPublicUserLists(userDid);
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
		@Query() query: GetListQueryDto,
	): Promise<MovieListWithMoviesDto | null> {
		return this.listsService.getList(
			req.user.did,
			slug,
			query.page,
			query.pageSize,
		);
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

	@Post(":slug/items")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Add an item to a list" })
	@ApiParam({ name: "slug", description: "List slug identifier" })
	@ApiOkResponse({ description: "Item added to list" })
	@ApiNotFoundResponse({ description: "List or media item not found" })
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async addItemToList(
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

	@Post(":slug/movies")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Add a movie to a list (legacy route)" })
	async addToList(
		@Req() req: AuthenticatedRequest,
		@Param("slug") slug: string,
		@Body() dto: { movieId: string; notes?: string },
	): Promise<{ success: boolean }> {
		await this.listsService.addToList(
			req.user.did,
			req.user.session as ATSession,
			slug,
			{ mediaType: "movie", mediaId: dto.movieId, notes: dto.notes },
		);
		return { success: true };
	}

	@Delete(":slug/items/:mediaType/:mediaId")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Remove an item from a list" })
	@ApiParam({ name: "slug", description: "List slug identifier" })
	@ApiParam({ name: "mediaType", description: "Media type (movie or show)" })
	@ApiParam({ name: "mediaId", description: "TMDB media ID" })
	@ApiOkResponse({ description: "Item removed from list" })
	@ApiNotFoundResponse({ description: "List not found" })
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async removeItemFromList(
		@Req() req: AuthenticatedRequest,
		@Param("slug") slug: string,
		@Param("mediaType") mediaType: "movie" | "show",
		@Param("mediaId") mediaId: string,
	): Promise<{ success: boolean }> {
		await this.listsService.removeFromList(
			req.user.did,
			req.user.session as ATSession,
			slug,
			mediaType,
			mediaId,
		);
		return { success: true };
	}

	@Delete(":slug/movies/:movieId")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Remove a movie from a list (legacy route)" })
	async removeFromList(
		@Req() req: AuthenticatedRequest,
		@Param("slug") slug: string,
		@Param("movieId") movieId: string,
	): Promise<{ success: boolean }> {
		await this.listsService.removeFromList(
			req.user.did,
			req.user.session as ATSession,
			slug,
			"movie",
			movieId,
		);
		return { success: true };
	}

	@Get("for-item/:mediaType/:mediaId")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Get all lists with membership status for an item" })
	@ApiParam({ name: "mediaType", description: "Media type (movie or show)" })
	@ApiParam({ name: "mediaId", description: "TMDB media ID" })
	@ApiOkResponse({
		description: "Lists with membership status",
		type: [MovieListsForItemDto],
	})
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async getListsForItem(
		@Req() req: AuthenticatedRequest,
		@Param("mediaType") mediaType: "movie" | "show",
		@Param("mediaId") mediaId: string,
	): Promise<MovieListsForItemDto[]> {
		await this.listsService.ensureDefaultLists(
			req.user.did,
			req.user.session as ATSession,
		);
		return this.listsService.getListsForItem(req.user.did, mediaType, mediaId);
	}

	@Get("for-movie/:movieId")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: "Get all lists with membership status for a movie (legacy route)",
	})
	async getListsForMovie(
		@Req() req: AuthenticatedRequest,
		@Param("movieId") movieId: string,
	): Promise<MovieListsForItemDto[]> {
		await this.listsService.ensureDefaultLists(
			req.user.did,
			req.user.session as ATSession,
		);
		return this.listsService.getListsForItem(req.user.did, "movie", movieId);
	}
}
