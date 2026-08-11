import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	IsBoolean,
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

	@ApiPropertyOptional({
		description:
			"Author-declared Spoiler Flag: the body contains spoilers. The title stays visible everywhere and must remain spoiler-free.",
	})
	@IsOptional()
	@IsBoolean()
	spoiler?: boolean;

	@ApiPropertyOptional({
		description:
			"Whether to mirror this review to the author's blog (when one is configured). Defaults to true.",
	})
	@IsOptional()
	@IsBoolean()
	mirrorToBlog?: boolean;

	@ApiPropertyOptional({
		description:
			"Whether to create a one-time Bluesky post announcing this new review. Defaults to false.",
		default: false,
	})
	@IsOptional()
	@IsBoolean()
	postToBluesky?: boolean;
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

	@ApiPropertyOptional({
		description:
			"Author-declared Spoiler Flag: the body contains spoilers. The title stays visible everywhere and must remain spoiler-free.",
	})
	@IsOptional()
	@IsBoolean()
	spoiler?: boolean;

	@ApiPropertyOptional({
		description:
			"Whether to mirror this review to the author's blog (when one is configured).",
	})
	@IsOptional()
	@IsBoolean()
	mirrorToBlog?: boolean;
}

export class BlueskyCrossPostResultDto {
	@ApiProperty({ enum: ["not_requested", "posted", "failed"] })
	status: "not_requested" | "posted" | "failed";

	@ApiPropertyOptional({
		description: "AT-URI of the Bluesky post when it was created",
	})
	uri?: string;

	@ApiPropertyOptional({
		description: "Public bsky.app URL for the post",
	})
	url?: string;
}

export class ReviewResponseDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	rkey: string;

	@ApiProperty()
	reviewTitle: string;

	@ApiProperty({ description: "Review body as markdown source" })
	markdown: string;

	@ApiProperty({
		description: "Author-declared Spoiler Flag: the body contains spoilers",
	})
	spoiler: boolean;

	@ApiPropertyOptional({
		type: String,
		nullable: true,
		description:
			"AT-URI of the standard.site blog-mirror document, or null when not mirrored",
	})
	blogDocumentUri?: string | null;

	@ApiProperty({
		description: "Whether this review is mirrored to the author's blog",
	})
	mirrorToBlog: boolean;

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

export class CreateReviewResponseDto extends ReviewResponseDto {
	@ApiProperty({ type: BlueskyCrossPostResultDto })
	blueskyCrossPost: BlueskyCrossPostResultDto;
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

	@ApiProperty({ description: "AT record key of the review" })
	rkey: string;

	@ApiProperty()
	reviewTitle: string;

	@ApiProperty({ description: "Review body as markdown source" })
	markdown: string;

	@ApiProperty({
		description: "Author-declared Spoiler Flag: the body contains spoilers",
	})
	spoiler: boolean;

	@ApiPropertyOptional({
		type: String,
		description: "Short plaintext excerpt",
	})
	description?: string;

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
		description:
			"Title of the movie or show that mediaId identifies. Never composite — this is what URL slugs are built from (ADR 0023).",
	})
	mediaTitle?: string;

	@ApiPropertyOptional({
		type: String,
		description:
			"Human-readable label for the media, composite for a season or episode. Display only — never build a URL from it.",
	})
	mediaLabel?: string;

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

	@ApiProperty({ description: "AT record key of the review" })
	rkey: string;

	@ApiProperty()
	reviewTitle: string;

	@ApiProperty({ description: "Review body as markdown source" })
	markdown: string;

	@ApiProperty({
		description: "Author-declared Spoiler Flag: the body contains spoilers",
	})
	spoiler: boolean;

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

	@ApiPropertyOptional({
		description:
			'Human-readable label for the media. Composite for a season or episode, e.g. "Breaking Bad — S1E1: Pilot". Display only — never build a URL from it.',
	})
	mediaLabel?: string;

	@ApiPropertyOptional({
		description:
			"Title of the movie or show that mediaId identifies. Never composite — this is what URL slugs are built from (ADR 0023).",
	})
	mediaTitle?: string;

	@ApiPropertyOptional({ description: "Poster path for the movie or show" })
	posterPath?: string;

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

	@ApiPropertyOptional({
		description:
			"Guarantee this review id is included in the response even if community ordering would push it past the first page (used by deep links).",
	})
	@IsOptional()
	@IsString()
	pinnedReviewId?: string;
}

export class MediaReviewItemDto {
	@ApiProperty()
	id: string;

	@ApiProperty({ description: "AT record key of the review" })
	rkey: string;

	@ApiProperty()
	reviewTitle: string;

	@ApiProperty({ description: "Review body as markdown source" })
	markdown: string;

	@ApiProperty({
		description: "Author-declared Spoiler Flag: the body contains spoilers",
	})
	spoiler: boolean;

	@ApiPropertyOptional()
	description?: string;

	@ApiPropertyOptional({
		description:
			"Relative URL of the canonical public review page, e.g. /reviews/{handle}/{rkey}",
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
		description:
			"Whether the author has this review mirrored to their blog (only meaningful on the author's own reviews)",
	})
	mirrorToBlog?: boolean;

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

export class MyPublicationDto {
	@ApiProperty({ description: "AT-URI of the publication record" })
	uri: string;

	@ApiProperty({ description: "Display name of the publication" })
	name: string;

	@ApiProperty({ description: "Canonical web URL of the publication" })
	url: string;

	@ApiProperty({
		description:
			"Detected publication service; users can override this suggestion",
		enum: ["leaflet", "offprint", "pckt", "unknown"],
	})
	service: "leaflet" | "offprint" | "pckt" | "unknown";
}

export class MyPublicationsResponseDto {
	@ApiProperty({ type: [MyPublicationDto] })
	items: MyPublicationDto[];
}
