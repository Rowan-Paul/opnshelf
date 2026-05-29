import {
	Body,
	Controller,
	Delete,
	Get,
	NotFoundException,
	Param,
	Patch,
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
import { OptionalAuthGuard } from "../auth/optional-auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import {
	CreateReviewDto,
	MediaReviewsQueryDto,
	MediaReviewsResponseDto,
	PaginatedReviewsQueryDto,
	PaginatedReviewsResponseDto,
	ReviewLikesResponseDto,
	ReviewResponseDto,
	UpdateReviewDto,
} from "./dto/review.dto";
import { ReviewsService, type ATSession } from "./reviews.service";

@ApiTags("reviews")
@Controller("reviews")
export class ReviewsController {
	constructor(private readonly reviewsService: ReviewsService) {}

	@Get("user/:userDid/reviews")
	@ApiOperation({ summary: "Get paginated reviews for a user" })
	@ApiQuery({
		name: "limit",
		required: false,
		description: "Number of items to return",
	})
	@ApiQuery({
		name: "cursor",
		required: false,
		description: "Cursor for pagination",
	})
	@ApiOkResponse({
		description: "Reviews retrieved",
		type: PaginatedReviewsResponseDto,
	})
	async getUserReviews(
		@Param("userDid") userDid: string,
		@Query() query: PaginatedReviewsQueryDto,
	): Promise<PaginatedReviewsResponseDto> {
		const limit = query.limit ?? 20;
		const result = await this.reviewsService.getUserReviews(
			userDid,
			limit,
			query.cursor,
		);

		return {
			items: result.items.map((review) => ({
				id: review.id,
				reviewTitle: review.title,
				markdown: review.markdown,
				description: review.description ?? undefined,
				mediaType: review.mediaType,
				mediaId: review.mediaId,
				seasonNumber: review.seasonNumber || undefined,
				episodeNumber: review.episodeNumber || undefined,
				title: review.mediaTitle,
				posterPath: review.posterPath ?? undefined,
				createdAt: review.createdAt.toISOString(),
				updatedAt: review.updatedAt.toISOString(),
			})),
			nextCursor: result.nextCursor,
			total: result.total,
		};
	}

	@Get("media")
	@UseGuards(OptionalAuthGuard)
	@ApiOperation({ summary: "Get public reviews for a media item" })
	@ApiOkResponse({
		description: "Reviews retrieved",
		type: MediaReviewsResponseDto,
	})
	async getMediaReviews(
		@Query() query: MediaReviewsQueryDto,
		@Req() req: AuthenticatedRequest,
	): Promise<MediaReviewsResponseDto> {
		const result = await this.reviewsService.getMediaReviews(
			query,
			req.user?.did,
		);

		return {
			items: result.items.map((review) => ({
				id: review.id,
				title: review.title,
				markdown: review.markdown,
				description: review.description ?? undefined,
				userDid: review.user.did,
				userHandle: review.user.handle,
				userDisplayName: review.user.displayName ?? undefined,
				userAvatar: review.user.avatar ?? undefined,
				likeCount: review.likeCount,
				hasLiked: review.hasLiked,
				createdAt: review.createdAt.toISOString(),
				updatedAt: review.updatedAt.toISOString(),
			})),
			total: result.total,
			nextCursor: result.nextCursor,
		};
	}

	@Get(":reviewId")
	@ApiOperation({ summary: "Get a single review by id" })
	@ApiOkResponse({ description: "Review retrieved", type: ReviewResponseDto })
	async getReview(
		@Param("reviewId") reviewId: string,
	): Promise<ReviewResponseDto> {
		const review = await this.reviewsService.getReview(reviewId);
		if (!review) {
			throw new NotFoundException("Review not found");
		}
		return this.toReviewResponse(review);
	}

