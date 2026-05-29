import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	MaxLength,
} from "class-validator";

export class CreateReviewDto {
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

	@ApiProperty({ description: "Review title (required)", maxLength: 300 })
	@IsString()
	@IsNotEmpty()
	@MaxLength(300)
	title: string;

	@ApiProperty({
		description: "Review body as markdown source",
		maxLength: 20000,
	})
	@IsString()
	@IsNotEmpty()
	@MaxLength(20000)
	markdown: string;
}

export class UpdateReviewDto {
	@ApiPropertyOptional({ description: "Review title", maxLength: 300 })
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@MaxLength(300)
	title?: string;

	@ApiPropertyOptional({
		description: "Review body as markdown source",
		maxLength: 20000,
	})
	@IsOptional()
	@IsString()
	@MaxLength(20000)
	markdown?: string;
}

export class ReviewResponseDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	rkey: string;

	@ApiProperty()
	title: string;

	@ApiProperty({ description: "Review body as markdown source" })
	markdown: string;

	@ApiPropertyOptional({ description: "Short plaintext excerpt" })
	description?: string;

	@ApiPropertyOptional({ description: "Plaintext rendering for preview" })
	textContent?: string;

	@ApiProperty({ description: "AT-URI of the document's publication (`site`)" })
	publicationUri: string;

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

	@ApiProperty()
	reviewTitle: string;

	@ApiProperty({ description: "Review body as markdown source" })
	markdown: string;

	@ApiPropertyOptional()
	description?: string;

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

	@ApiProperty()
	title: string;

	@ApiProperty({ description: "Review body as markdown source" })
	markdown: string;

	@ApiPropertyOptional()
	description?: string;

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
