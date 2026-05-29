import { Test, type TestingModule } from "@nestjs/testing";
import { ReviewsController } from "./reviews.controller";
import { ReviewsService } from "./reviews.service";

jest.mock("../auth/auth.guard", () => ({
	AuthGuard: jest.fn().mockImplementation(() => ({
		canActivate: jest.fn(() => true),
	})),
}));

jest.mock("../auth/optional-auth.guard", () => ({
	OptionalAuthGuard: jest.fn().mockImplementation(() => ({
		canActivate: jest.fn(() => true),
	})),
}));

describe("ReviewsController", () => {
	let controller: ReviewsController;
	let mockReviewsService: {
		getMediaReviews: jest.Mock;
		likeReview: jest.Mock;
		unlikeReview: jest.Mock;
		getReviewLikes: jest.Mock;
	};

	beforeEach(async () => {
		mockReviewsService = {
			getMediaReviews: jest.fn(),
			likeReview: jest.fn(),
			unlikeReview: jest.fn(),
			getReviewLikes: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			controllers: [ReviewsController],
			providers: [{ provide: ReviewsService, useValue: mockReviewsService }],
		}).compile();

		controller = module.get<ReviewsController>(ReviewsController);
	});

	describe("POST /reviews/:reviewId/like", () => {
		it("requires auth", async () => {
			mockReviewsService.likeReview.mockResolvedValue({});
			const req = { user: { did: "did:plc:abc123", session: {} } } as any;

			const result = await controller.likeReview("review-1", req);

			expect(mockReviewsService.likeReview).toHaveBeenCalledWith(
				"did:plc:abc123",
				req.user.session,
				"review-1",
			);
			expect(result).toEqual({ success: true });
		});
	});

	describe("DELETE /reviews/:reviewId/like", () => {
		it("requires auth", async () => {
			mockReviewsService.unlikeReview.mockResolvedValue({});
			const req = { user: { did: "did:plc:abc123", session: {} } } as any;

			const result = await controller.unlikeReview("review-1", req);

			expect(mockReviewsService.unlikeReview).toHaveBeenCalledWith(
				"did:plc:abc123",
				req.user.session,
				"review-1",
			);
			expect(result).toEqual({ success: true });
		});
	});

	describe("GET /reviews/:reviewId/likes", () => {
		it("is public and returns likes", async () => {
			mockReviewsService.getReviewLikes.mockResolvedValue({
				items: [],
				total: 0,
				hasLiked: false,
			});
			const req = { user: undefined } as any;

			const result = await controller.getReviewLikes("review-1", req);

			expect(mockReviewsService.getReviewLikes).toHaveBeenCalledWith(
				"review-1",
				undefined,
			);
			expect(result).toEqual({ items: [], total: 0, hasLiked: false });
		});
	});

	describe("GET /reviews/media", () => {
		it("uses optional auth to populate hasLiked", async () => {
			mockReviewsService.getMediaReviews.mockResolvedValue({
				items: [
					{
						id: "r1",
						title: "Great film",
						markdown: "It was great.",
						description: "It was great.",
						user: {
							did: "did:plc:u1",
							handle: "u1",
							displayName: null,
							avatar: null,
						},
						likeCount: 2,
						hasLiked: true,
						createdAt: new Date(),
						updatedAt: new Date(),
					},
				],
				total: 1,
				nextCursor: null,
			});
			const req = { user: { did: "did:plc:abc123" } } as any;

			const result = await controller.getMediaReviews(
				{ mediaType: "movie", mediaId: "123" } as any,
				req,
			);

			expect(mockReviewsService.getMediaReviews).toHaveBeenCalledWith(
				{ mediaType: "movie", mediaId: "123" },
				"did:plc:abc123",
			);
			expect(result.items[0].hasLiked).toBe(true);
		});
	});
});
