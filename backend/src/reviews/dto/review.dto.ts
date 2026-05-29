import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	IsInt,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
} from "class-validator";

export class UpsertReviewDto {
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

	@ApiPropertyOptional({ description: "Review text", maxLength: 5000 })
	@IsOptional()
	@IsString()
	@MaxLength(5000)
	content?: string;
}

export class ReviewResponseDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	rkey: string;

	@ApiProperty({ minimum: 1, maximum: 10 })
	rating: number;

	@ApiPropertyOptional()
	content?: string;

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

export class GetReviewQueryDto {
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

export class PaginatedReviewsQueryDto {
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

export class UserReviewDto {
	@ApiProperty()
	id: string;

	@ApiProperty({ minimum: 1, maximum: 10 })
	rating: number;

	@ApiPropertyOptional()
	content?: string;

	@ApiProperty({ enum: ["movie", "show", "season", "episode"] })
	mediaType: string;

	@ApiProperty()
	mediaId: string;

	@ApiPropertyOptional()
	seasonNumber?: number;

	@ApiPropertyOptional()
	episodeNumber?: number;

	@ApiPropertyOptional({ description: "Title of the movie or show" })
	title?: string;

	@ApiPropertyOptional({ description: "Poster path for the movie or show" })
	posterPath?: string;

	@ApiProperty()
	createdAt: string;

	@ApiProperty()
	updatedAt: string;
}

export class PaginatedReviewsResponseDto {
	@ApiProperty({ type: [UserReviewDto] })
	items: UserReviewDto[];

	@ApiProperty({
		type: String,
		nullable: true,
		description: "Cursor for next page (null if no more items)",
	})
	nextCursor: string | null;

	@ApiProperty({ description: "Total count of items" })
	total: number;
}

export class MediaReviewsQueryDto {
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

	@ApiPropertyOptional({
		description: "Number of items to return",
		default: 20,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	limit?: number;

	@ApiPropertyOptional({
		description: "Cursor for pagination",
	})
	@IsOptional()
	@IsString()
	cursor?: string;
}

export class MediaReviewItemDto {
	@ApiProperty()
	id: string;

	@ApiProperty({ minimum: 1, maximum: 10 })
	rating: number;

	@ApiPropertyOptional()
	content?: string;

	@ApiProperty()
	userDid: string;

	@ApiProperty()
	userHandle: string;

	@ApiPropertyOptional()
	userDisplayName?: string;

	@ApiPropertyOptional()
	userAvatar?: string;

	@ApiProperty({ description: "Number of likes on this review" })
	likeCount: number;

	@ApiProperty({
		description: "Whether the requesting user has liked this review",
	})
	hasLiked: boolean;

	@ApiProperty()
	createdAt: string;

	@ApiProperty()
	updatedAt: string;
}

export class MediaReviewsResponseDto {
	@ApiProperty({ type: [MediaReviewItemDto] })
	items: MediaReviewItemDto[];

	@ApiProperty({ description: "Total review count" })
	total: number;

	@ApiProperty({
		type: String,
		nullable: true,
		description: "Cursor for next page (null if no more items)",
	})
	nextCursor: string | null;
}

export class ReviewLikeItemDto {
	@ApiProperty()
	userDid: string;

	@ApiProperty()
	userHandle: string;

	@ApiPropertyOptional()
	userDisplayName?: string;

	@ApiPropertyOptional()
	userAvatar?: string;

	@ApiProperty()
	createdAt: string;
}

export class ReviewLikesResponseDto {
	@ApiProperty({ type: [ReviewLikeItemDto] })
	items: ReviewLikeItemDto[];

	@ApiProperty({ description: "Total like count" })
	total: number;

	@ApiProperty({
		description: "Whether the requesting user has liked this review",
	})
	hasLiked: boolean;
}
