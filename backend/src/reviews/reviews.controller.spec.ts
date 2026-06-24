import type { Mock } from "vitest";
import { Test, type TestingModule } from "@nestjs/testing";
import { ReviewsController } from "./reviews.controller";
import { ReviewsService } from "./reviews.service";

vi.mock("../auth/auth.guard", () => ({
	AuthGuard: vi.fn().mockImplementation(() => ({
		canActivate: vi.fn(() => true),
	})),
}));

vi.mock("../auth/optional-auth.guard", () => ({
	OptionalAuthGuard: vi.fn().mockImplementation(() => ({
		canActivate: vi.fn(() => true),
	})),
}));

// The like/unlike/getReviewLikes handlers are thin passthroughs (guards are
// stubbed here, so they verify nothing about auth) — their behavior is covered
// in reviews.service.spec. The one piece of real controller logic is the
// canonical reviewUrl assembly in getMediaReviews (#115).
describe("ReviewsController", () => {
	let controller: ReviewsController;
	let mockReviewsService: { getMediaReviews: Mock };

	beforeEach(async () => {
		mockReviewsService = { getMediaReviews: vi.fn() };

		const module: TestingModule = await Test.createTestingModule({
			controllers: [ReviewsController],
			providers: [{ provide: ReviewsService, useValue: mockReviewsService }],
		}).compile();

		controller = module.get<ReviewsController>(ReviewsController);
	});

	it("builds the canonical reviewUrl from the human path, falling back to rkey", async () => {
		const base = {
			title: "t",
			markdown: "m",
			description: null,
			posterPath: null,
			likeCount: 0,
			hasLiked: false,
			authorRating: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		};
		mockReviewsService.getMediaReviews.mockResolvedValue({
			items: [
				{
					...base,
					id: "r1",
					rkey: "rkey1",
					path: "my-great-film",
					user: { did: "did:1", handle: "alice.opnshelf.xyz" },
				},
				{
					...base,
					id: "r2",
					rkey: "rkey2",
					path: null,
					user: { did: "did:2", handle: "bob.opnshelf.xyz" },
				},
			],
			total: 2,
			nextCursor: null,
		});

		const result = await controller.getMediaReviews(
			{ mediaType: "movie", mediaId: "123" } as never,
			{ user: { did: "did:viewer" } } as never,
		);

		expect(result.items[0].reviewUrl).toBe(
			"/@alice.opnshelf.xyz/my-great-film",
		);
		expect(result.items[1].reviewUrl).toBe("/@bob.opnshelf.xyz/rkey2");
	});
});
