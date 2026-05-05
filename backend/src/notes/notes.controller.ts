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
	ApiQuery,
	ApiTags,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import {
	GetNoteQueryDto,
	NoteResponseDto,
	UpsertNoteDto,
} from "./dto/note.dto";
import { NotesService, type ATSession } from "./notes.service";

@ApiTags("notes")
@Controller("notes")
export class NotesController {
	constructor(private readonly notesService: NotesService) {}

	@Get("user/:userDid")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Get a note for a user and media item" })
	@ApiQuery({
		name: "mediaType",
		required: true,
		description: "Media type (movie, show, season, episode)",
	})
	@ApiQuery({
		name: "mediaId",
		required: true,
		description: "TMDB movie ID or show ID",
	})
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
		description: "Note retrieved",
		type: NoteResponseDto,
	})
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async getNote(
		@Param("userDid") userDid: string,
		@Query() query: GetNoteQueryDto,
		@Req() req: AuthenticatedRequest,
	): Promise<NoteResponseDto | null> {
		if (req.user.did !== userDid) {
			throw new Error("Unauthorized");
		}

		const note = await this.notesService.getNote(
			userDid,
			query.mediaType,
			query.mediaId,
			query.seasonNumber,
			query.episodeNumber,
		);

		if (!note) {
			return null;
		}

		return {
			id: note.id,
			rkey: note.rkey,
			content: note.content,
			mediaType: note.mediaType,
			mediaId: note.mediaId,
			seasonNumber: note.seasonNumber || undefined,
			episodeNumber: note.episodeNumber || undefined,
			createdAt: note.createdAt.toISOString(),
			updatedAt: note.updatedAt.toISOString(),
		};
	}

	@Post()
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Create or update a note" })
	@ApiOkResponse({
		description: "Note upserted",
		type: NoteResponseDto,
	})
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async upsertNote(
		@Req() req: AuthenticatedRequest,
		@Body() dto: UpsertNoteDto,
	): Promise<NoteResponseDto> {
		const note = await this.notesService.upsertNote(
			req.user.did,
			req.user.session as ATSession,
			dto,
		);

		return {
			id: note.id,
			rkey: note.rkey,
			content: note.content,
			mediaType: note.mediaType,
			mediaId: note.mediaId,
			seasonNumber: note.seasonNumber || undefined,
			episodeNumber: note.episodeNumber || undefined,
			createdAt: note.createdAt.toISOString(),
			updatedAt: note.updatedAt.toISOString(),
		};
	}

	@Delete(":noteId")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Delete a note" })
	@ApiOkResponse({ description: "Note deleted" })
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async deleteNote(
		@Param("noteId") noteId: string,
		@Req() req: AuthenticatedRequest,
	): Promise<{ success: boolean }> {
		await this.notesService.deleteNote(
			req.user.did,
			req.user.session as ATSession,
			noteId,
		);
		return { success: true };
	}
}
