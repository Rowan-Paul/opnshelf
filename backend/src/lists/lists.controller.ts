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
	ApiQuery,
	ApiTags,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Request } from "express";
import { AuthGuard } from "../auth/auth.guard";
import { OptionalAuthGuard } from "../auth/optional-auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import { ListsService, type ATSession } from "./lists.service";
import {
	AddToListDto,
	CreateListDto,
	GetListQueryDto,
	ListDto,
	ListsForItemDto,
	ListSummaryDto,
	ListWithItemsDto,
	ReorderListItemsDto,
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
		type: [ListSummaryDto],
	})
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async getUserLists(
		@Req() req: AuthenticatedRequest,
	): Promise<ListSummaryDto[]> {
		return this.listsService.getUserLists(req.user.did);
	}

	@Post()
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Create a new list" })
	@ApiCreatedResponse({ description: "List created", type: ListDto })
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async createList(
		@Req() req: AuthenticatedRequest,
		@Body() dto: CreateListDto,
	): Promise<ListDto> {
		return this.listsService.createList(
			req.user.did,
			req.user.session as ATSession,
			dto,
		);
	}

	@Get("user/:userDid")
	@ApiOperation({ summary: "Get public list summaries for a user" })
	@ApiParam({ name: "userDid", description: "User DID" })
	@ApiOkResponse({
		description: "Public list summaries for the user",
		type: [ListSummaryDto],
	})
	async getPublicUserLists(
		@Param("userDid") userDid: string,
	): Promise<ListSummaryDto[]> {
		return this.listsService.getPublicUserLists(userDid);
	}

	@Get("user/:userDid/:slug")
	@UseGuards(OptionalAuthGuard)
	@ApiOperation({ summary: "Get a public list with its items for a user" })
	@ApiParam({ name: "userDid", description: "User DID" })
	@ApiParam({ name: "slug", description: "List slug identifier" })
	@ApiOkResponse({
		description: "Public list details with items",
		type: ListWithItemsDto,
	})
	@ApiNotFoundResponse({ description: "List not found" })
	async getPublicUserList(
		@Param("userDid") userDid: string,
		@Param("slug") slug: string,
		@Query() query: GetListQueryDto,
		@Req() req: Request,
	): Promise<ListWithItemsDto | null> {
		const viewerDid = (req as AuthenticatedRequest).user?.did ?? null;
		return this.listsService.getPublicList(
			userDid,
			slug,
			viewerDid,
			query.page,
			query.pageSize,
			query.sort,
		);
	}

	@Get(":slug")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Get a specific list with its items" })
	@ApiParam({ name: "slug", description: "List slug identifier" })
	@ApiOkResponse({
		description: "List details with items",
		type: ListWithItemsDto,
	})
	@ApiNotFoundResponse({ description: "List not found" })
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async getList(
		@Req() req: AuthenticatedRequest,
		@Param("slug") slug: string,
		@Query() query: GetListQueryDto,
	): Promise<ListWithItemsDto | null> {
		return this.listsService.getList(
			req.user.did,
			slug,
			req.user.did,
			query.page,
			query.pageSize,
			query.sort,
		);
	}

	@Put(":slug")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Update a list" })
	@ApiParam({ name: "slug", description: "List slug identifier" })
	@ApiOkResponse({ description: "List updated", type: ListDto })
	@ApiNotFoundResponse({ description: "List not found" })
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async updateList(
		@Req() req: AuthenticatedRequest,
		@Param("slug") slug: string,
		@Body() dto: UpdateListDto,
	): Promise<ListDto> {
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

	@Put(":slug/items/order")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Reorder the items in a list (owner only)" })
	@ApiParam({ name: "slug", description: "List slug identifier" })
	@ApiOkResponse({ description: "Items reordered" })
	@ApiNotFoundResponse({ description: "List not found" })
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async reorderListItems(
		@Req() req: AuthenticatedRequest,
		@Param("slug") slug: string,
		@Body() dto: ReorderListItemsDto,
	): Promise<{ success: boolean }> {
		await this.listsService.reorderListItems(req.user.did, slug, dto.ids);
		return { success: true };
	}

	@Delete(":slug/items/:mediaType/:mediaId")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Remove an item from a list" })
	@ApiParam({ name: "slug", description: "List slug identifier" })
	@ApiParam({
		name: "mediaType",
		description: "Media type (movie, show, season, or episode)",
	})
	@ApiParam({ name: "mediaId", description: "TMDB movie ID or show ID" })
	@ApiQuery({
		name: "seasonNumber",
		required: false,
		description: "Season number for season/episode items",
		type: Number,
	})
	@ApiQuery({
		name: "episodeNumber",
		required: false,
		description: "Episode number for episode items",
		type: Number,
	})
	@ApiOkResponse({ description: "Item removed from list" })
	@ApiNotFoundResponse({ description: "List not found" })
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async removeItemFromList(
		@Req() req: AuthenticatedRequest,
		@Param("slug") slug: string,
		@Param("mediaType") mediaType: "movie" | "show" | "season" | "episode",
		@Param("mediaId") mediaId: string,
		@Query("seasonNumber") seasonNumber?: string,
		@Query("episodeNumber") episodeNumber?: string,
	): Promise<{ success: boolean }> {
		await this.listsService.removeFromList(
			req.user.did,
			req.user.session as ATSession,
			slug,
			mediaType,
			mediaId,
			seasonNumber ? Number(seasonNumber) : undefined,
			episodeNumber ? Number(episodeNumber) : undefined,
		);
		return { success: true };
	}

	@Get("for-item/:mediaType/:mediaId")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Get all lists with membership status for an item" })
	@ApiParam({
		name: "mediaType",
		description: "Media type (movie, show, season, or episode)",
	})
	@ApiParam({ name: "mediaId", description: "TMDB movie ID or show ID" })
	@ApiQuery({
		name: "seasonNumber",
		required: false,
		description: "Season number for season/episode items",
		type: Number,
	})
	@ApiQuery({
		name: "episodeNumber",
		required: false,
		description: "Episode number for episode items",
		type: Number,
	})
	@ApiOkResponse({
		description: "Lists with membership status",
		type: [ListsForItemDto],
	})
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async getListsForItem(
		@Req() req: AuthenticatedRequest,
		@Param("mediaType") mediaType: "movie" | "show" | "season" | "episode",
		@Param("mediaId") mediaId: string,
		@Query("seasonNumber") seasonNumber?: string,
		@Query("episodeNumber") episodeNumber?: string,
	): Promise<ListsForItemDto[]> {
		return this.listsService.getListsForItem(
			req.user.did,
			mediaType,
			mediaId,
			seasonNumber ? Number(seasonNumber) : undefined,
			episodeNumber ? Number(episodeNumber) : undefined,
		);
	}
}
