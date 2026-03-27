import { ConfigService } from "@nestjs/config";
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

jest.mock("../lexicons/xyz/opnshelf/episode", () => ({
	main: {
		build: jest.fn((data: Record<string, unknown>) => ({
			$type: "xyz.opnshelf.episode",
			...data,
		})),
	},
	$nsid: "xyz.opnshelf.episode",
}));

import { PrismaService } from "../prisma/prisma.service";
import { ColorExtractionService } from "../movies/color-extraction.service";
import { ShowsService } from "./shows.service";
import { ShowsTmdbService } from "./shows-tmdb.service";

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("ShowsService", () => {
	let service: ShowsService;

	const mockPrismaService = {
		trackedEpisode: {
			findMany: jest.fn(),
			findFirst: jest.fn(),
			upsert: jest.fn(),
			create: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn(),
			groupBy: jest.fn(),
		},
		show: {
			findUnique: jest.fn(),
			upsert: jest.fn(),
			update: jest.fn(),
		},
		season: {
			findFirst: jest.fn(),
			findMany: jest.fn(),
			upsert: jest.fn(),
		},
		episode: {
			findFirst: jest.fn(),
			findMany: jest.fn(),
			upsert: jest.fn(),
			count: jest.fn(),
			groupBy: jest.fn(),
		},
		list: {
			findFirst: jest.fn(),
		},
		$queryRaw: jest.fn(),
	};

	const mockConfigService = {
		get: jest.fn((key: string) => {
			if (key === "TMDB_API_KEY") return "test-api-key";
			return undefined;
		}),
	};

	const mockColorExtractionService = {
		extractColorsFromPoster: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();
		mockPutRecord.mockReset();
		mockDeleteRecord.mockReset();
		mockFetch.mockReset();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ShowsService,
				ShowsTmdbService,
				{ provide: PrismaService, useValue: mockPrismaService },
				{ provide: ConfigService, useValue: mockConfigService },
				{
					provide: ColorExtractionService,
					useValue: mockColorExtractionService,
				},
			],
		}).compile();

		service = module.get<ShowsService>(ShowsService);
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
			);
			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("/tv/123/videos?api_key=test-api-key"),
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

	describe("syncShowMetadata", () => {
		it("should upsert the show before upserting seasons", async () => {
			mockPrismaService.season.findFirst.mockResolvedValue(null);
			mockColorExtractionService.extractColorsFromPoster.mockResolvedValue(
				null,
			);
			mockPrismaService.show.upsert.mockResolvedValue({
				showId: "123",
				title: "Test Show",
			});
			mockPrismaService.season.upsert.mockResolvedValue({
				id: "season-1",
			});
			mockPrismaService.episode.upsert.mockResolvedValue({
				id: "episode-1",
			});

			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: () =>
						Promise.resolve({
							id: 123,
							name: "Test Show",
							overview: "A test show",
							first_air_date: "2024-01-01",
							seasons: [
								{
									id: 10,
									season_number: 1,
									name: "Season 1",
									poster_path: "/season.jpg",
									air_date: "2024-01-01",
									episode_count: 1,
								},
							],
						}),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ results: [] }),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () =>
						Promise.resolve({
							id: 10,
							name: "Season 1",
							season_number: 1,
							episodes: [
								{
									id: 100,
									name: "Episode 1",
									episode_number: 1,
									still_path: "/episode.jpg",
									air_date: "2024-01-02",
									overview: "Episode overview",
								},
							],
						}),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ results: [] }),
				});

			await service.syncShowMetadata("123");

			expect(mockPrismaService.show.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { showId: "123" },
				}),
			);
			expect(mockPrismaService.season.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					create: expect.objectContaining({
						showId: "123",
						seasonNumber: 1,
					}),
				}),
			);
			expect(
				mockPrismaService.show.upsert.mock.invocationCallOrder[0],
			).toBeLessThan(
				mockPrismaService.season.upsert.mock.invocationCallOrder[0],
			);
		});
	});

	describe("getEpisodeContext", () => {
		it("should move to the next aired episode across seasons", async () => {
			mockPrismaService.episode.count.mockResolvedValue(0);

			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ number_of_seasons: 3 }),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ results: [] }),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () =>
						Promise.resolve({
							episodes: [{ episode_number: 10, season_number: 1 }],
						}),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ results: [] }),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ episodes: [] }),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ results: [] }),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () =>
						Promise.resolve({
							episodes: [
								{
									episode_number: 1,
									season_number: 3,
									air_date: "2024-01-02",
								},
							],
						}),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ results: [] }),
				});

			const result = await service.getEpisodeContext("123", 1, 10);

			expect(result).toEqual({
				previous: null,
				next: { seasonNumber: 3, episodeNumber: 1 },
			});
		});
	});

	describe("getUserUpNext", () => {
		it("should return next episodes and omit caught-up shows", async () => {
			// Query 1: anchors via distinct
			mockPrismaService.trackedEpisode.findMany.mockResolvedValue([
				{
					id: "tracked-1",
					showId: "show-1",
					seasonNumber: 1,
					episodeNumber: 2,
					watchedDate: new Date("2024-01-10T00:00:00.000Z"),
					createdAt: new Date("2024-01-10T00:00:00.000Z"),
					show: {
						showId: "show-1",
						title: "Show One",
						posterPath: "/show-one.jpg",
						backdropPath: null,
						firstAirYear: 2024,
						firstAirDate: new Date("2024-01-01T00:00:00.000Z"),
						overview: "Overview 1",
						colors: { primary: "#111111" },
					},
				},
			]);

			// Query 2: next episodes via raw SQL
			mockPrismaService.$queryRaw = jest.fn().mockResolvedValue([
				{
					showId: "show-1",
					seasonNumber: 1,
					episodeNumber: 3,
					name: "Episode 3",
					airDate: new Date("2024-01-11T00:00:00.000Z"),
					overview: "Next up",
					stillPath: "/still-3.jpg",
				},
			]);

			// Query 3: total aired episodes
			mockPrismaService.episode = {
				...mockPrismaService.episode,
				groupBy: jest
					.fn()
					.mockResolvedValue([{ showId: "show-1", _count: 10 }]),
			};

			// Query 4: watched episodes groupBy
			mockPrismaService.trackedEpisode.groupBy = jest.fn().mockResolvedValue([
				{ showId: "show-1", seasonNumber: 1, episodeNumber: 1 },
				{ showId: "show-1", seasonNumber: 1, episodeNumber: 2 },
			]);

			mockPrismaService.show.findUnique.mockResolvedValue({
				posterPath: "/show-one.jpg",
				colors: { primary: "#111111" },
			});

			const result = await service.getUserUpNext("did:plc:abc123");

			expect(result.items).toHaveLength(1);
			expect(result.items[0]).toMatchObject({
				showId: "show-1",
				totalEpisodes: 10,
				episodesWatched: 2,
				lastWatched: { seasonNumber: 1, episodeNumber: 2 },
				nextEpisode: {
					seasonNumber: 1,
					episodeNumber: 3,
					name: "Episode 3",
				},
			});
			expect(result.total).toBe(1);
			expect(result.page).toBe(1);
			expect(result.pageSize).toBe(8);
		});
	});

	describe("getUserReleaseCalendar", () => {
		it("should return upcoming tracked-show airings and future watchlist releases", async () => {
			const showsTmdb = (
				service as unknown as {
					showsTmdb: {
						getShowDetails: (showId: string) => Promise<unknown>;
					};
				}
			).showsTmdb;
			const getShowDetailsSpy = jest.spyOn(showsTmdb, "getShowDetails");

			mockPrismaService.trackedEpisode.findMany.mockResolvedValue([
				{
					id: "tracked-1",
					showId: "show-1",
					seasonNumber: 1,
					episodeNumber: 2,
					watchedDate: new Date("2024-01-10T00:00:00.000Z"),
					createdAt: new Date("2024-01-10T00:00:00.000Z"),
					show: {
						showId: "show-1",
						title: "Tracked Show",
						posterPath: "/tracked-show.jpg",
						backdropPath: "/tracked-show-backdrop.jpg",
						firstAirYear: 2024,
						firstAirDate: new Date("2024-01-01T00:00:00.000Z"),
						overview: "Tracked show overview",
						colors: { primary: "#111111" },
					},
				},
			]);

			getShowDetailsSpy.mockResolvedValue({
				id: 1,
				name: "Tracked Show",
				popularity: 1,
				vote_average: 1,
				vote_count: 1,
				next_episode_to_air: {
					id: 101,
					name: "Broadcast Episode",
					season_number: 2,
					episode_number: 5,
					air_date: "2099-01-12",
					overview: "Broadcast overview",
				},
			});

			mockPrismaService.show.findUnique.mockResolvedValue({
				posterPath: "/tracked-show.jpg",
				colors: { primary: "#111111" },
			});

			mockPrismaService.list.findFirst.mockResolvedValue({
				items: [
					{
						mediaType: "movie",
						mediaId: "movie-1",
						movie: {
							movieId: "movie-1",
							title: "Future Movie",
							posterPath: "/future-movie.jpg",
							backdropPath: "/future-movie-backdrop.jpg",
							releaseDate: new Date("2099-01-10T00:00:00.000Z"),
							overview: "Movie overview",
							colors: { primary: "#222222" },
						},
						show: null,
					},
					{
						mediaType: "show",
						mediaId: "show-2",
						movie: null,
						show: {
							showId: "show-2",
							title: "Future Show",
							posterPath: "/future-show.jpg",
							backdropPath: "/future-show-backdrop.jpg",
							firstAirDate: new Date("2099-01-11T00:00:00.000Z"),
							overview: "Show overview",
							colors: { primary: "#333333" },
						},
					},
					{
						mediaType: "show",
						mediaId: "show-3:season:1",
						movie: null,
						show: {
							showId: "show-3",
							title: "Scoped Show",
							posterPath: "/scoped-show.jpg",
							backdropPath: "/scoped-show-backdrop.jpg",
							firstAirDate: new Date("2099-01-13T00:00:00.000Z"),
							overview: "Scoped show overview",
							colors: { primary: "#444444" },
						},
					},
				],
			});

			const result = await service.getUserReleaseCalendar("did:plc:abc123");

			expect(result).toEqual({
				items: [
					{
						source: "watchlist",
						mediaType: "movie",
						releaseKind: "movie",
						releaseDate: "2099-01-10T00:00:00.000Z",
						title: "Future Movie",
						subtitle: "Watchlist movie release",
						overview: "Movie overview",
						posterPath: "/future-movie.jpg",
						backdropPath: "/future-movie-backdrop.jpg",
						movieId: "movie-1",
						colors: { primary: "#222222" },
					},
					{
						source: "watchlist",
						mediaType: "show",
						releaseKind: "show",
						releaseDate: "2099-01-11T00:00:00.000Z",
						title: "Future Show",
						subtitle: "Watchlist series release",
						overview: "Show overview",
						posterPath: "/future-show.jpg",
						backdropPath: "/future-show-backdrop.jpg",
						showId: "show-2",
						colors: { primary: "#333333" },
					},
					{
						source: "watching",
						mediaType: "show",
						releaseKind: "episode",
						releaseDate: "2099-01-12",
						title: "Tracked Show",
						subtitle: "S2 E5 · Broadcast Episode",
						overview: "Broadcast overview",
						posterPath: "/tracked-show.jpg",
						backdropPath: "/tracked-show-backdrop.jpg",
						showId: "show-1",
						seasonNumber: 2,
						episodeNumber: 5,
						colors: { primary: "#111111" },
					},
				],
				total: 3,
			});
		});
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
			expect(result).toEqual({ showId: "123", mode: "all", deletedCount: 2 });
		});
	});
});
