vi.mock("../prisma/prisma.service", () => ({
	PrismaService: vi.fn(),
}));

const mockPutRecord = vi.fn();
const mockDeleteRecord = vi.fn();
vi.mock("@atproto/api", () => ({
	Agent: vi.fn().mockImplementation(() => ({
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

vi.mock("@atproto/common", () => ({
	TID: {
		nextStr: vi.fn(() => "testtid123"),
	},
}));

vi.mock("../lexicons/xyz/opnshelf/review/like", () => ({
	main: {
		build: vi.fn((data: Record<string, unknown>) => ({
			$type: "xyz.opnshelf.review.like",
			...data,
		})),
		parse: vi.fn((data: Record<string, unknown>) => data),
	},
	$nsid: "xyz.opnshelf.review.like",
}));

import {
	ConflictException,
	ForbiddenException,
	NotFoundException,
} from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";
import { ReviewLikesService } from "./review-likes.service";
import type { ATSession } from "./reviews.service";

describe("ReviewLikesService", () => {
	const mockPrismaService = {
		review: {
			findUnique: vi.fn(),
			findFirst: vi.fn(),
		},
		reviewLike: {
			findUnique: vi.fn(),
			findMany: vi.fn(),
			create: vi.fn(),
			delete: vi.fn(),
			deleteMany: vi.fn(),
			upsert: vi.fn(),
			count: vi.fn(),
		},
	};

	const session: ATSession = { did: "did:plc:abc123" };
	let service: ReviewLikesService;

	beforeEach(() => {
		vi.clearAllMocks();
		mockPutRecord.mockReset();
		mockDeleteRecord.mockReset();
		service = new ReviewLikesService(
			mockPrismaService as unknown as PrismaService,
		);
	});

	describe("like", () => {
		it("creates a like record in PDS and DB targeting the review URI", async () => {
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

			const result = await service.like(session.did, session, review.id);

			expect(mockPutRecord).toHaveBeenCalledWith(
				expect.objectContaining({
					repo: session.did,
					collection: "xyz.opnshelf.review.like",
					rkey: "testtid123",
					record: expect.objectContaining({
						// reviewUri must point at the xyz.opnshelf.review record (ADR-0013).
						reviewUri: "at://did:plc:other/xyz.opnshelf.review/rkey1",
					}),
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

		it("rejects liking own review with 403", async () => {
			const review = {
				id: "review-1",
				uri: "at://did:plc:abc123/xyz.opnshelf.review/rkey1",
				userDid: session.did,
			};
			mockPrismaService.review.findUnique.mockResolvedValue(review);

			await expect(
				service.like(session.did, session, review.id),
			).rejects.toThrow(ForbiddenException);
		});

		it("rejects duplicate like with 409", async () => {
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
				service.like(session.did, session, review.id),
			).rejects.toThrow(ConflictException);
		});

		it("throws NotFoundException for an unknown review", async () => {
			mockPrismaService.review.findUnique.mockResolvedValue(null);

			await expect(
				service.like(session.did, session, "missing"),
			).rejects.toThrow(NotFoundException);
			expect(mockPutRecord).not.toHaveBeenCalled();
		});
	});

	describe("unlike", () => {
		it("deletes like from PDS and DB", async () => {
			const like = {
				id: "like-1",
				rkey: "like-rkey-1",
				reviewId: "review-1",
			};
			mockPrismaService.reviewLike.findUnique.mockResolvedValue(like);
			mockPrismaService.reviewLike.delete.mockResolvedValue({});

			await service.unlike(session.did, session, like.reviewId);

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
				service.unlike(session.did, session, "review-1"),
			).rejects.toThrow(NotFoundException);
		});

		it("keeps the local like when the PDS deletion fails", async () => {
			mockPrismaService.reviewLike.findUnique.mockResolvedValue({
				id: "like-1",
				rkey: "like-rkey-1",
				reviewId: "review-1",
			});
			const failure = new Error("PDS unavailable");
			mockDeleteRecord.mockRejectedValue(failure);

			await expect(
				service.unlike(session.did, session, "review-1"),
			).rejects.toBe(failure);
			expect(mockPrismaService.reviewLike.delete).not.toHaveBeenCalled();
		});

		it("clears the local like when the PDS record is already absent", async () => {
			mockPrismaService.reviewLike.findUnique.mockResolvedValue({
				id: "like-1",
				rkey: "like-rkey-1",
				reviewId: "review-1",
			});
			mockDeleteRecord.mockRejectedValue({
				status: 404,
				error: "RecordNotFound",
			});

			await service.unlike(session.did, session, "review-1");
			expect(mockPrismaService.reviewLike.delete).toHaveBeenCalledWith({
				where: { id: "like-1" },
			});
		});
	});

	describe("list", () => {
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

			const result = await service.list("review-1", "did:plc:viewer");

			expect(result.total).toBe(1);
			expect(result.hasLiked).toBe(false);
			expect(result.items[0].userHandle).toBe("u1");
		});
	});

	describe("indexRecord", () => {
		const record = {
			$type: "xyz.opnshelf.review.like",
			reviewUri: "at://did:plc:other/xyz.opnshelf.review/rkey1",
			createdAt: "2024-01-01T00:00:00.000Z",
		} as never;

		it("upserts the like against the locally indexed Review", async () => {
			mockPrismaService.review.findFirst.mockResolvedValue({ id: "review-1" });
			mockPrismaService.reviewLike.upsert.mockResolvedValue({});

			await service.indexRecord(
				"at://did:plc:abc123/xyz.opnshelf.review.like/x",
				"cid",
				"x",
				"did:plc:abc123",
				record,
			);

			expect(mockPrismaService.reviewLike.upsert).toHaveBeenCalledWith({
				where: { userDid_rkey: { userDid: "did:plc:abc123", rkey: "x" } },
				create: {
					rkey: "x",
					uri: "at://did:plc:abc123/xyz.opnshelf.review.like/x",
					cid: "cid",
					userDid: "did:plc:abc123",
					reviewId: "review-1",
				},
				update: {
					cid: "cid",
					uri: "at://did:plc:abc123/xyz.opnshelf.review.like/x",
					reviewId: "review-1",
				},
			});
		});

		it("ignores likes for Reviews that are not indexed locally", async () => {
			mockPrismaService.review.findFirst.mockResolvedValue(null);

			await service.indexRecord(
				"at://did:plc:abc123/xyz.opnshelf.review.like/x",
				"cid",
				"x",
				"did:plc:abc123",
				record,
			);

			expect(mockPrismaService.reviewLike.upsert).not.toHaveBeenCalled();
		});
	});

	describe("deleteRecord", () => {
		it("removes the like by repository-qualified rkey", async () => {
			mockPrismaService.reviewLike.deleteMany.mockResolvedValue({ count: 1 });

			await service.deleteRecord("did:plc:abc123", "x");

			expect(mockPrismaService.reviewLike.deleteMany).toHaveBeenCalledWith({
				where: { userDid: "did:plc:abc123", rkey: "x" },
			});
		});
	});
});
