import { Test, type TestingModule } from "@nestjs/testing";

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

vi.mock("../lexicons/xyz/opnshelf/rating", () => ({
	main: {
		build: vi.fn((data: Record<string, unknown>) => ({
			$type: "xyz.opnshelf.rating",
			...data,
		})),
		parse: vi.fn((data: Record<string, unknown>) => data),
	},
	$nsid: "xyz.opnshelf.rating",
}));

import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RatingsService, type ATSession } from "./ratings.service";

describe("RatingsService", () => {
	let service: RatingsService;

	const mockPrismaService = {
		rating: {
			findUnique: vi.fn(),
			findFirst: vi.fn(),
			aggregate: vi.fn(),
			count: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
			deleteMany: vi.fn(),
			upsert: vi.fn(),
		},
	};

	const session: ATSession = { did: "did:plc:abc123" };

	beforeEach(async () => {
		vi.clearAllMocks();
		mockPutRecord.mockReset();
		mockDeleteRecord.mockReset();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				RatingsService,
				{ provide: PrismaService, useValue: mockPrismaService },
			],
		}).compile();

		service = module.get<RatingsService>(RatingsService);
	});

	describe("setRating - create path", () => {
		it("writes a new rating record to the PDS and persists it to the DB", async () => {
			// no existing rating -> create path
			mockPrismaService.rating.findUnique.mockResolvedValue(null);
			mockPutRecord.mockResolvedValue({
				data: {
					uri: "at://did:plc:abc123/xyz.opnshelf.rating/testtid123",
					cid: "cid-new",
				},
			});
			mockPrismaService.rating.create.mockImplementation(
				({ data }: { data: Record<string, unknown> }) => ({
					id: "rating-1",
					...data,
				}),
			);

			const result = await service.setRating(session.did, session, {
				mediaType: "movie",
				mediaId: "123",
				rating: 8,
			});

			// minted at a fresh TID rkey, written under the rating collection
			expect(mockPutRecord).toHaveBeenCalledWith(
				expect.objectContaining({
					repo: session.did,
					collection: "xyz.opnshelf.rating",
					rkey: "testtid123",
					record: expect.objectContaining({
						mediaType: "movie",
						mediaId: "123",
						rating: 8,
						createdAt: expect.any(String),
					}),
				}),
			);
			// DB row carries the PDS uri/cid and zero-filled coords
			expect(mockPrismaService.rating.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						rkey: "testtid123",
						uri: "at://did:plc:abc123/xyz.opnshelf.rating/testtid123",
						cid: "cid-new",
						userDid: session.did,
						mediaType: "movie",
						mediaId: "123",
						seasonNumber: 0,
						episodeNumber: 0,
						rating: 8,
					}),
				}),
			);
			expect(result.rating).toBe(8);
		});

		it("zero-fills season/episode coordinates on the persisted row when omitted", async () => {
			mockPrismaService.rating.findUnique.mockResolvedValue(null);
			mockPutRecord.mockResolvedValue({
				data: { uri: "at://uri", cid: "cid" },
			});
			mockPrismaService.rating.create.mockImplementation(
				({ data }: { data: Record<string, unknown> }) => data,
			);

			await service.setRating(session.did, session, {
				mediaType: "show",
				mediaId: "555",
				rating: 5,
			});

			expect(mockPrismaService.rating.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						seasonNumber: 0,
						episodeNumber: 0,
					}),
				}),
			);
		});
	});

	describe("setRating - upsert / one-rating-per-user constraint", () => {
		it("looks up the existing rating by the composite unique key", async () => {
			mockPrismaService.rating.findUnique.mockResolvedValue(null);
			mockPutRecord.mockResolvedValue({
				data: { uri: "at://uri", cid: "cid" },
			});
			mockPrismaService.rating.create.mockImplementation(
				({ data }: { data: Record<string, unknown> }) => data,
			);

			await service.setRating(session.did, session, {
				mediaType: "episode",
				mediaId: "999",
				seasonNumber: 2,
				episodeNumber: 4,
				rating: 7,
			});

			// the unique key is (userDid, mediaType, mediaId, seasonNumber, episodeNumber)
			expect(mockPrismaService.rating.findUnique).toHaveBeenCalledWith({
				where: {
					userDid_mediaType_mediaId_seasonNumber_episodeNumber: {
						userDid: session.did,
						mediaType: "episode",
						mediaId: "999",
						seasonNumber: 2,
						episodeNumber: 4,
					},
				},
			});
		});

		it("re-rating the same media UPDATES the existing record (no duplicate create)", async () => {
			const existing = {
				id: "rating-1",
				rkey: "existing-rkey",
				createdAt: new Date("2024-01-01T00:00:00.000Z"),
				rating: 4,
			};
			mockPrismaService.rating.findUnique.mockResolvedValue(existing);
			mockPutRecord.mockResolvedValue({
				data: {
					uri: "at://did:plc:abc123/xyz.opnshelf.rating/existing-rkey",
					cid: "cid-updated",
				},
			});
			mockPrismaService.rating.update.mockImplementation(
				({ data }: { data: Record<string, unknown> }) => ({
					id: existing.id,
					rkey: existing.rkey,
					...data,
				}),
			);

			const result = await service.setRating(session.did, session, {
				mediaType: "movie",
				mediaId: "123",
				rating: 9,
			});

			// PDS putRecord reuses the EXISTING rkey (does not mint a new TID)
			expect(mockPutRecord).toHaveBeenCalledWith(
				expect.objectContaining({
					rkey: "existing-rkey",
					collection: "xyz.opnshelf.rating",
					record: expect.objectContaining({
						rating: 9,
						// createdAt preserved from the existing record
						createdAt: "2024-01-01T00:00:00.000Z",
					}),
				}),
			);
			// updates by primary id, never creates a duplicate
			expect(mockPrismaService.rating.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: "rating-1" },
					data: expect.objectContaining({ rating: 9, cid: "cid-updated" }),
				}),
			);
			expect(mockPrismaService.rating.create).not.toHaveBeenCalled();
			expect(result.rating).toBe(9);
		});
	});

	describe("getMediaRating", () => {
		it("aggregates average + count scoped to season/episode 0 by default", async () => {
			mockPrismaService.rating.aggregate.mockResolvedValue({
				_avg: { rating: 7.5 },
			});
			mockPrismaService.rating.count.mockResolvedValue(4);

			const result = await service.getMediaRating({
				mediaType: "movie",
				mediaId: "123",
			});

			const expectedWhere = {
				mediaType: "movie",
				mediaId: "123",
				seasonNumber: 0,
				episodeNumber: 0,
			};
			expect(mockPrismaService.rating.aggregate).toHaveBeenCalledWith({
				where: expectedWhere,
				_avg: { rating: true },
			});
			expect(mockPrismaService.rating.count).toHaveBeenCalledWith({
				where: expectedWhere,
			});
			expect(result).toEqual({ averageRating: 7.5, ratingCount: 4 });
		});

		it("respects explicit season/episode coordinates", async () => {
			mockPrismaService.rating.aggregate.mockResolvedValue({
				_avg: { rating: 6 },
			});
			mockPrismaService.rating.count.mockResolvedValue(2);

			await service.getMediaRating({
				mediaType: "episode",
				mediaId: "777",
				seasonNumber: 3,
				episodeNumber: 5,
			});

			expect(mockPrismaService.rating.aggregate).toHaveBeenCalledWith({
				where: {
					mediaType: "episode",
					mediaId: "777",
					seasonNumber: 3,
					episodeNumber: 5,
				},
				_avg: { rating: true },
			});
		});

		it("returns undefined average when there are no ratings", async () => {
			mockPrismaService.rating.aggregate.mockResolvedValue({
				_avg: { rating: null },
			});
			mockPrismaService.rating.count.mockResolvedValue(0);

			const result = await service.getMediaRating({
				mediaType: "movie",
				mediaId: "404",
			});

			expect(result).toEqual({ averageRating: undefined, ratingCount: 0 });
		});
	});

	describe("getBatchRatings", () => {
		it("aggregates per mediaId and returns an items array", async () => {
			mockPrismaService.rating.aggregate
				.mockResolvedValueOnce({ _avg: { rating: 8 } })
				.mockResolvedValueOnce({ _avg: { rating: null } });
			mockPrismaService.rating.count
				.mockResolvedValueOnce(3)
				.mockResolvedValueOnce(0);

			const result = await service.getBatchRatings({
				mediaType: "movie",
				mediaIds: ["1", "2"],
			});

			expect(result).toEqual({
				items: [
					{ mediaId: "1", averageRating: 8, ratingCount: 3 },
					{ mediaId: "2", averageRating: undefined, ratingCount: 0 },
				],
			});
		});

		it("scopes batch aggregation to season/episode 0, matching getMediaRating", async () => {
			mockPrismaService.rating.aggregate.mockResolvedValue({
				_avg: { rating: 7 },
			});
			mockPrismaService.rating.count.mockResolvedValue(5);

			await service.getBatchRatings({
				mediaType: "show",
				mediaIds: ["123"],
			});

			// Regression guard: batch must use the same top-level (0/0) scope as the
			// single-item endpoint, so a show's batch average doesn't pool in every
			// per-episode rating that shares the mediaId.
			const expectedWhere = {
				mediaType: "show",
				mediaId: "123",
				seasonNumber: 0,
				episodeNumber: 0,
			};
			expect(mockPrismaService.rating.aggregate).toHaveBeenCalledWith({
				where: expectedWhere,
				_avg: { rating: true },
			});
			expect(mockPrismaService.rating.count).toHaveBeenCalledWith({
				where: expectedWhere,
			});
		});
	});

	describe("clearRating - authorization + PDS delete", () => {
		it("deletes the PDS record and the DB row for the owner", async () => {
			mockPrismaService.rating.findFirst.mockResolvedValue({
				id: "rating-1",
				rkey: "rkey-del",
				userDid: session.did,
			});
			mockPrismaService.rating.delete.mockResolvedValue({});

			await service.clearRating(session.did, session, "rating-1");

			// ownership enforced via the findFirst where-clause (id + userDid)
			expect(mockPrismaService.rating.findFirst).toHaveBeenCalledWith({
				where: { id: "rating-1", userDid: session.did },
			});
			expect(mockDeleteRecord).toHaveBeenCalledWith(
				expect.objectContaining({
					repo: session.did,
					collection: "xyz.opnshelf.rating",
					rkey: "rkey-del",
				}),
			);
			expect(mockPrismaService.rating.delete).toHaveBeenCalledWith({
				where: { id: "rating-1" },
			});
		});

		it("throws NotFoundException and skips the PDS delete when a non-owner tries to clear", async () => {
			// findFirst is scoped to (id, userDid); a non-owner's lookup returns null
			mockPrismaService.rating.findFirst.mockResolvedValue(null);

			await expect(
				service.clearRating("did:plc:intruder", session, "rating-1"),
			).rejects.toThrow(NotFoundException);

			expect(mockPrismaService.rating.findFirst).toHaveBeenCalledWith({
				where: { id: "rating-1", userDid: "did:plc:intruder" },
			});
			expect(mockDeleteRecord).not.toHaveBeenCalled();
			expect(mockPrismaService.rating.delete).not.toHaveBeenCalled();
		});
	});
});
