import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";

vi.mock("../prisma/prisma.service", () => ({
	PrismaService: vi.fn(),
}));

const mockPutRecord = vi.fn();
const mockDeleteRecord = vi.fn();
const mockApplyWrites = vi.fn();
vi.mock("@atproto/api", () => ({
	Agent: vi.fn().mockImplementation(() => ({
		com: {
			atproto: {
				repo: {
					putRecord: mockPutRecord,
					deleteRecord: mockDeleteRecord,
					applyWrites: mockApplyWrites,
				},
			},
		},
	})),
}));

vi.mock("../lexicons/xyz/opnshelf/episode", () => ({
	main: {
		build: vi.fn((data: Record<string, unknown>) => ({
			$type: "xyz.opnshelf.episode",
			...data,
		})),
	},
	$nsid: "xyz.opnshelf.episode",
}));

import { ColorExtractionService } from "../movies/color-extraction.service";
import { PrismaService } from "../prisma/prisma.service";
import { EpisodeWatchService } from "./episode-watch.service";
import { ShowCatalogueService } from "./show-catalogue.service";
import { ShowsTmdbService } from "./shows-tmdb.service";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("EpisodeWatchService", () => {
	let service: EpisodeWatchService;

	const mockPrismaService = {
		trackedEpisode: {
			findMany: vi.fn(),
			findFirst: vi.fn(),
			upsert: vi.fn(),
			create: vi.fn(),
			createMany: vi.fn(),
			delete: vi.fn(),
			deleteMany: vi.fn(),
		},
		show: {
			findUnique: vi.fn(),
			upsert: vi.fn(),
			update: vi.fn(),
		},
		season: {
			findMany: vi.fn(),
			upsert: vi.fn(),
		},
		episode: {
			findMany: vi.fn(),
			upsert: vi.fn(),
		},
	};

	const mockConfigService = {
		get: vi.fn((key: string) => {
			if (key === "TMDB_API_KEY") return "test-api-key";
			return undefined;
		}),
	};

	const mockColorExtractionService = {
		extractColorsFromPoster: vi.fn(),
	};

	beforeEach(async () => {
		vi.clearAllMocks();
		mockPutRecord.mockReset();
		mockDeleteRecord.mockReset();
		mockApplyWrites.mockReset();
		mockFetch.mockReset();
		mockPrismaService.trackedEpisode.findMany.mockResolvedValue([]);
		mockPrismaService.season.findMany.mockResolvedValue([]);
		mockPrismaService.episode.findMany.mockResolvedValue([]);

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				EpisodeWatchService,
				ShowCatalogueService,
				ShowsTmdbService,
				{ provide: PrismaService, useValue: mockPrismaService },
				{ provide: ConfigService, useValue: mockConfigService },
				{
					provide: ColorExtractionService,
					useValue: mockColorExtractionService,
				},
			],
		}).compile();

		service = module.get<EpisodeWatchService>(EpisodeWatchService);
	});

	describe("markEpisodeWatched", () => {
		it("should create episode AT Protocol record", async () => {
			const mockSession = { did: "did:plc:abc123" };
			mockPutRecord.mockResolvedValue({
				data: {
					uri: "at://did:plc:abc123/xyz.opnshelf.episode/abc",
					cid: "cid123",
				},
			});

			const result = await service.markEpisodeWatched(
				"did:plc:abc123",
				mockSession,
				"123",
				1,
				2,
			);

			expect(mockPutRecord).toHaveBeenCalledWith(
				expect.objectContaining({
					collection: "xyz.opnshelf.episode",
					record: expect.objectContaining({
						$type: "xyz.opnshelf.episode",
						showId: "123",
						seasonNumber: 1,
						episodeNumber: 2,
					}),
				}),
			);
			expect(result.rkey).toBeDefined();
		});

		it("omits watchedAt when an undated Watch is requested", async () => {
			mockPutRecord.mockResolvedValue({
				data: {
					uri: "at://did:plc:abc123/xyz.opnshelf.episode/rkey",
					cid: "cid",
				},
			});

			const result = await service.markEpisodeWatched(
				"did:plc:abc123",
				{ did: "did:plc:abc123" },
				"123",
				1,
				2,
				null,
			);

			expect(result.record).not.toHaveProperty("watchedAt");
			expect(mockPutRecord.mock.calls[0][0].record).not.toHaveProperty(
				"watchedAt",
			);
		});
	});

	describe("markSeasonWatched (bulk)", () => {
		const mockSession = { did: "did:plc:abc123" };

		// Every TMDB fetch resolves to one generic body that satisfies
		// getSeasonDetails (.episodes), getShowDetails (.id/.name) and
		// syncShowMetadata (.seasons === []), so we don't sequence fetches.
		const stubTmdb = (episodeCount: number) => {
			const episodes = Array.from({ length: episodeCount }, (_, i) => ({
				episode_number: i + 1,
				season_number: 1,
				air_date: "2020-01-01",
			}));
			mockFetch.mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						id: 123,
						name: "Test Show",
						episodes,
						seasons: [],
						results: [],
					}),
			});
			mockPrismaService.show.upsert.mockResolvedValue({ showId: "123" });
			mockColorExtractionService.extractColorsFromPoster.mockResolvedValue(
				null,
			);
			mockPrismaService.trackedEpisode.createMany.mockResolvedValue({
				count: episodeCount,
			});
		};

		const okApplyWrites = () =>
			mockApplyWrites.mockResolvedValue({
				data: { results: [], commit: { cid: "c" } },
				headers: {},
			});

		it("batches episodes into applyWrites calls of 200 and reports the full count", async () => {
			stubTmdb(250);
			okApplyWrites();

			const result = await service.markSeasonWatched(
				"did:plc:abc123",
				mockSession,
				"123",
				1,
			);

			// 250 episodes => two batches (200 + 50), not 250 putRecord calls.
			expect(mockApplyWrites).toHaveBeenCalledTimes(2);
			expect(mockApplyWrites.mock.calls[0][0].writes).toHaveLength(200);
			expect(mockApplyWrites.mock.calls[1][0].writes).toHaveLength(50);
			expect(mockPutRecord).not.toHaveBeenCalled();
			// One bulk insert of every written episode.
			expect(mockPrismaService.trackedEpisode.createMany).toHaveBeenCalledTimes(
				1,
			);
			expect(
				mockPrismaService.trackedEpisode.createMany.mock.calls[0][0].data,
			).toHaveLength(250);
			expect(result).toEqual({ count: 250, requested: 250 });
		});

		it("stops at the failing batch and reports a partial count", async () => {
			stubTmdb(250);
			mockApplyWrites
				.mockResolvedValueOnce({
					data: { results: [], commit: { cid: "c" } },
					headers: {},
				})
				.mockRejectedValueOnce({ status: 429 });

			const result = await service.markSeasonWatched(
				"did:plc:abc123",
				mockSession,
				"123",
				1,
			);

			expect(mockApplyWrites).toHaveBeenCalledTimes(2);
			// Only the first batch's 200 episodes were indexed.
			expect(
				mockPrismaService.trackedEpisode.createMany.mock.calls[0][0].data,
			).toHaveLength(200);
			expect(result).toEqual({ count: 200, requested: 250 });
		});

		it("writes and indexes an undated season", async () => {
			stubTmdb(2);
			okApplyWrites();

			await service.markSeasonWatched(
				"did:plc:abc123",
				mockSession,
				"123",
				1,
				null,
			);

			for (const write of mockApplyWrites.mock.calls[0][0].writes) {
				expect(write.value).not.toHaveProperty("watchedAt");
			}
			expect(mockPrismaService.trackedEpisode.createMany).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.arrayContaining([
						expect.objectContaining({ watchedDate: null }),
					]),
				}),
			);
		});
	});

	describe("markShowWatched (bulk)", () => {
		it("writes and indexes an undated show", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						id: 123,
						name: "Test Show",
						number_of_seasons: 1,
						seasons: [],
						episodes: [
							{
								episode_number: 1,
								season_number: 1,
								air_date: "2020-01-01",
							},
						],
						results: [],
					}),
			});
			mockApplyWrites.mockResolvedValue({ data: { results: [] }, headers: {} });
			mockPrismaService.show.upsert.mockResolvedValue({ showId: "123" });
			mockPrismaService.trackedEpisode.createMany.mockResolvedValue({
				count: 1,
			});

			await service.markShowWatched(
				"did:plc:abc123",
				{ did: "did:plc:abc123" },
				"123",
				null,
			);

			expect(
				mockApplyWrites.mock.calls[0][0].writes[0].value,
			).not.toHaveProperty("watchedAt");
			expect(mockPrismaService.trackedEpisode.createMany).toHaveBeenCalledWith(
				expect.objectContaining({
					data: [expect.objectContaining({ watchedDate: null })],
				}),
			);
		});
	});

	describe("unmarkEpisodeWatched", () => {
		it("should delete latest episode record in latest mode", async () => {
			const mockSession = { did: "did:plc:abc123" };
			mockPrismaService.trackedEpisode.findFirst.mockResolvedValue({
				id: "1",
				rkey: "rk1",
			});

			await service.unmarkEpisodeWatched(
				"did:plc:abc123",
				mockSession,
				"123",
				"latest",
			);

			expect(mockDeleteRecord).toHaveBeenCalledWith({
				repo: "did:plc:abc123",
				collection: "xyz.opnshelf.episode",
				rkey: "rk1",
			});
			expect(mockPrismaService.trackedEpisode.deleteMany).toHaveBeenCalledWith({
				where: { userDid: "did:plc:abc123", rkey: "rk1" },
			});
		});

		it("should delete all episode records in all mode", async () => {
			const mockSession = { did: "did:plc:abc123" };
			mockPrismaService.trackedEpisode.findMany.mockResolvedValue([
				{ id: "1", rkey: "rk1" },
				{ id: "2", rkey: "rk2" },
			]);

			const result = await service.unmarkEpisodeWatched(
				"did:plc:abc123",
				mockSession,
				"123",
				"all",
			);

			expect(mockDeleteRecord).toHaveBeenCalledTimes(2);
			expect(mockPrismaService.trackedEpisode.deleteMany).toHaveBeenCalledTimes(
				2,
			);
			expect(result).toEqual({ showId: "123", mode: "all", deletedCount: 2 });
		});

		it("attempts the full batch but preserves rows for transient failures", async () => {
			const transient = new Error("network unavailable");
			mockPrismaService.trackedEpisode.findMany.mockResolvedValue([
				{ id: "1", rkey: "success" },
				{ id: "2", rkey: "missing" },
				{ id: "3", rkey: "transient" },
			]);
			mockDeleteRecord
				.mockResolvedValueOnce({})
				.mockRejectedValueOnce({ error: "RecordNotFound" })
				.mockRejectedValueOnce(transient);

			await expect(
				service.unmarkEpisodeWatched(
					"did:plc:abc123",
					{ did: "did:plc:abc123" },
					"123",
					"all",
				),
			).rejects.toBe(transient);

			expect(mockDeleteRecord).toHaveBeenCalledTimes(3);
			expect(mockPrismaService.trackedEpisode.deleteMany.mock.calls).toEqual([
				[{ where: { userDid: "did:plc:abc123", rkey: "success" } }],
				[{ where: { userDid: "did:plc:abc123", rkey: "missing" } }],
			]);
		});

		it("preserves the latest local row when the PDS delete fails", async () => {
			mockPrismaService.trackedEpisode.findFirst.mockResolvedValue({
				id: "1",
				rkey: "rk1",
			});
			mockDeleteRecord.mockRejectedValue(new Error("network unavailable"));

			await expect(
				service.unmarkEpisodeWatched(
					"did:plc:abc123",
					{ did: "did:plc:abc123" },
					"123",
					"latest",
				),
			).rejects.toThrow("network unavailable");
			expect(
				mockPrismaService.trackedEpisode.deleteMany,
			).not.toHaveBeenCalled();
		});
	});
});
