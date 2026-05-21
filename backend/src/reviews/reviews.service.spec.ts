import { Test, type TestingModule } from "@nestjs/testing";

jest.mock("../prisma/prisma.service", () => ({
	PrismaService: jest.fn(),
}));

const mockPutRecord = jest.fn();
const mockDeleteRecord = jest.fn();
jest.mock("@atproto/api", () => ({
	Agent: jest.fn().mockImplementation(() => ({
		com: {
			atproto: {
				repo: {
					putRecord: mockPutRecord,
					deleteRecord: mockDeleteRecord,
				},
			},
		},
	})),
}));

jest.mock("@atproto/common", () => ({
	TID: {
		nextStr: jest.fn(() => "testtid123"),
	},
}));

jest.mock("../lexicons/xyz/opnshelf/review", () => ({
	main: {
		build: jest.fn((data: Record<string, unknown>) => ({
			$type: "xyz.opnshelf.review",
			...data,
		})),
		parse: jest.fn((data: Record<string, unknown>) => data),
	},
	$nsid: "xyz.opnshelf.review",
}));

jest.mock("../lexicons/xyz/opnshelf/review/like", () => ({
	main: {
		build: jest.fn((data: Record<string, unknown>) => ({
			$type: "xyz.opnshelf.review.like",
			...data,
		})),
		parse: jest.fn((data: Record<string, unknown>) => data),
	},
	$nsid: "xyz.opnshelf.review.like",
}));

import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewsService, type ATSession } from "./reviews.service";

describe("ReviewsService", () => {
	let service: ReviewsService;

	const mockPrismaService = {
		review: {
			findUnique: jest.fn(),
			findFirst: jest.fn(),
			findMany: jest.fn(),
			count: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			upsert: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn(),
			aggregate: jest.fn(),
		},
		reviewLike: {
			findUnique: jest.fn(),
			findMany: jest.fn(),
			create: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn(),
			upsert: jest.fn(),
			count: jest.fn(),
		},
	};

	const session: ATSession = { did: "did:plc:abc123" };

	beforeEach(async () => {
		jest.clearAllMocks();
		mockPutRecord.mockReset();
		mockDeleteRecord.mockReset();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ReviewsService,
				{ provide: PrismaService, useValue: mockPrismaService },
			],
		}).compile();

		service = module.get<ReviewsService>(ReviewsService);
	});

	describe("likeReview", () => {
		it("creates a like record in PDS and DB", async () => {
			const review = {
				id: "review-1",
				uri: "at://did:plc:other/xyz.opnshelf.review/rkey1",
				userDid: "did:plc:other",
			};
			mockPrismaService.review.findUnique.mockResolvedValue(review);
			mockPrismaService.reviewLike.findUnique.mockResolvedValue(null);
			mockPutRecord.mockResolvedValue({
				data: {
					uri: "at://did:plc:abc123/xyz.opnshelf.review.like/testtid123",
					cid: "cid-like",
				},
			});
			mockPrismaService.reviewLike.create.mockResolvedValue({
				id: "like-1",
				rkey: "testtid123",
				uri: "at://did:plc:abc123/xyz.opnshelf.review.like/testtid123",
				cid: "cid-like",
				userDid: session.did,
				reviewId: review.id,
			});

			const result = await service.likeReview(session.did, session, review.id);

			expect(mockPutRecord).toHaveBeenCalledWith(
				expect.objectContaining({
					repo: session.did,
					collection: "xyz.opnshelf.review.like",
					rkey: "testtid123",
				}),
			);
			expect(mockPrismaService.reviewLike.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						reviewId: review.id,
						userDid: session.did,
					}),
				}),
			);
			expect(result).toBeDefined();
		});

		it("rejects liking own review", async () => {
			const review = {
				id: "review-1",
				uri: "at://did:plc:abc123/xyz.opnshelf.review/rkey1",
				userDid: session.did,
			};
			mockPrismaService.review.findUnique.mockResolvedValue(review);

			await expect(
				service.likeReview(session.did, session, review.id),
			).rejects.toThrow("Cannot like your own review");
		});

		it("rejects duplicate like", async () => {
			const review = {
				id: "review-1",
				uri: "at://did:plc:other/xyz.opnshelf.review/rkey1",
				userDid: "did:plc:other",
			};
			mockPrismaService.review.findUnique.mockResolvedValue(review);
			mockPrismaService.reviewLike.findUnique.mockResolvedValue({
				id: "like-1",
			});

			await expect(
				service.likeReview(session.did, session, review.id),
			).rejects.toThrow("Already liked this review");
		});
	});

	describe("unlikeReview", () => {
		it("deletes like from PDS and DB", async () => {
			const like = {
				id: "like-1",
				rkey: "like-rkey-1",
				reviewId: "review-1",
			};
			mockPrismaService.reviewLike.findUnique.mockResolvedValue(like);
			mockPrismaService.reviewLike.delete.mockResolvedValue({});

			await service.unlikeReview(session.did, session, like.reviewId);

			expect(mockDeleteRecord).toHaveBeenCalledWith(
				expect.objectContaining({
					repo: session.did,
					collection: "xyz.opnshelf.review.like",
					rkey: like.rkey,
				}),
			);
			expect(mockPrismaService.reviewLike.delete).toHaveBeenCalledWith(
				expect.objectContaining({ where: { id: like.id } }),
			);
		});

		it("throws NotFoundException when like does not exist", async () => {
			mockPrismaService.reviewLike.findUnique.mockResolvedValue(null);

			await expect(
				service.unlikeReview(session.did, session, "review-1"),
			).rejects.toThrow(NotFoundException);
		});
	});

	describe("getMediaReviews", () => {
		it("returns reviews sorted by likes, rating, and date", async () => {
			mockPrismaService.review.findMany.mockResolvedValue([
				{
					id: "r1",
					rating: 8,
					user: {
						did: "did:plc:u1",
						handle: "u1",
						displayName: null,
						avatar: null,
					},
					_count: { likes: 5 },
					likes: [],
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			]);
			mockPrismaService.review.count.mockResolvedValue(1);
			mockPrismaService.review.aggregate.mockResolvedValue({
				_avg: { rating: 8 },
			});

			const result = await service.getMediaReviews(
				{ mediaType: "movie", mediaId: "123" },
				"did:plc:viewer",
			);

			expect(result.items[0].likeCount).toBe(5);
			expect(result.items[0].hasLiked).toBe(false);
			expect(mockPrismaService.review.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					orderBy: [
						{ likes: { _count: "desc" } },
						{ rating: "desc" },
						{ createdAt: "desc" },
					],
				}),
			);
		});
	});

	describe("getReviewLikes", () => {
		it("returns likes with user info and hasLiked flag", async () => {
			mockPrismaService.reviewLike.findMany.mockResolvedValue([
				{
					user: {
						did: "did:plc:u1",
						handle: "u1",
						displayName: "User",
						avatar: null,
					},
					createdAt: new Date("2024-01-01"),
				},
			]);
			mockPrismaService.reviewLike.count.mockResolvedValue(1);
			mockPrismaService.reviewLike.findUnique.mockResolvedValue(null);

			const result = await service.getReviewLikes("review-1", "did:plc:viewer");

			expect(result.total).toBe(1);
			expect(result.hasLiked).toBe(false);
			expect(result.items[0].userHandle).toBe("u1");
		});
	});
});
