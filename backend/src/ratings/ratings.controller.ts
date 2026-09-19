import {
	Body,
	Controller,
	Delete,
	Get,
	Header,
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
	BatchRatingQueryDto,
	BatchRatingResponseDto,
	GetRatingQueryDto,
	MediaRatingQueryDto,
	MediaRatingResponseDto,
	RatingResponseDto,
	SetRatingDto,
} from "./dto/rating.dto";
import { RatingsService, type ATSession } from "./ratings.service";

@ApiTags("ratings")
@Controller("ratings")
export class RatingsController {
	constructor(private readonly ratingsService: RatingsService) {}

	@Get("user/:userDid")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Get a rating for a user and media item" })
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
		description: "Rating retrieved",
		type: RatingResponseDto,
	})
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async getRating(
		@Param("userDid") userDid: string,
		@Query() query: GetRatingQueryDto,
		@Req() req: AuthenticatedRequest,
	): Promise<RatingResponseDto | null> {
		if (req.user.did !== userDid) {
			throw new Error("Unauthorized");
		}

		const rating = await this.ratingsService.getRating(
			userDid,
			query.mediaType,
			query.mediaId,
			query.seasonNumber,
			query.episodeNumber,
		);

		if (!rating) {
			return null;
		}

		return {
			id: rating.id,
			rkey: rating.rkey,
			rating: rating.rating,
			mediaType: rating.mediaType,
			mediaId: rating.mediaId,
			seasonNumber: rating.seasonNumber || undefined,
			episodeNumber: rating.episodeNumber || undefined,
			createdAt: rating.createdAt.toISOString(),
			updatedAt: rating.updatedAt.toISOString(),
		};
	}

	@Get("media")
	@ApiOperation({ summary: "Get aggregate rating for a media item" })
	@ApiOkResponse({
		description: "Aggregate rating retrieved",
		type: MediaRatingResponseDto,
	})
	async getMediaRating(
		@Query() query: MediaRatingQueryDto,
	): Promise<MediaRatingResponseDto> {
		const result = await this.ratingsService.getMediaRating(query);
		return {
			averageRating: result.averageRating,
			ratingCount: result.ratingCount,
		};
	}

	// A public aggregate, so a shared cache may hold it — but React Query
	// invalidation cannot evict the browser's HTTP cache, and a stale average
	// right after you rate reads as a dead click. `no-cache` keeps the stored
	// copy and makes every use revalidate; Express answers the unchanged ones
	// from its own ETag with a 304.
	@Get("batch")
	@Header("Cache-Control", "no-cache")
	@ApiOperation({ summary: "Get batch aggregate ratings for multiple media" })
	@ApiOkResponse({
		description: "Batch ratings retrieved",
		type: BatchRatingResponseDto,
	})
	async getBatchRatings(
		@Query() query: BatchRatingQueryDto,
	): Promise<BatchRatingResponseDto> {
		return this.ratingsService.getBatchRatings(query);
	}

	@Post()
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Set (create or update) a rating" })
	@ApiOkResponse({
		description: "Rating set",
		type: RatingResponseDto,
	})
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async setRating(
		@Req() req: AuthenticatedRequest,
		@Body() dto: SetRatingDto,
	): Promise<RatingResponseDto> {
		const rating = await this.ratingsService.setRating(
			req.user.did,
			req.user.session as ATSession,
			dto,
		);

		return {
			id: rating.id,
			rkey: rating.rkey,
			rating: rating.rating,
			mediaType: rating.mediaType,
			mediaId: rating.mediaId,
			seasonNumber: rating.seasonNumber || undefined,
			episodeNumber: rating.episodeNumber || undefined,
			createdAt: rating.createdAt.toISOString(),
			updatedAt: rating.updatedAt.toISOString(),
		};
	}

	@Delete(":ratingId")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Clear a rating" })
	@ApiOkResponse({ description: "Rating cleared" })
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async clearRating(
		@Param("ratingId") ratingId: string,
		@Req() req: AuthenticatedRequest,
	): Promise<{ success: boolean }> {
		await this.ratingsService.clearRating(
			req.user.did,
			req.user.session as ATSession,
			ratingId,
		);
		return { success: true };
	}
}
