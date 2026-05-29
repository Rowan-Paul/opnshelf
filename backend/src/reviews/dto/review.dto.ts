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

export class CanonicalReviewAuthorDto {
	@ApiProperty()
	did: string;

	@ApiProperty()
	handle: string;

	@ApiPropertyOptional({ type: String })
	displayName?: string;

	@ApiPropertyOptional({ type: String })
	avatar?: string;
}

export class CanonicalReviewResponseDto {
	@ApiProperty()
	id: string;

	@ApiProperty({ description: "AT record key of the review document" })
	rkey: string;

	@ApiProperty()
	title: string;

	@ApiProperty({ description: "Review body as markdown source" })
	markdown: string;

	@ApiPropertyOptional({
		type: String,
		description: "Short plaintext excerpt",
	})
	description?: string;

	@ApiPropertyOptional({
		type: String,
		description: "Human-friendly document path (the canonical URL segment)",
	})
	path?: string;

	@ApiProperty({ enum: ["movie", "show", "season", "episode"] })
	mediaType: string;

	@ApiProperty()
	mediaId: string;

	@ApiPropertyOptional()
	seasonNumber?: number;

	@ApiPropertyOptional()
	episodeNumber?: number;

	@ApiPropertyOptional({
		type: String,
		description: "Title of the underlying media item",
	})
	mediaTitle?: string;

	@ApiPropertyOptional({
		type: String,
		description: "Poster path of the underlying media item (the review cover)",
	})
	posterPath?: string;

	@ApiProperty({ type: CanonicalReviewAuthorDto })
	author: CanonicalReviewAuthorDto;

	@ApiProperty({
		description:
			"Absolute canonical URL on the public site (opnshelf.xyz), never the PDS host",
	})
	canonicalUrl: string;

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

	@ApiProperty({ description: "AT record key of the review document" })
	rkey: string;

	@ApiProperty()
	title: string;

	@ApiProperty({ description: "Review body as markdown source" })
	markdown: string;

	@ApiPropertyOptional()
	description?: string;

	@ApiPropertyOptional({
		description:
			"Relative URL of the canonical public review page (#115), e.g. /@handle/path",
	})
	reviewUrl?: string;

	@ApiPropertyOptional({
		description: "Poster path of the underlying media item (the review cover)",
	})
	posterPath?: string;

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

	@ApiPropertyOptional({
		type: Number,
		description:
			"The author's own rating for this media item (joined from the separate Rating entity). Used only as a sort tiebreak.",
		nullable: true,
	})
	authorRating?: number | null;

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
