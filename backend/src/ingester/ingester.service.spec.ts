import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";

jest.mock("../prisma/prisma.service", () => ({
	PrismaService: jest.fn(),
}));

const mockTapChannel = {
	start: jest.fn().mockResolvedValue(undefined),
	destroy: jest.fn().mockResolvedValue(undefined),
};

const mockTapInstance = {
	channel: jest.fn().mockReturnValue(mockTapChannel),
	addRepos: jest.fn().mockResolvedValue(undefined),
	removeRepos: jest.fn().mockResolvedValue(undefined),
	getRepoInfo: jest.fn().mockResolvedValue({
		did: "did:plc:test",
		handle: "test.bsky.social",
		state: "active",
		rev: "3mebdinas5v2j",
		records: 13073,
	}),
};

jest.mock("@atproto/tap", () => ({
	Tap: jest.fn().mockImplementation(() => mockTapInstance),
	SimpleIndexer: jest.fn().mockImplementation(() => ({
		record: jest.fn(),
		identity: jest.fn(),
		error: jest.fn(),
	})),
}));

import type { RecordEvent } from "@atproto/tap";
import { SimpleIndexer, Tap } from "@atproto/tap";
import { ListsService } from "../lists/lists.service";
import { MoviesService } from "../movies/movies.service";
import { PrismaService } from "../prisma/prisma.service";
import { SocialService } from "../social/social.service";
import { ShowsService } from "../shows/shows.service";
import { ProfileService } from "../users/profile.service";
import { IngesterService } from "./ingester.service";

type MockPrismaService = {
	user: {
		findUnique: jest.Mock;
		findMany: jest.Mock;
	};
	trackedMovie: {
		upsert: jest.Mock;
		deleteMany: jest.Mock;
	};
	trackedEpisode: {
		upsert: jest.Mock;
		deleteMany: jest.Mock;
	};
};

describe("IngesterService", () => {
	let service: IngesterService;
	let mockPrismaService: MockPrismaService;
	let mockMoviesService: {
		getMovieByTMDBId: jest.Mock;
		getMovieDetails: jest.Mock;
		upsertMovie: jest.Mock;
	};
	let mockShowsService: {
		getShowByTMDBId: jest.Mock;
		getShowDetails: jest.Mock;
		upsertShow: jest.Mock;
		syncShowMetadata: jest.Mock;
	};
	let mockListsService: {
		indexListRecord: jest.Mock;
		deleteListRecord: jest.Mock;
		indexListItemRecord: jest.Mock;
		deleteListItemRecord: jest.Mock;
	};
	let mockSocialService: {
		indexFollowRecord: jest.Mock;
		deleteFollowRecordIndex: jest.Mock;
	};
	let mockProfileService: {
		indexProfileRecord: jest.Mock;
		deleteProfileRecordIndex: jest.Mock;
	};

	const mockConfigService = {
		get: jest.fn((key: string) => {
			if (key === "TAP_URL") return "wss://tap.opnshelf.xyz";
			return undefined;
		}),
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		mockPrismaService = {
			user: {
				findUnique: jest.fn(),
				findMany: jest.fn().mockResolvedValue([]),
			},
			trackedMovie: {
				upsert: jest.fn(),
				deleteMany: jest.fn(),
			},
			trackedEpisode: {
				upsert: jest.fn(),
				deleteMany: jest.fn(),
			},
		};

		mockMoviesService = {
			getMovieByTMDBId: jest.fn(),
			getMovieDetails: jest.fn(),
			upsertMovie: jest.fn(),
		};

		mockShowsService = {
			getShowByTMDBId: jest.fn(),
			getShowDetails: jest.fn(),
			upsertShow: jest.fn(),
			syncShowMetadata: jest.fn().mockResolvedValue(undefined),
		};

		mockListsService = {
			indexListRecord: jest.fn(),
			deleteListRecord: jest.fn(),
			indexListItemRecord: jest.fn(),
			deleteListItemRecord: jest.fn(),
		};

		mockSocialService = {
			indexFollowRecord: jest.fn(),
			deleteFollowRecordIndex: jest.fn(),
		};

		mockProfileService = {
			indexProfileRecord: jest.fn(),
			deleteProfileRecordIndex: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				IngesterService,
				{ provide: PrismaService, useValue: mockPrismaService },
				{ provide: ConfigService, useValue: mockConfigService },
				{ provide: MoviesService, useValue: mockMoviesService },
				{ provide: ShowsService, useValue: mockShowsService },
				{ provide: ListsService, useValue: mockListsService },
				{ provide: SocialService, useValue: mockSocialService },
				{ provide: ProfileService, useValue: mockProfileService },
			],
		}).compile();

		service = module.get<IngesterService>(IngesterService);
	});

	describe("onModuleInit", () => {
		it("should start the TAP ingester", () => {
			service.onModuleInit();

			expect(Tap).toHaveBeenCalledWith("wss://tap.opnshelf.xyz", {
				adminPassword: undefined,
			});
			expect(SimpleIndexer).toHaveBeenCalled();
			expect(mockTapInstance.channel).toHaveBeenCalled();
			expect(mockTapChannel.start).toHaveBeenCalled();
		});
	});

	describe("addRepo", () => {
		it("should add a repo to TAP", async () => {
			service.onModuleInit();
			await service.addRepo("did:plc:abc123");

			expect(mockTapInstance.addRepos).toHaveBeenCalledWith(["did:plc:abc123"]);
		});
	});

	describe("removeRepo", () => {
		it("should remove a repo from TAP", async () => {
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
			(SimpleIndexer as jest.Mock).mockImplementation(() => ({
				record: jest.fn((handler) => {
					recordHandler = handler;
				}),
				identity: jest.fn(),
				error: jest.fn(),
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
			const debugSpy = jest.spyOn(
				(
					service as unknown as {
						logger: { debug: (...args: unknown[]) => void };
					}
				).logger,
				"debug",
			);
			const warnSpy = jest.spyOn(
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
					where: { rkey: "movie-123" },
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
					where: { rkey: "episode-456-1-1" },
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
				where: { rkey: "episode-456-1-1" },
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
				collection: "xyz.opnshelf.listItem",
				rkey: "item-1",
				record: {
					$type: "xyz.opnshelf.listItem",
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
	});
});
