import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Post,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiOkResponse,
	ApiOperation,
	ApiParam,
	ApiQuery,
	ApiTags,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import {
	AddToLibraryDto,
	type LibraryFormat,
	LibraryItemDto,
	LibraryOwnershipDto,
} from "./dto/library.dto";
import { LibraryService, type ATSession } from "./library.service";

@ApiTags("library")
@Controller("library")
export class LibraryController {
	constructor(private readonly libraryService: LibraryService) {}

	@Get()
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Get the authenticated user's library" })
	@ApiOkResponse({ description: "Owned items", type: [LibraryItemDto] })
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async getMyLibrary(
		@Req() req: AuthenticatedRequest,
	): Promise<LibraryItemDto[]> {
		return this.libraryService.getUserLibrary(req.user.did);
	}

	@Get("user/:userDid")
	@ApiOperation({ summary: "Get a user's public library" })
	@ApiParam({ name: "userDid", description: "User DID" })
	@ApiOkResponse({ description: "Owned items", type: [LibraryItemDto] })
	async getUserLibrary(
		@Param("userDid") userDid: string,
	): Promise<LibraryItemDto[]> {
		return this.libraryService.getUserLibrary(userDid);
	}

	@Get("for-item/:mediaType/:mediaId")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: "Get the formats the user owns an item in (ownership indicator)",
	})
	@ApiParam({
		name: "mediaType",
		description: "movie, show, season, or episode",
	})
	@ApiParam({ name: "mediaId", description: "TMDB movie ID or show ID" })
	@ApiQuery({ name: "seasonNumber", required: false, type: Number })
	@ApiQuery({ name: "episodeNumber", required: false, type: Number })
	@ApiOkResponse({ description: "Owned formats", type: [LibraryOwnershipDto] })
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async getLibraryForItem(
		@Req() req: AuthenticatedRequest,
		@Param("mediaType") mediaType: "movie" | "show" | "season" | "episode",
		@Param("mediaId") mediaId: string,
		@Query("seasonNumber") seasonNumber?: string,
		@Query("episodeNumber") episodeNumber?: string,
	): Promise<LibraryOwnershipDto[]> {
		return this.libraryService.getLibraryForItem(
			req.user.did,
			mediaType,
			mediaId,
			seasonNumber ? Number(seasonNumber) : undefined,
			episodeNumber ? Number(episodeNumber) : undefined,
		);
	}

	@Post("items")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Add an owned item to the library" })
	@ApiOkResponse({ description: "Item added", type: LibraryItemDto })
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async addToLibrary(
		@Req() req: AuthenticatedRequest,
		@Body() dto: AddToLibraryDto,
	): Promise<LibraryItemDto> {
		return this.libraryService.addToLibrary(
			req.user.did,
			req.user.session as ATSession,
			dto,
		);
	}

	@Delete("items/:mediaType/:mediaId/:format")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: "Remove an owned item (by format) from the library",
	})
	@ApiParam({
		name: "mediaType",
		description: "movie, show, season, or episode",
	})
	@ApiParam({ name: "mediaId", description: "TMDB movie ID or show ID" })
	@ApiParam({
		name: "format",
		description: "digital, bluray, bluray4k, or dvd",
	})
	@ApiQuery({ name: "seasonNumber", required: false, type: Number })
	@ApiQuery({ name: "episodeNumber", required: false, type: Number })
	@ApiOkResponse({ description: "Item removed" })
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async removeFromLibrary(
		@Req() req: AuthenticatedRequest,
		@Param("mediaType") mediaType: "movie" | "show" | "season" | "episode",
		@Param("mediaId") mediaId: string,
		@Param("format") format: LibraryFormat,
		@Query("seasonNumber") seasonNumber?: string,
		@Query("episodeNumber") episodeNumber?: string,
	): Promise<{ success: boolean }> {
		await this.libraryService.removeFromLibrary(
			req.user.did,
			req.user.session as ATSession,
			mediaType,
			mediaId,
			format,
			seasonNumber ? Number(seasonNumber) : undefined,
			episodeNumber ? Number(episodeNumber) : undefined,
		);
		return { success: true };
	}
}
