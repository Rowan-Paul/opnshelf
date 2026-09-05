import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";

vi.mock("../prisma/prisma.service", () => ({
	PrismaService: vi.fn(),
}));

vi.mock("./episode-watch-record", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("./episode-watch-record")>();
	return { ...actual, buildEpisodeWatchRecord: vi.fn() };
});

import { ColorExtractionService } from "../movies/color-extraction.service";
import { PrismaService } from "../prisma/prisma.service";
import { buildEpisodeWatchRecord } from "./episode-watch-record";
import { EpisodeWatchService } from "./episode-watch.service";
import { ShowCatalogueService } from "./show-catalogue.service";
import { ShowProgressService } from "./show-progress.service";
import { ShowsService } from "./shows.service";
import { ShowsTmdbService } from "./shows-tmdb.service";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ShowsService", () => {
	let service: ShowsService;
	let showsTmdb: ShowsTmdbService;
	let catalogue: ShowCatalogueService;
	let progress: ShowProgressService;
	let watches: EpisodeWatchService;

	const mockPrismaService = {};

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
		mockFetch.mockReset();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ShowsService,
				ShowsTmdbService,
				ShowCatalogueService,
				ShowProgressService,
				EpisodeWatchService,
				{ provide: PrismaService, useValue: mockPrismaService },
				{ provide: ConfigService, useValue: mockConfigService },
				{
					provide: ColorExtractionService,
					useValue: mockColorExtractionService,
				},
			],
		}).compile();

		service = module.get<ShowsService>(ShowsService);
		showsTmdb = module.get<ShowsTmdbService>(ShowsTmdbService);
		catalogue = module.get<ShowCatalogueService>(ShowCatalogueService);
		progress = module.get<ShowProgressService>(ShowProgressService);
		watches = module.get<EpisodeWatchService>(EpisodeWatchService);
	});

	describe("searchShows", () => {
		it("should search shows from TMDB", async () => {
			const mockResponse = {
				results: [{ id: 1, name: "Test Show", first_air_date: "2024-01-01" }],
				total_pages: 1,
				total_results: 1,
			};
			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			});

			const result = await service.searchShows("test");

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining(
					"search/tv?api_key=test-api-key&query=test&page=1",
				),
				expect.anything(),
			);
			expect(result).toEqual(mockResponse);
		});
	});

	describe("getShowDetails", () => {
		it("should get show details from TMDB with ranked trailer", async () => {
			const mockShow = {
				id: 123,
				name: "Test Show",
				overview: "A test show",
				first_air_date: "2024-01-01",
			};
			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockShow),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () =>
						Promise.resolve({
							results: [
								{
									id: "clip-1",
									key: "clip-key",
									name: "Clip",
									site: "YouTube",
									type: "Clip",
								},
								{
									id: "trailer-1",
									key: "show-trailer",
									name: "Main Trailer",
									site: "YouTube",
									type: "Trailer",
									official: false,
								},
							],
						}),
				});

			const result = await service.getShowDetails("123");

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("/tv/123?api_key=test-api-key"),
				expect.anything(),
			);
			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("/tv/123/videos?api_key=test-api-key"),
				expect.anything(),
			);
			expect(result).toEqual({
				...mockShow,
				trailer: {
					id: "trailer-1",
					key: "show-trailer",
					name: "Main Trailer",
					site: "YouTube",
					type: "Trailer",
					official: false,
					published_at: undefined,
					sourceMediaType: "show",
				},
			});
		});

		it("should get season details with trailer", async () => {
			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: () =>
						Promise.resolve({
							id: 10,
							name: "Season 1",
							season_number: 1,
							episodes: [],
						}),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () =>
						Promise.resolve({
							results: [
								{
									id: "season-trailer",
									key: "season-key",
									name: "Season Trailer",
									site: "YouTube",
									type: "Trailer",
									official: true,
								},
							],
						}),
				});

			const result = await service.getSeasonDetails("123", 1);

			expect(result.trailer?.key).toBe("season-key");
			expect(result.trailer?.sourceMediaType).toBe("season");
		});

		it("should get episode details with trailer", async () => {
			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: () =>
						Promise.resolve({
							id: 25,
							name: "Episode 2",
							episode_number: 2,
							season_number: 1,
						}),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () =>
						Promise.resolve({
							results: [
								{
									id: "episode-teaser",
									key: "episode-key",
									name: "Episode Teaser",
									site: "YouTube",
									type: "Teaser",
									official: true,
								},
							],
						}),
				});

			const result = await service.getEpisodeDetails("123", 1, 2);

			expect(result.trailer?.key).toBe("episode-key");
			expect(result.trailer?.sourceMediaType).toBe("episode");
		});
	});

	describe("delegation", () => {
		const session = { did: "did:plc:abc123" };
		const sentinel = { delegated: true };

		it("forwards TMDB reads to ShowsTmdbService", async () => {
			const spies = {
				discoverShows: vi.spyOn(showsTmdb, "discoverShows"),
				getRecommendations: vi.spyOn(showsTmdb, "getRecommendations"),
				getShowCredits: vi.spyOn(showsTmdb, "getShowCredits"),
				getFullShowCredits: vi.spyOn(showsTmdb, "getFullShowCredits"),
				getWatchProviders: vi.spyOn(showsTmdb, "getWatchProviders"),
			};
			for (const spy of Object.values(spies)) {
				spy.mockResolvedValue(sentinel as never);
			}

			await expect(
				service.discoverShows("vote_average.desc", 2, 2020),
			).resolves.toBe(sentinel);
			expect(spies.discoverShows).toHaveBeenCalledWith(
				"vote_average.desc",
				2,
				2020,
			);
			await service.getRecommendations("123", 3);
			expect(spies.getRecommendations).toHaveBeenCalledWith("123", 3);
			await service.getShowCredits("123");
			expect(spies.getShowCredits).toHaveBeenCalledWith("123");
			await service.getFullShowCredits("123");
			expect(spies.getFullShowCredits).toHaveBeenCalledWith("123");
			await service.getWatchProviders("123");
			expect(spies.getWatchProviders).toHaveBeenCalledWith("123");
		});

		it("forwards catalogue calls to ShowCatalogueService", async () => {
			const spies = {
				getShowByTMDBId: vi.spyOn(catalogue, "getShowByTMDBId"),
				upsertShow: vi.spyOn(catalogue, "upsertShow"),
				syncShowMetadata: vi.spyOn(catalogue, "syncShowMetadata"),
				getEpisodeContextLocal: vi.spyOn(catalogue, "getEpisodeContextLocal"),
				getLocalSeasons: vi.spyOn(catalogue, "getLocalSeasons"),
				getLocalEpisodes: vi.spyOn(catalogue, "getLocalEpisodes"),
				ensureShowHasColors: vi.spyOn(catalogue, "ensureShowHasColors"),
			};
			for (const spy of Object.values(spies)) {
				spy.mockResolvedValue(sentinel as never);
			}
			const showData = { id: 123, name: "Test Show" };

			await expect(service.getShowByTMDBId("123")).resolves.toBe(sentinel);
			expect(spies.getShowByTMDBId).toHaveBeenCalledWith("123");
			await service.upsertShow(showData as never);
			expect(spies.upsertShow).toHaveBeenCalledWith(showData);
			await service.syncShowMetadata("123", { force: true });
			expect(spies.syncShowMetadata).toHaveBeenCalledWith("123", {
				force: true,
			});
			// getEpisodeContext is the public alias of the local-first lookup.
			await expect(service.getEpisodeContext("123", 1, 2)).resolves.toBe(
				sentinel,
			);
			await service.getEpisodeContextLocal("123", 1, 2);
			expect(spies.getEpisodeContextLocal).toHaveBeenCalledTimes(2);
			expect(spies.getEpisodeContextLocal).toHaveBeenCalledWith("123", 1, 2);
			await service.getLocalSeasons("123");
			expect(spies.getLocalSeasons).toHaveBeenCalledWith("123");
			await service.getLocalEpisodes("123", 1);
			expect(spies.getLocalEpisodes).toHaveBeenCalledWith("123", 1);
			await service.ensureShowHasColors("123");
			expect(spies.ensureShowHasColors).toHaveBeenCalledWith("123");
		});

		it("forwards Watch read models to ShowProgressService", async () => {
			const spies = {
				getUserShows: vi.spyOn(progress, "getUserShows"),
				getUserUpNext: vi.spyOn(progress, "getUserUpNext"),
				getUserReleaseCalendar: vi.spyOn(progress, "getUserReleaseCalendar"),
				getUserEpisodesPaginated: vi.spyOn(
					progress,
					"getUserEpisodesPaginated",
				),
				getEpisodeWatchHistory: vi.spyOn(progress, "getEpisodeWatchHistory"),
				getShowProgress: vi.spyOn(progress, "getShowProgress"),
			};
			for (const spy of Object.values(spies)) {
				spy.mockResolvedValue(sentinel as never);
			}

			await expect(service.getUserShows("did:plc:abc123")).resolves.toBe(
				sentinel,
			);
			expect(spies.getUserShows).toHaveBeenCalledWith("did:plc:abc123");
			await service.getUserUpNext(
				"did:plc:abc123",
				2,
				10,
				"title",
				"asc",
				"show-1",
			);
			expect(spies.getUserUpNext).toHaveBeenCalledWith(
				"did:plc:abc123",
				2,
				10,
				"title",
				"asc",
				"show-1",
			);
			// Defaults are applied once, at the facade, and forwarded explicitly.
			await service.getUserUpNext("did:plc:abc123");
			expect(spies.getUserUpNext).toHaveBeenLastCalledWith(
				"did:plc:abc123",
				1,
				8,
				"lastWatched",
				"desc",
				undefined,
			);
			await service.getUserReleaseCalendar("did:plc:abc123", {
				startDate: "2024-01-01",
			});
			expect(spies.getUserReleaseCalendar).toHaveBeenCalledWith(
				"did:plc:abc123",
				{ startDate: "2024-01-01" },
			);
			await service.getUserEpisodesPaginated("did:plc:abc123", 5, "cursor");
			expect(spies.getUserEpisodesPaginated).toHaveBeenCalledWith(
				"did:plc:abc123",
				5,
				"cursor",
			);
			await service.getEpisodeWatchHistory("did:plc:abc123", "123");
			expect(spies.getEpisodeWatchHistory).toHaveBeenCalledWith(
				"did:plc:abc123",
				"123",
			);
			await service.getShowProgress("did:plc:abc123", ["123", "456"]);
			expect(spies.getShowProgress).toHaveBeenCalledWith("did:plc:abc123", [
				"123",
				"456",
			]);
		});

		it("forwards Watch writes to EpisodeWatchService", async () => {
			const spies = {
				markEpisodeWatched: vi.spyOn(watches, "markEpisodeWatched"),
				indexTrackedEpisode: vi.spyOn(watches, "indexTrackedEpisode"),
				unmarkEpisodeWatched: vi.spyOn(watches, "unmarkEpisodeWatched"),
				removeTrackedEpisodeById: vi.spyOn(watches, "removeTrackedEpisodeById"),
				markSeasonWatched: vi.spyOn(watches, "markSeasonWatched"),
				markShowWatched: vi.spyOn(watches, "markShowWatched"),
			};
			for (const spy of Object.values(spies)) {
				spy.mockResolvedValue(sentinel as never);
			}

			await expect(
				service.markEpisodeWatched(
					"did:plc:abc123",
					session,
					"123",
					1,
					2,
					null,
				),
			).resolves.toBe(sentinel);
			expect(spies.markEpisodeWatched).toHaveBeenCalledWith(
				"did:plc:abc123",
				session,
				"123",
				1,
				2,
				null,
			);
			await service.indexTrackedEpisode(
				"at://uri",
				"cid",
				"rkey",
				"did:plc:abc123",
				"123",
				1,
				2,
				"2024-01-10T00:00:00.000Z",
			);
			expect(spies.indexTrackedEpisode).toHaveBeenCalledWith(
				"at://uri",
				"cid",
				"rkey",
				"did:plc:abc123",
				"123",
				1,
				2,
				"2024-01-10T00:00:00.000Z",
			);
			await service.unmarkEpisodeWatched("did:plc:abc123", session, "123");
			expect(spies.unmarkEpisodeWatched).toHaveBeenCalledWith(
				"did:plc:abc123",
				session,
				"123",
				"latest",
				undefined,
				undefined,
			);
			await service.removeTrackedEpisodeById(
				"did:plc:abc123",
				session,
				"tracked-1",
			);
			expect(spies.removeTrackedEpisodeById).toHaveBeenCalledWith(
				"did:plc:abc123",
				session,
				"tracked-1",
			);
			await service.markSeasonWatched("did:plc:abc123", session, "123", 1);
			expect(spies.markSeasonWatched).toHaveBeenCalledWith(
				"did:plc:abc123",
				session,
				"123",
				1,
				undefined,
			);
			await service.markShowWatched("did:plc:abc123", session, "123", null);
			expect(spies.markShowWatched).toHaveBeenCalledWith(
				"did:plc:abc123",
				session,
				"123",
				null,
			);
		});

		it("builds episode Watch records through the pure helper", () => {
			vi.mocked(buildEpisodeWatchRecord).mockReturnValue(sentinel as never);

			expect(
				service.buildEpisodeWatchRecord("123", 1, 2, null, "import-rkey"),
			).toBe(sentinel);
			expect(buildEpisodeWatchRecord).toHaveBeenCalledWith(
				"123",
				1,
				2,
				null,
				"import-rkey",
			);
		});
	});
});
