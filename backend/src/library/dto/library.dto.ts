import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, MaxLength } from "class-validator";

export const LIBRARY_FORMATS = [
	"digital",
	"bluray",
	"bluray4k",
	"dvd",
] as const;
export type LibraryFormat = (typeof LIBRARY_FORMATS)[number];

export class AddToLibraryDto {
	@ApiProperty({
		description: "Media type",
		enum: ["movie", "show", "season", "episode"],
	})
	@IsString()
	mediaType: "movie" | "show" | "season" | "episode";

	@ApiProperty({ description: "TMDB movie ID or show ID" })
	@IsString()
	mediaId: string;

	@ApiProperty({
		description: "Format the item is owned in",
		enum: LIBRARY_FORMATS,
	})
	@IsIn(LIBRARY_FORMATS)
	format: LibraryFormat;

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

	@ApiPropertyOptional({ description: "Optional named box set" })
	@IsOptional()
	@IsString()
	@MaxLength(200)
	boxSet?: string;

	@ApiPropertyOptional({ description: "Optional notes about the owned item" })
	@IsOptional()
	@IsString()
	@MaxLength(1000)
	notes?: string;
}

export class LibraryItemDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	rkey: string;

	@ApiProperty({ enum: ["movie", "show", "season", "episode"] })
	mediaType: "movie" | "show" | "season" | "episode";

	@ApiProperty({ description: "TMDB movie ID or show ID" })
	mediaId: string;

	@ApiProperty({ enum: LIBRARY_FORMATS })
	format: LibraryFormat;

	@ApiPropertyOptional()
	seasonNumber?: number;

	@ApiPropertyOptional()
	episodeNumber?: number;

	@ApiPropertyOptional()
	episodeName?: string;

	@ApiPropertyOptional()
	boxSet?: string;

	@ApiPropertyOptional()
	notes?: string;

	@ApiProperty()
	createdAt: string;

	@ApiProperty()
	media: {
		mediaType: "movie" | "show" | "season" | "episode";
		mediaId: string;
		movieId?: string;
		showId?: string;
		seasonNumber?: number;
		episodeNumber?: number;
		episodeName?: string;
		title: string;
		posterPath?: string;
		backdropPath?: string;
		releaseYear?: number;
		releaseDate?: string;
		overview?: string;
		colors?: {
			primary?: string;
			secondary?: string;
			accent?: string;
			muted?: string;
		};
	};
}

/** A single owned copy of an item, used for the "do I own this" indicator. */
export class LibraryOwnershipDto {
	@ApiProperty()
	rkey: string;

	@ApiProperty({ enum: LIBRARY_FORMATS })
	format: LibraryFormat;

	@ApiPropertyOptional()
	boxSet?: string;
}
