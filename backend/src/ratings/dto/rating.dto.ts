import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	ArrayMaxSize,
	ArrayNotEmpty,
	ArrayUnique,
	IsArray,
	IsIn,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
} from "class-validator";

export const MAX_BATCH_RATING_IDS = 100;

// TMDB IDs are short decimal strings; 50 leaves ample headroom while bounding input.
const MAX_MEDIA_ID_LENGTH = 50;

export class SetRatingDto {
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

	@ApiProperty({
		description: "Rating from 1 to 10 (maps to 0.5-5.0 stars)",
		minimum: 1,
		maximum: 10,
	})
	@IsInt()
	@Min(1)
	@Max(10)
	rating: number;
}

export class RatingResponseDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	rkey: string;

	@ApiProperty({ minimum: 1, maximum: 10 })
	rating: number;

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

export class GetRatingQueryDto {
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

export class MediaRatingQueryDto {
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

export class MediaRatingResponseDto {
	@ApiPropertyOptional({ description: "Average rating (1-10 scale)" })
	averageRating?: number;

	@ApiProperty({ description: "Total number of ratings" })
	ratingCount: number;
}

export class BatchRatingRequestDto {
	@ApiProperty({
		description: "Media type",
		enum: ["movie", "show"],
	})
	@IsIn(["movie", "show"])
	mediaType: "movie" | "show";

	@ApiProperty({
		description:
			"Array of media IDs to fetch ratings for (maximum 50 characters per ID)",
		type: [String],
		maxItems: MAX_BATCH_RATING_IDS,
	})
	@IsArray()
	@ArrayNotEmpty()
	@ArrayMaxSize(MAX_BATCH_RATING_IDS)
	@ArrayUnique()
	@IsString({ each: true })
	@IsNotEmpty({ each: true })
	@MaxLength(MAX_MEDIA_ID_LENGTH, { each: true })
	mediaIds: string[];
}

export class BatchRatingItemDto {
	@ApiProperty()
	mediaId: string;

	@ApiPropertyOptional({ description: "Average rating (1-10 scale)" })
	averageRating?: number;

	@ApiProperty({ description: "Total number of ratings" })
	ratingCount: number;
}

export class BatchRatingResponseDto {
	@ApiProperty({ type: [BatchRatingItemDto] })
	items: BatchRatingItemDto[];
}
