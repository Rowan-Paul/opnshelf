import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	IsInt,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
	MinLength,
} from "class-validator";

export class CreateListDto {
	@ApiProperty({
		description: "Name of the list",
		minLength: 1,
		maxLength: 100,
	})
	@IsString()
	@MinLength(1)
	@MaxLength(100)
	name: string;

	@ApiPropertyOptional({
		description: "Description of the list",
		maxLength: 500,
	})
	@IsOptional()
	@IsString()
	@MaxLength(500)
	description?: string;
}

export class UpdateListDto {
	@ApiPropertyOptional({
		description: "Name of the list",
		minLength: 1,
		maxLength: 100,
	})
	@IsOptional()
	@IsString()
	@MinLength(1)
	@MaxLength(100)
	name?: string;

	@ApiPropertyOptional({
		description: "Description of the list",
		maxLength: 500,
	})
	@IsOptional()
	@IsString()
	@MaxLength(500)
	description?: string;
}

export class AddToListDto {
	@ApiProperty({ description: "Media type", enum: ["movie", "show"] })
	@IsString()
	mediaType: "movie" | "show";

	@ApiProperty({ description: "TMDB media ID" })
	@IsString()
	mediaId: string;

	@ApiPropertyOptional({ description: "Optional notes about the media" })
	@IsOptional()
	@IsString()
	@MaxLength(1000)
	notes?: string;
}

export class GetListQueryDto {
	@ApiPropertyOptional({
		description: "Page number to return",
		default: 1,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number;

	@ApiPropertyOptional({
		description: "Number of items to return per page",
		default: 20,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(50)
	pageSize?: number;
}

export class RemoveFromListDto {
	@ApiProperty({ description: "Media type", enum: ["movie", "show"] })
	@IsString()
	mediaType: "movie" | "show";

	@ApiProperty({ description: "TMDB media ID" })
	@IsString()
	mediaId: string;
}

export class MediaInListDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	rkey: string;

	@ApiProperty()
	mediaType: "movie" | "show";

	@ApiProperty()
	mediaId: string;

	@ApiPropertyOptional({
		description: "Season number for season/episode show items",
	})
	seasonNumber?: number;

	@ApiPropertyOptional({ description: "Episode number for episode show items" })
	episodeNumber?: number;

	@ApiPropertyOptional()
	notes?: string;

	@ApiProperty()
	position: number;

	@ApiProperty()
	createdAt: string;

	@ApiProperty()
	media: {
		mediaType: "movie" | "show";
		mediaId: string;
		movieId?: string;
		showId?: string;
		seasonNumber?: number;
		episodeNumber?: number;
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

export class ListDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	rkey: string;

	@ApiProperty()
	uri: string;

	@ApiProperty()
	userDid: string;

	@ApiProperty()
	name: string;

	@ApiPropertyOptional()
	description?: string;

	@ApiProperty()
	slug: string;

	@ApiProperty()
	isDefault: boolean;

	@ApiProperty()
	createdAt: string;

	@ApiProperty()
	updatedAt: string;

	@ApiPropertyOptional({ type: MediaInListDto, isArray: true })
	items?: MediaInListDto[];
}

export class ListSummaryDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	rkey: string;

	@ApiProperty()
	name: string;

	@ApiPropertyOptional()
	description?: string;

	@ApiProperty()
	slug: string;

	@ApiProperty()
	isDefault: boolean;

	@ApiProperty()
	itemCount: number;

	@ApiProperty()
	createdAt: string;

	@ApiProperty()
	updatedAt: string;
}

export class ListWithItemsDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	rkey: string;

	@ApiProperty()
	uri: string;

	@ApiProperty()
	userDid: string;

	@ApiProperty()
	name: string;

	@ApiPropertyOptional()
	description?: string;

	@ApiProperty()
	slug: string;

	@ApiProperty()
	isDefault: boolean;

	@ApiProperty()
	createdAt: string;

	@ApiProperty()
	updatedAt: string;

	@ApiProperty({ type: [MediaInListDto] })
	items: MediaInListDto[];

	@ApiProperty({ description: "Total count of items" })
	total: number;

	@ApiProperty({
		description: "Current page number after server-side clamping",
	})
	page: number;

	@ApiProperty({ description: "Number of items returned per page" })
	pageSize: number;

	@ApiProperty({ description: "Total number of available pages" })
	totalPages: number;

	@ApiProperty({ description: "Whether a previous page exists" })
	hasPreviousPage: boolean;

	@ApiProperty({ description: "Whether a next page exists" })
	hasNextPage: boolean;
}

export class ListsForItemDto {
	@ApiProperty()
	listId: string;

	@ApiProperty()
	listName: string;

	@ApiProperty()
	listSlug: string;

	@ApiProperty()
	isDefault: boolean;

	@ApiProperty()
	isInList: boolean;
}
