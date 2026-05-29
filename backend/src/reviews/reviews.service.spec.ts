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

jest.mock("../lexicons/site/standard/document", () => ({
	main: {
		build: jest.fn((data: Record<string, unknown>) => ({
			$type: "site.standard.document",
			...data,
		})),
		parse: jest.fn((data: Record<string, unknown>) => data),
	},
	$nsid: "site.standard.document",
}));

jest.mock("../lexicons/site/standard/publication", () => ({
	main: {
		build: jest.fn((data: Record<string, unknown>) => ({
			$type: "site.standard.publication",
			...data,
		})),
		parse: jest.fn((data: Record<string, unknown>) => data),
	},
	$nsid: "site.standard.publication",
}));

jest.mock("../lexicons/at/markpub/markdown.defs", () => ({
	main: {
		$type: "at.markpub.markdown",
		build: jest.fn((data: Record<string, unknown>) => ({
			$type: "at.markpub.markdown",
			...data,
		})),
	},
}));

jest.mock("../lexicons/xyz/opnshelf/mediaLink.defs", () => ({
	main: {
		$type: "xyz.opnshelf.mediaLink",
		build: jest.fn((data: Record<string, unknown>) => ({
			$type: "xyz.opnshelf.mediaLink",
			...data,
		})),
	},
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
		publication: {
			findUnique: jest.fn(),
			create: jest.fn(),
			upsert: jest.fn(),
			deleteMany: jest.fn(),
		},
		rating: {
			findMany: jest.fn(),
		},
		movie: {
			findMany: jest.fn(),
		},
		show: {
			findMany: jest.fn(),
		},
		season: {
			findMany: jest.fn(),
		},
		episode: {
			findMany: jest.fn(),
		},
		user: {
			findUnique: jest.fn(),
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
		it("returns reviews sorted by likes and date, enriched with the media poster", async () => {
			mockPrismaService.review.findMany.mockResolvedValue([
				{
					id: "r1",
					rkey: "rkey1",
					path: null,
					title: "Great film",
					markdown: "It was great.",
					description: "It was great.",
					userDid: "did:plc:u1",
					mediaType: "movie",
					mediaId: "123",
					seasonNumber: 0,
					episodeNumber: 0,
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
			mockPrismaService.rating.findMany.mockResolvedValue([]);
			mockPrismaService.movie.findMany.mockResolvedValue([
				{ movieId: "123", title: "Great Film", posterPath: "/poster.jpg" },
			]);

			const result = await service.getMediaReviews(
				{ mediaType: "movie", mediaId: "123" },
				"did:plc:viewer",
			);

			expect(result.items[0].likeCount).toBe(5);
			expect(result.items[0].hasLiked).toBe(false);
			expect(result.items[0].posterPath).toBe("/poster.jpg");
			expect(mockPrismaService.review.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					orderBy: [{ likes: { _count: "desc" } }, { createdAt: "desc" }],
				}),
			);
		});

		it("breaks like-count ties by the author's separate Rating, not the document", async () => {
			const base = {
				rkey: "rk",
				path: null,
				title: "t",
				markdown: "m",
				description: null,
				mediaType: "movie",
				mediaId: "123",
				seasonNumber: 0,
				episodeNumber: 0,
				_count: { likes: 3 },
				likes: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			mockPrismaService.review.findMany.mockResolvedValue([
				{
					...base,
					id: "low",
					userDid: "did:plc:low",
					user: { did: "did:plc:low", handle: "low" },
				},
				{
					...base,
					id: "high",
					userDid: "did:plc:high",
					user: { did: "did:plc:high", handle: "high" },
				},
			]);
			mockPrismaService.review.count.mockResolvedValue(2);
			mockPrismaService.movie.findMany.mockResolvedValue([]);
			mockPrismaService.rating.findMany.mockResolvedValue([
				{ userDid: "did:plc:low", rating: 4 },
				{ userDid: "did:plc:high", rating: 9 },
			]);

			const result = await service.getMediaReviews({
				mediaType: "movie",
				mediaId: "123",
			});

			// equal likeCount → higher author rating wins the tiebreak
			expect(result.items.map((r) => r.id)).toEqual(["high", "low"]);
			expect(mockPrismaService.rating.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						mediaType: "movie",
						mediaId: "123",
						userDid: { in: ["did:plc:low", "did:plc:high"] },
					}),
				}),
			);
		});
	});

	describe("getCanonicalReview", () => {
		const author = {
			did: "did:plc:author",
			handle: "alice",
			displayName: "Alice",
			avatar: null,
		};

		const reviewRow = {
			id: "review-1",
			rkey: "rkey-abc",
			path: "great-film",
			title: "Great film",
			markdown: "**Loved** it.",
			description: "Loved it.",
			userDid: author.did,
			mediaType: "movie",
			mediaId: "123",
			seasonNumber: 0,
			episodeNumber: 0,
			createdAt: new Date("2024-01-01"),
			updatedAt: new Date("2024-01-02"),
		};

		it("resolves a review matched by document path", async () => {
			mockPrismaService.user.findUnique.mockResolvedValue(author);
			mockPrismaService.review.findFirst.mockResolvedValue(reviewRow);
			mockPrismaService.movie.findMany.mockResolvedValue([
				{ movieId: "123", title: "Great Film", posterPath: "/poster.jpg" },
			]);

			const result = await service.getCanonicalReview("@Alice", "great-film");

			expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith(
				expect.objectContaining({ where: { handle: "alice" } }),
			);
			expect(mockPrismaService.review.findFirst).toHaveBeenCalledWith(
				expect.objectContaining({
					where: {
						userDid: author.did,
						OR: [{ path: "great-film" }, { rkey: "great-film" }],
					},
				}),
			);
			expect(result.title).toBe("Great film");
			expect(result.posterPath).toBe("/poster.jpg");
			expect(result.mediaTitle).toBe("Great Film");
			expect(result.author.handle).toBe("alice");
			expect(result.canonicalUrl).toBe(
				"https://opnshelf.xyz/@alice/great-film",
			);
		});

		it("falls back to matching by rkey when no path", async () => {
			const noPathRow = { ...reviewRow, path: null };
			mockPrismaService.user.findUnique.mockResolvedValue(author);
			mockPrismaService.review.findFirst.mockResolvedValue(noPathRow);
			mockPrismaService.movie.findMany.mockResolvedValue([]);

			const result = await service.getCanonicalReview("alice", "rkey-abc");

			expect(mockPrismaService.review.findFirst).toHaveBeenCalledWith(
				expect.objectContaining({
					where: {
						userDid: author.did,
						OR: [{ path: "rkey-abc" }, { rkey: "rkey-abc" }],
					},
				}),
			);
			// canonical URL uses rkey when the document carries no path
			expect(result.canonicalUrl).toBe("https://opnshelf.xyz/@alice/rkey-abc");
		});

		it("throws NotFoundException for an unknown handle", async () => {
			mockPrismaService.user.findUnique.mockResolvedValue(null);

			await expect(
				service.getCanonicalReview("ghost", "anything"),
			).rejects.toThrow(NotFoundException);
			expect(mockPrismaService.review.findFirst).not.toHaveBeenCalled();
		});

		it("throws NotFoundException when no document matches the segment", async () => {
			mockPrismaService.user.findUnique.mockResolvedValue(author);
			mockPrismaService.review.findFirst.mockResolvedValue(null);

			await expect(
				service.getCanonicalReview("alice", "missing"),
			).rejects.toThrow(NotFoundException);
		});
	});

	describe("createReview", () => {
		it("mints a publication on first review and writes a document", async () => {
			mockPrismaService.publication.findUnique.mockResolvedValue(null);
			mockPrismaService.user.findUnique.mockResolvedValue({ handle: "alice" });
			mockPutRecord
				.mockResolvedValueOnce({
					data: {
						uri: "at://did:plc:abc123/site.standard.publication/self",
						cid: "cid-pub",
					},
				})
				.mockResolvedValueOnce({
					data: {
						uri: "at://did:plc:abc123/site.standard.document/testtid123",
						cid: "cid-doc",
					},
				});
			mockPrismaService.publication.upsert.mockResolvedValue({});
			mockPrismaService.review.create.mockImplementation(
				({ data }: { data: Record<string, unknown> }) => ({
					id: "review-1",
					...data,
				}),
			);

			const result = await service.createReview(session.did, session, {
				mediaType: "movie",
				mediaId: "123",
				title: "My take",
				markdown: "**Loved** it.",
			});

			// publication minted with literal `self` rkey
			expect(mockPutRecord).toHaveBeenNthCalledWith(
				1,
				expect.objectContaining({
					collection: "site.standard.publication",
					rkey: "self",
				}),
			);
			// document written
			expect(mockPutRecord).toHaveBeenNthCalledWith(
				2,
				expect.objectContaining({
					collection: "site.standard.document",
					rkey: "testtid123",
				}),
			);
			expect(result.title).toBe("My take");
			expect(result.publicationUri).toBe(
				"at://did:plc:abc123/site.standard.publication/self",
			);
		});

		it("reuses an existing publication", async () => {
			mockPrismaService.publication.findUnique.mockResolvedValue({
				uri: "at://did:plc:abc123/site.standard.publication/self",
			});
			mockPutRecord.mockResolvedValue({
				data: {
					uri: "at://did:plc:abc123/site.standard.document/testtid123",
					cid: "cid-doc",
				},
			});
			mockPrismaService.review.create.mockImplementation(
				({ data }: { data: Record<string, unknown> }) => ({
					id: "review-1",
					...data,
				}),
			);

			await service.createReview(session.did, session, {
				mediaType: "movie",
				mediaId: "123",
				title: "My take",
				markdown: "Loved it.",
			});

			// only the document is written; publication is not re-minted
			expect(mockPutRecord).toHaveBeenCalledTimes(1);
			expect(mockPutRecord).toHaveBeenCalledWith(
				expect.objectContaining({ collection: "site.standard.document" }),
			);
		});
	});

	describe("indexDocumentRecord", () => {
		it("ignores documents without a mediaLink", async () => {
			await service.indexDocumentRecord(
				"at://did:plc:u1/site.standard.document/x",
				"cid",
				"x",
				"did:plc:u1",
				{ title: "Blog", site: "at://pub", links: undefined } as never,
			);
			expect(mockPrismaService.review.upsert).not.toHaveBeenCalled();
		});

		it("indexes documents carrying an opnshelf mediaLink", async () => {
			mockPrismaService.review.upsert.mockResolvedValue({});
			await service.indexDocumentRecord(
				"at://did:plc:u1/site.standard.document/x",
				"cid",
				"x",
				"did:plc:u1",
				{
					title: "Review",
					site: "at://pub",
					content: {
						$type: "at.markpub.markdown",
						text: { markdown: "body" },
					},
					links: {
						$type: "xyz.opnshelf.mediaLink",
						mediaType: "movie",
						mediaId: "123",
					},
				} as never,
			);
			expect(mockPrismaService.review.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					create: expect.objectContaining({
						mediaId: "123",
						markdown: "body",
						title: "Review",
					}),
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
