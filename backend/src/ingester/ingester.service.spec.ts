import type { Mock } from "vitest";
import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";

vi.mock("../prisma/prisma.service", () => ({
	PrismaService: vi.fn(),
}));

const mockTapChannel = {
	start: vi.fn().mockResolvedValue(undefined),
	destroy: vi.fn().mockResolvedValue(undefined),
};

const mockTapInstance = {
	channel: vi.fn().mockReturnValue(mockTapChannel),
	addRepos: vi.fn().mockResolvedValue(undefined),
	removeRepos: vi.fn().mockResolvedValue(undefined),
	getRepoInfo: vi.fn().mockResolvedValue({
		did: "did:plc:test",
		handle: "test.bsky.social",
		state: "active",
		rev: "3mebdinas5v2j",
		records: 13073,
	}),
};

vi.mock("@atproto/tap", () => ({
	Tap: vi.fn().mockImplementation(() => mockTapInstance),
	SimpleIndexer: vi.fn().mockImplementation(() => ({
		record: vi.fn(),
		identity: vi.fn(),
		error: vi.fn(),
	})),
}));

import type { RecordEvent } from "@atproto/tap";
import { SimpleIndexer, Tap } from "@atproto/tap";
import { Prisma } from "../generated/client";
import { LibraryService } from "../library/library.service";
import { ListsService } from "../lists/lists.service";
import { MoviesService } from "../movies/movies.service";
import { PrismaService } from "../prisma/prisma.service";
import { SocialService } from "../social/social.service";
import { ShowsService } from "../shows/shows.service";
import { NotesService } from "../notes/notes.service";
import { ProfileService } from "../users/profile.service";
import { RatingsService } from "../ratings/ratings.service";
import { ReviewsService } from "../reviews/reviews.service";
import { TmdbNotFoundError, TmdbServiceError } from "../tmdb/tmdb-http";
import { IngesterService } from "./ingester.service";

type MockPrismaService = {
	user: {
		findUnique: Mock;
		findMany: Mock;
	};
	trackedMovie: {
		upsert: Mock;
		deleteMany: Mock;
	};
	trackedEpisode: {
		upsert: Mock;
		deleteMany: Mock;
	};
};