	@Post()
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Create a review" })
	@ApiOkResponse({
		description: "Review created",
		type: ReviewResponseDto,
	})
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async createReview(
		@Req() req: AuthenticatedRequest,
		@Body() dto: CreateReviewDto,
	): Promise<ReviewResponseDto> {
		const review = await this.reviewsService.createReview(
			req.user.did,
			req.user.session as ATSession,
			dto,
		);
		return this.toReviewResponse(review);
	}

	@Patch(":reviewId")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Update a review" })
	@ApiOkResponse({
		description: "Review updated",
		type: ReviewResponseDto,
	})
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async updateReview(
		@Param("reviewId") reviewId: string,
		@Req() req: AuthenticatedRequest,
		@Body() dto: UpdateReviewDto,
	): Promise<ReviewResponseDto> {
		const review = await this.reviewsService.updateReview(
			req.user.did,
			req.user.session as ATSession,
			reviewId,
			dto,
		);
		return this.toReviewResponse(review);
	}

	@Delete(":reviewId")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Delete a review" })
	@ApiOkResponse({ description: "Review deleted" })
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async deleteReview(
		@Param("reviewId") reviewId: string,
		@Req() req: AuthenticatedRequest,
	): Promise<{ success: boolean }> {
		await this.reviewsService.deleteReview(
			req.user.did,
			req.user.session as ATSession,
			reviewId,
		);
		return { success: true };
	}

	@Post(":reviewId/like")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Like a review" })
	@ApiOkResponse({ description: "Review liked" })
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async likeReview(
		@Param("reviewId") reviewId: string,
		@Req() req: AuthenticatedRequest,
	): Promise<{ success: boolean }> {
		await this.reviewsService.likeReview(
			req.user.did,
			req.user.session as ATSession,
			reviewId,
		);
		return { success: true };
	}

	@Delete(":reviewId/like")
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Unlike a review" })
	@ApiOkResponse({ description: "Review unliked" })
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async unlikeReview(
		@Param("reviewId") reviewId: string,
		@Req() req: AuthenticatedRequest,
	): Promise<{ success: boolean }> {
		await this.reviewsService.unlikeReview(
			req.user.did,
			req.user.session as ATSession,
			reviewId,
		);
		return { success: true };
	}

	@Get(":reviewId/likes")
	@UseGuards(OptionalAuthGuard)
	@ApiOperation({ summary: "Get likes for a review" })
	@ApiOkResponse({
		description: "Likes retrieved",
		type: ReviewLikesResponseDto,
	})
	async getReviewLikes(
		@Param("reviewId") reviewId: string,
		@Req() req: AuthenticatedRequest,
	): Promise<ReviewLikesResponseDto> {
		const result = await this.reviewsService.getReviewLikes(
			reviewId,
			req.user?.did,
		);

		return {
			items: result.items.map((like) => ({
				userDid: like.userDid,
				userHandle: like.userHandle,
				userDisplayName: like.userDisplayName,
				userAvatar: like.userAvatar,
				createdAt: like.createdAt,
			})),
			total: result.total,
			hasLiked: result.hasLiked,
		};
	}

	private toReviewResponse(review: {
		id: string;
		rkey: string;
		title: string;
		markdown: string;
		description: string | null;
		textContent: string | null;
		publicationUri: string;
		mediaType: string;
		mediaId: string;
		seasonNumber: number;
		episodeNumber: number;
		createdAt: Date;
		updatedAt: Date;
	}): ReviewResponseDto {
		return {
			id: review.id,
			rkey: review.rkey,
			title: review.title,
			markdown: review.markdown,
			description: review.description ?? undefined,
			textContent: review.textContent ?? undefined,
			publicationUri: review.publicationUri,
			mediaType: review.mediaType,
			mediaId: review.mediaId,
			seasonNumber: review.seasonNumber || undefined,
			episodeNumber: review.episodeNumber || undefined,
			createdAt: review.createdAt.toISOString(),
			updatedAt: review.updatedAt.toISOString(),
		};
	}
}
