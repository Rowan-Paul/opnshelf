import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

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
	@IsString()
	mediaType: "movie" | "show";

	@ApiProperty({
		description: "Array of media IDs to fetch ratings for",
		type: [String],
	})
	@IsString({ each: true })
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
