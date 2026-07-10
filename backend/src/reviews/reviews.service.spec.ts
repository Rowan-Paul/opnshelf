import { Test, type TestingModule } from "@nestjs/testing";

vi.mock("../prisma/prisma.service", () => ({
	PrismaService: vi.fn(),
}));

const mockPutRecord = vi.fn();
const mockDeleteRecord = vi.fn();
const mockListRecords = vi.fn();
vi.mock("@atproto/api", () => ({
	Agent: vi.fn().mockImplementation(() => ({
		com: {
			atproto: {
				repo: {
					putRecord: mockPutRecord,
					deleteRecord: mockDeleteRecord,
					listRecords: mockListRecords,
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

vi.mock("../lexicons/xyz/opnshelf/review", () => ({
	main: {
		build: vi.fn((data: Record<string, unknown>) => ({
			$type: "xyz.opnshelf.review",
			...data,
		})),
		parse: vi.fn((data: Record<string, unknown>) => data),
	},
	$nsid: "xyz.opnshelf.review",
}));

vi.mock("../lexicons/site/standard/document", () => ({
	main: {
		build: vi.fn((data: Record<string, unknown>) => ({
			$type: "site.standard.document",
			...data,
		})),
		parse: vi.fn((data: Record<string, unknown>) => data),
	},
	$nsid: "site.standard.document",
}));

vi.mock("../lexicons/site/standard/publication", () => ({
	main: {
		build: vi.fn((data: Record<string, unknown>) => ({
			$type: "site.standard.publication",
			...data,
		})),
		parse: vi.fn((data: Record<string, unknown>) => data),
	},
	$nsid: "site.standard.publication",
}));

vi.mock("../lexicons/at/markpub/markdown.defs", () => ({
	main: {
		$type: "at.markpub.markdown",
		build: vi.fn((data: Record<string, unknown>) => ({
			$type: "at.markpub.markdown",
			...data,
		})),
	},
}));

vi.mock("../lexicons/xyz/opnshelf/mediaLink.defs", () => ({
	main: {
		$type: "xyz.opnshelf.mediaLink",
		build: vi.fn((data: Record<string, unknown>) => ({
			$type: "xyz.opnshelf.mediaLink",
			...data,
		})),
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
import { PrismaService } from "../prisma/prisma.service";
import { ReviewsService, type ATSession } from "./reviews.service";

describe("ReviewsService", () => {
	let service: ReviewsService;

	const mockPrismaService = {
		review: {
			findUnique: vi.fn(),
			findFirst: vi.fn(),
			findMany: vi.fn(),
			count: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			upsert: vi.fn(),
			delete: vi.fn(),
			deleteMany: vi.fn(),
			aggregate: vi.fn(),
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
		publication: {
			findUnique: vi.fn(),
			findFirst: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			upsert: vi.fn(),
			deleteMany: vi.fn(),
		},
		rating: {
			findMany: vi.fn(),
		},
		movie: {
			findMany: vi.fn(),
		},
		show: {
			findMany: vi.fn(),
		},
		season: {
			findMany: vi.fn(),
		},
		episode: {
			findMany: vi.fn(),
		},
		user: {
			findUnique: vi.fn(),
		},
	};

	const session: ATSession = { did: "did:plc:abc123" };

	beforeEach(async () => {
		vi.clearAllMocks();
		mockPutRecord.mockReset();
		mockDeleteRecord.mockReset();
		mockListRecords.mockReset();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ReviewsService,
				{ provide: PrismaService, useValue: mockPrismaService },
			],
		}).compile();

		service = module.get<ReviewsService>(ReviewsService);
	});

	describe("likeReview", () => {
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

			const result = await service.likeReview(session.did, session, review.id);

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
				service.likeReview(session.did, session, review.id),
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
				service.likeReview(session.did, session, review.id),
			).rejects.toThrow(ConflictException);
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
					title: "Great film",
					markdown: "It was great.",
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
			// excerpt computed on read from the markdown body
			expect(result.items[0].description).toBe("It was great.");
			expect(mockPrismaService.review.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					orderBy: [{ likes: { _count: "desc" } }, { createdAt: "desc" }],
				}),
			);
		});

		it("breaks like-count ties by the author's separate Rating, not the review", async () => {
			const base = {
				rkey: "rk",
				title: "t",
				markdown: "m",
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
			title: "Great film",
			markdown: "**Loved** it.",
			userDid: author.did,
			mediaType: "movie",
			mediaId: "123",
			seasonNumber: 0,
			episodeNumber: 0,
			createdAt: new Date("2024-01-01"),
			updatedAt: new Date("2024-01-02"),
		};

		it("resolves a review by handle + rkey", async () => {
			mockPrismaService.user.findUnique.mockResolvedValue(author);
			mockPrismaService.review.findFirst.mockResolvedValue(reviewRow);
			mockPrismaService.movie.findMany.mockResolvedValue([
				{ movieId: "123", title: "Great Film", posterPath: "/poster.jpg" },
			]);

			const result = await service.getCanonicalReview("@Alice", "rkey-abc");

			expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith(
				expect.objectContaining({ where: { handle: "alice" } }),
			);
			expect(mockPrismaService.review.findFirst).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { userDid: author.did, rkey: "rkey-abc" },
				}),
			);
			expect(result.title).toBe("Great film");
			expect(result.posterPath).toBe("/poster.jpg");
			expect(result.mediaTitle).toBe("Great Film");
			expect(result.author.handle).toBe("alice");
			expect(result.canonicalUrl).toBe(
				"https://opnshelf.xyz/reviews/alice/rkey-abc",
			);
		});

		it("throws NotFoundException for an unknown handle", async () => {
			mockPrismaService.user.findUnique.mockResolvedValue(null);

			await expect(
				service.getCanonicalReview("ghost", "anything"),
			).rejects.toThrow(NotFoundException);
			expect(mockPrismaService.review.findFirst).not.toHaveBeenCalled();
		});

		it("throws NotFoundException when no review matches the rkey", async () => {
			mockPrismaService.user.findUnique.mockResolvedValue(author);
			mockPrismaService.review.findFirst.mockResolvedValue(null);

			await expect(
				service.getCanonicalReview("alice", "missing"),
			).rejects.toThrow(NotFoundException);
		});
	});

	describe("createReview", () => {
		const createdRow = (data: Record<string, unknown>) => ({
			id: "review-1",
			blogDocumentUri: null,
			blogDocumentCid: null,
			createdAt: new Date("2024-01-01"),
			updatedAt: new Date("2024-01-01"),
			...data,
		});

		it("writes an xyz.opnshelf.review record and no blog mirror when no publication is selected", async () => {
			mockPrismaService.user.findUnique.mockResolvedValue({
				reviewsPublicationUri: null,
			});
			mockPutRecord.mockResolvedValue({
				data: {
					uri: "at://did:plc:abc123/xyz.opnshelf.review/testtid123",
					cid: "cid-review",
				},
			});
			mockPrismaService.review.create.mockImplementation(
				({ data }: { data: Record<string, unknown> }) => createdRow(data),
			);

			const result = await service.createReview(session.did, session, {
				mediaType: "movie",
				mediaId: "123",
				title: "My take",
				markdown: "**Loved** it.",
			});

			// exactly one PDS write — the review record; no blog mirror document
			expect(mockPutRecord).toHaveBeenCalledTimes(1);
			expect(mockPutRecord).toHaveBeenCalledWith(
				expect.objectContaining({
					collection: "xyz.opnshelf.review",
					rkey: "testtid123",
					record: expect.objectContaining({
						title: "My take",
						content: "**Loved** it.",
						mediaType: "movie",
						mediaId: "123",
					}),
				}),
			);
			expect(mockPrismaService.review.update).not.toHaveBeenCalled();
			expect(result.title).toBe("My take");
		});

		it("mirrors to the selected blog publication and stores the document pointer", async () => {
			mockPrismaService.user.findUnique.mockResolvedValue({
				reviewsPublicationUri:
					"at://did:plc:abc123/site.standard.publication/leaflet",
			});
			mockPutRecord
				.mockResolvedValueOnce({
					data: {
						uri: "at://did:plc:abc123/xyz.opnshelf.review/testtid123",
						cid: "cid-review",
					},
				})
				.mockResolvedValueOnce({
					data: {
						uri: "at://did:plc:abc123/site.standard.document/testtid123",
						cid: "cid-doc",
					},
				});
			mockPrismaService.review.create.mockImplementation(
				({ data }: { data: Record<string, unknown> }) => createdRow(data),
			);
			mockPrismaService.review.update.mockImplementation(
				({ data }: { data: Record<string, unknown> }) => ({
					id: "review-1",
					title: "My take",
					...data,
				}),
			);

			await service.createReview(session.did, session, {
				mediaType: "movie",
				mediaId: "123",
				title: "My take",
				markdown: "Loved it.",
			});

			// review first, then the mirror document at the same rkey
			expect(mockPutRecord).toHaveBeenNthCalledWith(
				1,
				expect.objectContaining({ collection: "xyz.opnshelf.review" }),
			);
			expect(mockPutRecord).toHaveBeenNthCalledWith(
				2,
				expect.objectContaining({
					collection: "site.standard.document",
					rkey: "testtid123",
					record: expect.objectContaining({
						site: "at://did:plc:abc123/site.standard.publication/leaflet",
					}),
				}),
			);
			// pointer persisted on the Review row
			expect(mockPrismaService.review.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: "review-1" },
					data: expect.objectContaining({
						blogDocumentUri:
							"at://did:plc:abc123/site.standard.document/testtid123",
						blogDocumentCid: "cid-doc",
					}),
				}),
			);
		});

		it("skips the blog mirror when the review opts out, even with a publication selected", async () => {
			mockPrismaService.user.findUnique.mockResolvedValue({
				reviewsPublicationUri:
					"at://did:plc:abc123/site.standard.publication/leaflet",
			});
			mockPutRecord.mockResolvedValue({
				data: {
					uri: "at://did:plc:abc123/xyz.opnshelf.review/testtid123",
					cid: "cid-review",
				},
			});
			mockPrismaService.review.create.mockImplementation(
				({ data }: { data: Record<string, unknown> }) => createdRow(data),
			);

			await service.createReview(session.did, session, {
				mediaType: "movie",
				mediaId: "123",
				title: "Private take",
				markdown: "Just for opnshelf.",
				mirrorToBlog: false,
			});

			// only the review record is written; no mirror document, no delete
			expect(mockPutRecord).toHaveBeenCalledTimes(1);
			expect(mockPutRecord).toHaveBeenCalledWith(
				expect.objectContaining({ collection: "xyz.opnshelf.review" }),
			);
			expect(mockDeleteRecord).not.toHaveBeenCalled();
			expect(mockPrismaService.review.update).not.toHaveBeenCalled();
		});

		it("frames the blog mirror with a media header and an opnshelf promo", async () => {
			mockPrismaService.user.findUnique.mockResolvedValue({
				reviewsPublicationUri:
					"at://did:plc:abc123/site.standard.publication/leaflet",
			});
			mockPrismaService.movie.findMany.mockResolvedValue([
				{ movieId: "123", title: "Dune", posterPath: "/dune.jpg" },
			]);
			mockPutRecord
				.mockResolvedValueOnce({
					data: {
						uri: "at://did:plc:abc123/xyz.opnshelf.review/testtid123",
						cid: "cid-review",
					},
				})
				.mockResolvedValueOnce({
					data: {
						uri: "at://did:plc:abc123/site.standard.document/testtid123",
						cid: "cid-doc",
					},
				});
			mockPrismaService.review.create.mockImplementation(
				({ data }: { data: Record<string, unknown> }) => createdRow(data),
			);
			mockPrismaService.review.update.mockImplementation(
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

			// The document write is the 2nd putRecord; its rendered markdown carries
			// the poster, a linked media title, the review body, and an opnshelf
			// promo footer that links to the media page (not back to the review).
			const docCall = mockPutRecord.mock.calls[1][0];
			const rendered = docCall.record.content.text.markdown as string;
			expect(rendered).toContain("https://image.tmdb.org/t/p/w342/dune.jpg");
			expect(rendered).toContain(
				"[Dune](https://opnshelf.xyz/movies/123/dune)",
			);
			expect(rendered).toContain("Loved it.");
			// Entire promo sentence is the clickable link.
			expect(rendered).toContain(
				"[Posted with opnshelf — track what you're watching and share your reviews on the open social web.](https://opnshelf.xyz/movies/123/dune)",
			);
			// Not a "read this review" backlink to the canonical review page.
			expect(rendered).not.toContain("/reviews/");
		});

		it("emits Leaflet content only when the user explicitly selected Leaflet", async () => {
			mockPrismaService.user.findUnique.mockResolvedValue({
				reviewsPublicationUri:
					"at://did:plc:abc123/site.standard.publication/leaflet",
				reviewsMirrorFormat: "leaflet",
			});
			mockPutRecord
				.mockResolvedValueOnce({
					data: {
						uri: "at://did:plc:abc123/xyz.opnshelf.review/testtid123",
						cid: "cid-review",
					},
				})
				.mockResolvedValueOnce({
					data: {
						uri: "at://did:plc:abc123/site.standard.document/testtid123",
						cid: "cid-doc",
					},
				});
			mockPrismaService.review.create.mockImplementation(
				({ data }: { data: Record<string, unknown> }) => createdRow(data),
			);
			mockPrismaService.review.update.mockImplementation(
				({ data }: { data: Record<string, unknown> }) => ({
					id: "review-1",
					...data,
				}),
			);

			await service.createReview(session.did, session, {
				mediaType: "movie",
				mediaId: "123",
				title: "My take",
				markdown: "# Heading\n\n**Loved** it.",
			});

			const content = mockPutRecord.mock.calls[1][0].record.content;
			expect(content.$type).toBe("pub.leaflet.content");
			expect(content.pages[0].blocks[0].block.$type).toBe(
				"pub.leaflet.blocks.text",
			);
		});

		it("writes a canonical Offprint document and its native article pointer", async () => {
			mockPrismaService.user.findUnique.mockResolvedValue({
				reviewsPublicationUri:
					"at://did:plc:abc123/site.standard.publication/offprint",
				reviewsMirrorFormat: "offprint",
			});
			mockPutRecord
				.mockResolvedValueOnce({
					data: {
						uri: "at://did:plc:abc123/xyz.opnshelf.review/testtid123",
						cid: "cid-review",
					},
				})
				.mockResolvedValueOnce({
					data: {
						uri: "at://did:plc:abc123/site.standard.document/testtid123",
						cid: "cid-document",
					},
				})
				.mockResolvedValueOnce({ data: { cid: "cid-article" } });
			mockPrismaService.review.create.mockImplementation(
				({ data }: { data: Record<string, unknown> }) => createdRow(data),
			);

			await service.createReview(session.did, session, {
				mediaType: "movie",
				mediaId: "123",
				title: "My take",
				markdown: "**Loved** it.",
			});

			expect(mockPutRecord).toHaveBeenNthCalledWith(
				2,
				expect.objectContaining({
					collection: "site.standard.document",
					rkey: "testtid123",
					record: expect.objectContaining({
						path: "/my-take",
						content: expect.objectContaining({
							$type: "app.offprint.content",
						}),
					}),
				}),
			);
			expect(mockPutRecord).toHaveBeenNthCalledWith(
				3,
				expect.objectContaining({
					collection: "app.offprint.document.article",
					rkey: "testtid123",
					record: {
						$type: "app.offprint.document.article",
						document: {
							$type: "com.atproto.repo.strongRef",
							uri: "at://did:plc:abc123/site.standard.document/testtid123",
							cid: "cid-document",
						},
					},
				}),
			);
		});
	});

	describe("listMyPublications", () => {
		it("maps the user's own publications from listRecords", async () => {
			mockPrismaService.user.findUnique.mockResolvedValue({ handle: "alice" });
			mockListRecords.mockResolvedValue({
				data: {
					records: [
						{
							uri: "at://did:plc:abc123/site.standard.publication/leaflet",
							value: { name: "My Blog", url: "https://leaflet.pub/alice" },
						},
					],
				},
			});

			const result = await service.listMyPublications(session.did, session);

			expect(mockListRecords).toHaveBeenCalledWith(
				expect.objectContaining({
					repo: session.did,
					collection: "site.standard.publication",
				}),
			);
			expect(result).toEqual([
				{
					uri: "at://did:plc:abc123/site.standard.publication/leaflet",
					name: "My Blog",
					url: "https://leaflet.pub/alice",
					service: "leaflet",
				},
			]);
		});

		it("recognises Offprint from its theme before considering its URL", async () => {
			mockListRecords.mockResolvedValue({
				data: {
					records: [
						{
							uri: "at://did:plc:abc123/site.standard.publication/offprint",
							value: {
								name: "My Offprint",
								url: "https://custom.example",
								theme: { $type: "app.offprint.theme" },
							},
						},
					],
				},
			});

			await expect(
				service.listMyPublications(session.did, session),
			).resolves.toEqual([
				{
					uri: "at://did:plc:abc123/site.standard.publication/offprint",
					name: "My Offprint",
					url: "https://custom.example",
					service: "offprint",
				},
			]);
		});
	});

	describe("indexReviewRecord", () => {
		it("upserts a Review from an xyz.opnshelf.review record", async () => {
			mockPrismaService.review.upsert.mockResolvedValue({});
			await service.indexReviewRecord(
				"at://did:plc:u1/xyz.opnshelf.review/x",
				"cid",
				"x",
				"did:plc:u1",
				{
					$type: "xyz.opnshelf.review",
					mediaType: "movie",
					mediaId: "123",
					title: "Review",
					content: "body",
					createdAt: "2024-01-01T00:00:00.000Z",
				} as never,
			);
			expect(mockPrismaService.review.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { rkey: "x" },
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
