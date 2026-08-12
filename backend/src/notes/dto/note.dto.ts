import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, MaxLength } from "class-validator";

export class UpsertNoteDto {
	@ApiProperty({
		description: "Media type",
		enum: ["movie", "show", "season", "episode"],
	})
	@IsString()
	mediaType: "movie" | "show" | "season" | "episode";

	@ApiProperty({ description: "TMDB movie ID or show ID" })
	@IsString()
	mediaId: string;

	@ApiPropertyOptional({
		description: "Season number for season/episode items",
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	seasonNumber?: number;

	@ApiPropertyOptional({ description: "Episode number for episode items" })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	episodeNumber?: number;

	@ApiProperty({ description: "Note content", maxLength: 5000 })
	@IsString()
	@MaxLength(5000)
	content: string;
}

export class NoteResponseDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	rkey: string;

	@ApiProperty()
	content: string;

	@ApiProperty({ enum: ["movie", "show", "season", "episode"] })
	mediaType: string;

	@ApiProperty()
	mediaId: string;

	@ApiPropertyOptional()
	seasonNumber?: number;

	@ApiPropertyOptional()
	episodeNumber?: number;

	@ApiProperty()
	createdAt: string;

	@ApiProperty()
	updatedAt: string;
}

export class GetNoteQueryDto {
	@ApiProperty({
		description: "Media type",
		enum: ["movie", "show", "season", "episode"],
	})
	@IsString()
	mediaType: "movie" | "show" | "season" | "episode";

	@ApiProperty({ description: "TMDB movie ID or show ID" })
	@IsString()
	mediaId: string;

	@ApiPropertyOptional({
		description: "Season number for season/episode items",
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	seasonNumber?: number;

	@ApiPropertyOptional({ description: "Episode number for episode items" })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	episodeNumber?: number;
}

export class PaginatedNotesQueryDto {
	@ApiPropertyOptional({
		description: "Number of items to return",
		default: 20,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	limit?: number;

	@ApiPropertyOptional({
		description: "Cursor for pagination (last item ID from previous page)",
	})
	@IsOptional()
	@IsString()
	cursor?: string;
}

export class UserNoteDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	content: string;

	@ApiProperty({ enum: ["movie", "show", "season", "episode"] })
	mediaType: string;

	@ApiProperty()
	mediaId: string;

	@ApiPropertyOptional()
	seasonNumber?: number;

	@ApiPropertyOptional()
	episodeNumber?: number;

	@ApiPropertyOptional({
		description:
			"Human-readable label for the media. Display only — never build a URL from it.",
	})
	mediaLabel?: string;

	@ApiPropertyOptional({
		description:
			"Title of the movie or show that mediaId identifies. Never composite — this is what URL slugs are built from (ADR 0023).",
	})
	mediaTitle?: string;

	@ApiPropertyOptional({ description: "Poster path for the movie or show" })
	posterPath?: string;

	@ApiProperty()
	createdAt: string;

	@ApiProperty()
	updatedAt: string;
}

export class PaginatedNotesResponseDto {
	@ApiProperty({ type: [UserNoteDto] })
	items: UserNoteDto[];

	@ApiProperty({
		type: String,
		nullable: true,
		description: "Cursor for next page (null if no more items)",
	})
	nextCursor: string | null;

	@ApiProperty({ description: "Total count of items" })
	total: number;
}