describe("IngesterService", () => {
	let service: IngesterService;
	let mockPrismaService: MockPrismaService;
	let mockMoviesService: {
		getMovieByTMDBId: Mock;
		getMovieDetails: Mock;
		upsertMovie: Mock;
	};
	let mockShowsService: {
		getShowByTMDBId: Mock;
		getShowDetails: Mock;
		upsertShow: Mock;
		syncShowMetadata: Mock;
	};
	let mockListsService: {
		indexListRecord: Mock;
		deleteListRecord: Mock;
		indexListItemRecord: Mock;
		deleteListItemRecord: Mock;
	};
	let mockLibraryService: {
		indexLibraryItemRecord: Mock;
		deleteLibraryItemRecord: Mock;
	};
	let mockSocialService: {
		indexFollowRecord: Mock;
		deleteFollowRecordIndex: Mock;
	};
	let mockNotesService: {
		indexNoteRecord: Mock;
		deleteNoteRecord: Mock;
	};
	let mockProfileService: {
		indexProfileRecord: Mock;
		deleteProfileRecordIndex: Mock;
	};
	let mockReviewsService: {
		indexReviewRecord: Mock;
		deleteReviewRecord: Mock;
		indexPublicationRecord: Mock;
		deletePublicationRecord: Mock;
		indexReviewLikeRecord: Mock;
		deleteReviewLikeRecord: Mock;
	};
	let mockRatingsService: {
		indexRatingRecord: Mock;
		deleteRatingRecord: Mock;
	};

	const mockConfigService = {
		get: vi.fn((key: string) => {
			if (key === "TAB_URL") return "wss://tab.opnshelf.xyz";
			return undefined;
		}),
	};

	beforeEach(async () => {
		vi.clearAllMocks();

		mockPrismaService = {
			user: {
				findUnique: vi.fn(),
				findMany: vi.fn().mockResolvedValue([]),
			},
			trackedMovie: {
				upsert: vi.fn(),
				deleteMany: vi.fn(),
			},
			trackedEpisode: {
				upsert: vi.fn(),
				deleteMany: vi.fn(),
			},
		};

		mockMoviesService = {
			getMovieByTMDBId: vi.fn(),
			getMovieDetails: vi.fn(),
			upsertMovie: vi.fn(),
		};

		mockShowsService = {
			getShowByTMDBId: vi.fn(),
			getShowDetails: vi.fn(),
			upsertShow: vi.fn(),
			syncShowMetadata: vi.fn().mockResolvedValue(undefined),
		};

		mockListsService = {
			indexListRecord: vi.fn(),
			deleteListRecord: vi.fn(),
			indexListItemRecord: vi.fn(),
			deleteListItemRecord: vi.fn(),
		};

		mockLibraryService = {
			indexLibraryItemRecord: vi.fn(),
			deleteLibraryItemRecord: vi.fn(),
		};

		mockSocialService = {
			indexFollowRecord: vi.fn(),
			deleteFollowRecordIndex: vi.fn(),
		};

		mockNotesService = {
			indexNoteRecord: vi.fn(),
			deleteNoteRecord: vi.fn(),
		};

		mockProfileService = {
			indexProfileRecord: vi.fn(),
			deleteProfileRecordIndex: vi.fn(),
		};

		mockReviewsService = {
			indexReviewRecord: vi.fn(),
			deleteReviewRecord: vi.fn(),
			indexPublicationRecord: vi.fn(),
			deletePublicationRecord: vi.fn(),
			indexReviewLikeRecord: vi.fn(),
			deleteReviewLikeRecord: vi.fn(),
		};

		mockRatingsService = {
			indexRatingRecord: vi.fn(),
			deleteRatingRecord: vi.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				IngesterService,
				{ provide: PrismaService, useValue: mockPrismaService },
				{ provide: ConfigService, useValue: mockConfigService },
				{ provide: MoviesService, useValue: mockMoviesService },
				{ provide: ShowsService, useValue: mockShowsService },
				{ provide: ListsService, useValue: mockListsService },
				{ provide: LibraryService, useValue: mockLibraryService },
				{ provide: NotesService, useValue: mockNotesService },
				{ provide: SocialService, useValue: mockSocialService },
				{ provide: ProfileService, useValue: mockProfileService },
				{ provide: ReviewsService, useValue: mockReviewsService },
				{ provide: RatingsService, useValue: mockRatingsService },
			],
		}).compile();

		service = module.get<IngesterService>(IngesterService);
	});

	describe("onModuleInit", () => {
		it("should start the Tab ingester", () => {
			service.onModuleInit();

			expect(Tap).toHaveBeenCalledWith("wss://tab.opnshelf.xyz", {
				adminPassword: undefined,
			});
			expect(SimpleIndexer).toHaveBeenCalled();
			expect(mockTapInstance.channel).toHaveBeenCalled();
			expect(mockTapChannel.start).toHaveBeenCalled();
		});
	});

	describe("addRepo", () => {
		it("should add a repo to Tab", async () => {
			service.onModuleInit();
			await service.addRepo("did:plc:abc123");

			expect(mockTapInstance.addRepos).toHaveBeenCalledWith(["did:plc:abc123"]);
		});
	});

	describe("removeRepo", () => {
		it("should remove a repo from Tab", async () => {
			service.onModuleInit();
			await service.removeRepo("did:plc:abc123");

			expect(mockTapInstance.removeRepos).toHaveBeenCalledWith([
				"did:plc:abc123",
			]);
		});
	});

	describe("record ingestion", () => {
		const setupRecordHandler = (): ((evt: RecordEvent) => Promise<void>) => {
			let recordHandler: ((evt: RecordEvent) => Promise<void>) | undefined;
			(SimpleIndexer as Mock).mockImplementation(() => ({
				record: vi.fn((handler) => {
					recordHandler = handler;
				}),
				identity: vi.fn(),
				error: vi.fn(),
			}));
			service.onModuleInit();
			if (!recordHandler) {
				throw new Error("record handler was not registered");
			}
			return recordHandler;
		};

		it("should index follows for xyz.opnshelf.follow create", async () => {
			const recordHandler = setupRecordHandler();
			mockPrismaService.user.findUnique.mockResolvedValue({
				did: "did:plc:abc123",
			});

			await recordHandler({
				id: 4,
				type: "record",
				action: "create",
				did: "did:plc:abc123",
				rev: "rev-follow-1",
				collection: "xyz.opnshelf.follow",
				rkey: "follow-rkey-1",
				record: {
					$type: "xyz.opnshelf.follow",
					subjectDid: "did:plc:friend-1",
					createdAt: "2026-03-16T10:00:00.000Z",
				},
				cid: "cid-follow-1",
				live: true,
			});

			expect(mockSocialService.indexFollowRecord).toHaveBeenCalledWith(
				"did:plc:abc123",
				"follow-rkey-1",
				"cid-follow-1",
				expect.objectContaining({
					subjectDid: "did:plc:friend-1",
				}),
				"at://did:plc:abc123/xyz.opnshelf.follow/follow-rkey-1",
			);
		});

		it("should delete follows for xyz.opnshelf.follow delete", async () => {
			const recordHandler = setupRecordHandler();

			await recordHandler({
				id: 5,
				type: "record",
				action: "delete",
				did: "did:plc:abc123",
				rev: "rev-follow-2",
				collection: "xyz.opnshelf.follow",
				rkey: "follow-rkey-1",
				cid: "cid-follow-1",
				live: true,
			});

			expect(mockSocialService.deleteFollowRecordIndex).toHaveBeenCalledWith(
				"did:plc:abc123",
				"follow-rkey-1",
			);
		});

		it("logs missing record payloads at debug instead of warn", async () => {
			const recordHandler = setupRecordHandler();
			const debugSpy = vi.spyOn(
				(
					service as unknown as {
						logger: { debug: (...args: unknown[]) => void };
					}
				).logger,
				"debug",
			);
			const warnSpy = vi.spyOn(
				(
					service as unknown as {
						logger: { warn: (...args: unknown[]) => void };
					}
				).logger,
				"warn",
			);

			await recordHandler({
				id: 6,
				type: "record",
				action: "create",
				did: "did:plc:abc123",
				rev: "rev-follow-missing",
				collection: "xyz.opnshelf.follow",
				rkey: "follow-rkey-missing",
				cid: "cid-follow-missing",
				live: true,
			});

			expect(debugSpy).toHaveBeenCalledWith(
				"Record event missing record data: at://did:plc:abc123/xyz.opnshelf.follow/follow-rkey-missing",
			);
			expect(warnSpy).not.toHaveBeenCalledWith(
				"Record event missing record data: at://did:plc:abc123/xyz.opnshelf.follow/follow-rkey-missing",
			);
		});

		it("should upsert tracked movie for xyz.opnshelf.movie create", async () => {
			const recordHandler = setupRecordHandler();
			mockPrismaService.user.findUnique.mockResolvedValue({
				did: "did:plc:abc123",
			});
			mockMoviesService.getMovieByTMDBId.mockResolvedValue({ movieId: "123" });

			await recordHandler({
				id: 1,
				type: "record",
				action: "create",
				did: "did:plc:abc123",
				rev: "rev123",
				collection: "xyz.opnshelf.movie",
				rkey: "movie-123",
				record: {
					$type: "xyz.opnshelf.movie",
					movieId: "123",
					source: "tmdb",
					watchedAt: "2024-01-15T10:00:00Z",
					createdAt: "2024-01-15T10:00:00Z",
				},
				cid: "cid123",
				live: true,
			});

			expect(mockPrismaService.trackedMovie.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					where: {
						userDid_rkey: {
							userDid: "did:plc:abc123",
							rkey: "movie-123",
						},
					},
					create: expect.objectContaining({
						movieId: "123",
						userDid: "did:plc:abc123",
					}),
				}),
			);
		});

		it("should upsert tracked episode for xyz.opnshelf.episode create", async () => {
			const recordHandler = setupRecordHandler();
			mockPrismaService.user.findUnique.mockResolvedValue({
				did: "did:plc:abc123",
			});
			mockShowsService.getShowByTMDBId.mockResolvedValue({ showId: "456" });

			await recordHandler({
				id: 2,
				type: "record",
				action: "create",
				did: "did:plc:abc123",
				rev: "rev124",
				collection: "xyz.opnshelf.episode",
				rkey: "episode-456-1-1",
				record: {
					$type: "xyz.opnshelf.episode",
					showId: "456",
					seasonNumber: 1,
					episodeNumber: 1,
					source: "tmdb",
					watchedAt: "2024-01-15T10:00:00Z",
					createdAt: "2024-01-15T10:00:00Z",
				},
				cid: "cid124",
				live: true,
			});

			expect(mockPrismaService.trackedEpisode.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					where: {
						userDid_rkey: {
							userDid: "did:plc:abc123",
							rkey: "episode-456-1-1",
						},
					},
					create: expect.objectContaining({
						showId: "456",
						seasonNumber: 1,
						episodeNumber: 1,
						userDid: "did:plc:abc123",
					}),
				}),
			);
		});

		it("should delete tracked episode on xyz.opnshelf.episode delete", async () => {
			const recordHandler = setupRecordHandler();

			await recordHandler({
				id: 3,
				type: "record",
				action: "delete",
				did: "did:plc:abc123",
				rev: "rev125",
				collection: "xyz.opnshelf.episode",
				rkey: "episode-456-1-1",
				live: true,
			});

			expect(mockPrismaService.trackedEpisode.deleteMany).toHaveBeenCalledWith({
				where: {
					userDid: "did:plc:abc123",
					rkey: "episode-456-1-1",
				},
			});
		});

		it("should route generic list item records", async () => {
			const recordHandler = setupRecordHandler();
			mockPrismaService.user.findUnique.mockResolvedValue({
				did: "did:plc:abc123",
			});

			await recordHandler({
				id: 4,
				type: "record",
				action: "create",
				did: "did:plc:abc123",
				rev: "rev126",
				collection: "xyz.opnshelf.list.item",
				rkey: "item-1",
				record: {
					$type: "xyz.opnshelf.list.item",
					listRkey: "watchlist",
					mediaType: "show",
					mediaId: "456",
					createdAt: "2024-01-15T10:00:00Z",
				},
				cid: "cid126",
				live: true,
			});

			expect(mockListsService.indexListItemRecord).toHaveBeenCalled();
		});

		it.each([
			{
				collection: "xyz.opnshelf.list.item",
				record: {
					$type: "xyz.opnshelf.list.item",
					listRkey: "watchlist",
					mediaType: "movie",
					mediaId: "123",
					createdAt: "2024-01-15T10:00:00Z",
				},
				indexRecord: () => mockListsService.indexListItemRecord,
			},
			{
				collection: "xyz.opnshelf.library.item",
				record: {
					$type: "xyz.opnshelf.library.item",
					mediaType: "movie",
					mediaId: "123",
					format: "digital",
					createdAt: "2024-01-15T10:00:00Z",
				},
				indexRecord: () => mockLibraryService.indexLibraryItemRecord,
			},
		])(
			"redelivers $collection records when enrichment reports a transient TMDB failure",
			async ({ collection, record, indexRecord }) => {
				const recordHandler = setupRecordHandler();
				mockPrismaService.user.findUnique.mockResolvedValue({
					did: "did:plc:abc123",
				});
				const outage = new TmdbServiceError("TMDB unavailable");
				indexRecord().mockRejectedValue(outage);

				await expect(
					recordHandler({
						id: 22,
						type: "record",
						action: "create",
						did: "did:plc:abc123",
						rev: "rev-tmdb-outage",
						collection,
						rkey: "item-tmdb-outage",
						record,
						cid: "cid-tmdb-outage",
						live: true,
					} as RecordEvent),
				).rejects.toBe(outage);

				expect(indexRecord()).toHaveBeenCalledTimes(3);
			},
			10000,
		);

		it("should index review like for xyz.opnshelf.review.like create", async () => {
			const recordHandler = setupRecordHandler();
			mockPrismaService.user.findUnique.mockResolvedValue({
				did: "did:plc:abc123",
			});

			await recordHandler({
				id: 7,
				type: "record",
				action: "create",
				did: "did:plc:abc123",
				rev: "rev-like-1",
				collection: "xyz.opnshelf.review.like",
				rkey: "like-rkey-1",
				record: {
					$type: "xyz.opnshelf.review.like",
					reviewUri: "at://did:plc:abc123/xyz.opnshelf.review/review-rkey",
					createdAt: "2024-01-15T10:00:00Z",
				},
				cid: "cid-like-1",
				live: true,
			});

			expect(mockReviewsService.indexReviewLikeRecord).toHaveBeenCalledWith(
				"at://did:plc:abc123/xyz.opnshelf.review.like/like-rkey-1",
				"cid-like-1",
				"like-rkey-1",
				"did:plc:abc123",
				expect.objectContaining({
					reviewUri: "at://did:plc:abc123/xyz.opnshelf.review/review-rkey",
				}),
			);
		});

		it("rethrows transient DB errors so Tab does not ack (redelivery)", async () => {
			const recordHandler = setupRecordHandler();
			// A transient Prisma connection error during the user lookup.
			const transient = new Prisma.PrismaClientKnownRequestError(
				"Can't reach database server",
				{ code: "P1001", clientVersion: "test" },
			);
			mockPrismaService.user.findUnique.mockRejectedValue(transient);

			await expect(
				recordHandler({
					id: 9,
					type: "record",
					action: "create",
					did: "did:plc:abc123",
					rev: "rev-transient",
					collection: "xyz.opnshelf.follow",
					rkey: "follow-rkey-transient",
					record: {
						$type: "xyz.opnshelf.follow",
						subjectDid: "did:plc:friend-1",
						createdAt: "2026-03-16T10:00:00.000Z",
					},
					cid: "cid-transient",
					live: true,
				}),
			).rejects.toBe(transient);

			// Retried up to the bounded attempt budget (3) before giving up.
			expect(mockPrismaService.user.findUnique).toHaveBeenCalledTimes(3);
		}, 10000);

		const movieCreateEvent = (id: number, rkey: string): RecordEvent =>
			({
				id,
				type: "record",
				action: "create",
				did: "did:plc:abc123",
				rev: `rev-${rkey}`,
				collection: "xyz.opnshelf.movie",
				rkey,
				record: {
					$type: "xyz.opnshelf.movie",
					movieId: "123",
					source: "tmdb",
					watchedAt: "2024-01-15T10:00:00Z",
					createdAt: "2024-01-15T10:00:00Z",
				},
				cid: `cid-${rkey}`,
				live: true,
			}) as unknown as RecordEvent;

		it("uses the tracked-DID cache fast-path after addRepo (no per-event DB lookup)", async () => {
			const recordHandler = setupRecordHandler();
			// Registering the repo populates the in-memory tracked-DID set.
			await service.addRepo("did:plc:abc123");
			mockMoviesService.getMovieByTMDBId.mockResolvedValue({ movieId: "123" });

			await recordHandler(movieCreateEvent(19, "movie-cache-hit"));

			// Cache hit ⇒ the per-event user.findUnique is skipped entirely.
			expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
			expect(mockPrismaService.trackedMovie.upsert).toHaveBeenCalled();
		});

		it("falls back to the DB on a cache miss and never skips a real user", async () => {
			const recordHandler = setupRecordHandler();
			// No addRepo ⇒ cache miss ⇒ DB is consulted; the user exists.
			mockPrismaService.user.findUnique.mockResolvedValue({
				did: "did:plc:abc123",
			});
			mockMoviesService.getMovieByTMDBId.mockResolvedValue({ movieId: "123" });

			await recordHandler(movieCreateEvent(18, "movie-cache-miss"));

			expect(mockPrismaService.user.findUnique).toHaveBeenCalledTimes(1);
			expect(mockPrismaService.trackedMovie.upsert).toHaveBeenCalled();
		});

		it("redelivers when TMDB is down (5xx/timeout) during movie indexing", async () => {
			const recordHandler = setupRecordHandler();
			mockPrismaService.user.findUnique.mockResolvedValue({
				did: "did:plc:abc123",
			});
			mockMoviesService.getMovieByTMDBId.mockResolvedValue(null);
			// A TMDB outage surfaces as a typed transient error from the http client.
			const outage = new TmdbServiceError("TMDB request failed after retries");
			mockMoviesService.getMovieDetails.mockRejectedValue(outage);

			await expect(
				recordHandler(movieCreateEvent(20, "movie-tmdb-5xx")),
			).rejects.toBe(outage);

			// Retried the full budget, then rethrown so Tab does not ack.
			expect(mockMoviesService.getMovieDetails).toHaveBeenCalledTimes(3);
			expect(mockPrismaService.trackedMovie.upsert).not.toHaveBeenCalled();
		}, 10000);

		it("drops the record on a genuine TMDB not-found (invalid id)", async () => {
			const recordHandler = setupRecordHandler();
			mockPrismaService.user.findUnique.mockResolvedValue({
				did: "did:plc:abc123",
			});
			mockMoviesService.getMovieByTMDBId.mockResolvedValue(null);
			// A 404 surfaces as a typed not-found error — permanent.
			mockMoviesService.getMovieDetails.mockRejectedValue(
				new TmdbNotFoundError("Movie not found", 404),
			);

			await expect(
				recordHandler(movieCreateEvent(21, "movie-tmdb-404")),
			).resolves.toBeUndefined();

			// Not retried — dropped on the first attempt, no DB write.
			expect(mockMoviesService.getMovieDetails).toHaveBeenCalledTimes(1);
			expect(mockPrismaService.trackedMovie.upsert).not.toHaveBeenCalled();
		});

		it("swallows permanent errors so the event is acked and dropped", async () => {
			const recordHandler = setupRecordHandler();
			// A non-transient error (not a recognised infra failure) is permanent.
			mockPrismaService.user.findUnique.mockRejectedValue(
				new Error("programming bug"),
			);

			await expect(
				recordHandler({
					id: 10,
					type: "record",
					action: "create",
					did: "did:plc:abc123",
					rev: "rev-permanent",
					collection: "xyz.opnshelf.follow",
					rkey: "follow-rkey-permanent",
					record: {
						$type: "xyz.opnshelf.follow",
						subjectDid: "did:plc:friend-1",
						createdAt: "2026-03-16T10:00:00.000Z",
					},
					cid: "cid-permanent",
					live: true,
				}),
			).resolves.toBeUndefined();

			// No retries for a permanent failure — dropped on the first attempt.
			expect(mockPrismaService.user.findUnique).toHaveBeenCalledTimes(1);
		});

		it("should delete review like for xyz.opnshelf.review.like delete", async () => {
			const recordHandler = setupRecordHandler();

			await recordHandler({
				id: 8,
				type: "record",
				action: "delete",
				did: "did:plc:abc123",
				rev: "rev-like-2",
				collection: "xyz.opnshelf.review.like",
				rkey: "like-rkey-1",
				cid: "cid-like-1",
				live: true,
			});

			expect(mockReviewsService.deleteReviewLikeRecord).toHaveBeenCalledWith(
				"did:plc:abc123",
				"like-rkey-1",
			);
		});

		it("forwards the repository DID on every owner-scoped collection delete", async () => {
			const recordHandler = setupRecordHandler();
			const deletes: Array<[string, Mock]> = [
				["xyz.opnshelf.list", mockListsService.deleteListRecord],
				["xyz.opnshelf.list.item", mockListsService.deleteListItemRecord],
				[
					"xyz.opnshelf.library.item",
					mockLibraryService.deleteLibraryItemRecord,
				],
				["xyz.opnshelf.note", mockNotesService.deleteNoteRecord],
				["xyz.opnshelf.review", mockReviewsService.deleteReviewRecord],
				[
					"site.standard.publication",
					mockReviewsService.deletePublicationRecord,
				],
				["xyz.opnshelf.rating", mockRatingsService.deleteRatingRecord],
				["xyz.opnshelf.review.like", mockReviewsService.deleteReviewLikeRecord],
			];

			for (const [index, [collection, deleteRecord]] of deletes.entries()) {
				await recordHandler({
					id: 100 + index,
					type: "record",
					action: "delete",
					did: "did:plc:owner-b",
					rev: `rev-${index}`,
					collection,
					rkey: "shared-rkey",
					live: true,
				} as RecordEvent);

				expect(deleteRecord).toHaveBeenLastCalledWith(
					"did:plc:owner-b",
					"shared-rkey",
				);
			}
		});
	});
});
