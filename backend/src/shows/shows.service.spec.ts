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
		},
		show: {
			findUnique: jest.fn(),
			upsert: jest.fn(),
			update: jest.fn(),
		},
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
		it("should get show details from TMDB", async () => {
			const mockShow = {
				id: 123,
				name: "Test Show",
				overview: "A test show",
				first_air_date: "2024-01-01",
			};
			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockShow),
			});

			const result = await service.getShowDetails("123");

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("/tv/123?api_key=test-api-key"),
			);
			expect(result).toEqual(mockShow);
		});
	});

	describe("getEpisodeContext", () => {
		it("should move to the next aired episode across seasons", async () => {
			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ number_of_seasons: 3 }),
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
					json: () => Promise.resolve({ episodes: [] }),
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
			const showsTmdb = (
				service as unknown as {
					showsTmdb: {
						getEpisodeContext: (
							showId: string,
							seasonNumber: number,
							episodeNumber: number,
						) => Promise<unknown>;
						getEpisodeDetails: (
							showId: string,
							seasonNumber: number,
							episodeNumber: number,
						) => Promise<unknown>;
					};
				}
			).showsTmdb;
			const getEpisodeContextSpy = jest.spyOn(showsTmdb, "getEpisodeContext");
			const getEpisodeDetailsSpy = jest.spyOn(showsTmdb, "getEpisodeDetails");

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
				{
					id: "tracked-2",
					showId: "show-1",
					seasonNumber: 1,
					episodeNumber: 1,
					watchedDate: new Date("2024-01-09T00:00:00.000Z"),
					createdAt: new Date("2024-01-09T00:00:00.000Z"),
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
				{
					id: "tracked-3",
					showId: "show-2",
					seasonNumber: 2,
					episodeNumber: 8,
					watchedDate: new Date("2024-01-08T00:00:00.000Z"),
					createdAt: new Date("2024-01-08T00:00:00.000Z"),
					show: {
						showId: "show-2",
						title: "Show Two",
						posterPath: "/show-two.jpg",
						backdropPath: null,
						firstAirYear: 2023,
						firstAirDate: new Date("2023-01-01T00:00:00.000Z"),
						overview: "Overview 2",
						colors: { primary: "#222222" },
					},
				},
			]);

			mockPrismaService.show.findUnique.mockResolvedValue({
				posterPath: "/show-one.jpg",
				colors: { primary: "#111111" },
			});

			getEpisodeContextSpy
				.mockResolvedValueOnce({
					next: { seasonNumber: 1, episodeNumber: 3 },
					previous: { seasonNumber: 1, episodeNumber: 1 },
				})
				.mockResolvedValueOnce({
					next: null,
					previous: { seasonNumber: 2, episodeNumber: 7 },
				});

			getEpisodeDetailsSpy.mockResolvedValue({
				episode_number: 3,
				season_number: 1,
				name: "Episode 3",
				air_date: "2024-01-11",
				overview: "Next up",
				still_path: "/still-3.jpg",
			});

			const result = await service.getUserUpNext("did:plc:abc123");

			expect(result).toEqual({
				items: [
					{
						showId: "show-1",
						watchCount: 2,
						latestWatchedDate: "2024-01-10T00:00:00.000Z",
						lastWatched: { seasonNumber: 1, episodeNumber: 2 },
						nextEpisode: {
							seasonNumber: 1,
							episodeNumber: 3,
							name: "Episode 3",
							airDate: "2024-01-11",
							overview: "Next up",
							stillPath: "/still-3.jpg",
						},
						show: {
							showId: "show-1",
							title: "Show One",
							posterPath: "/show-one.jpg",
							backdropPath: undefined,
							firstAirYear: 2024,
							firstAirDate: "2024-01-01T00:00:00.000Z",
							overview: "Overview 1",
							colors: { primary: "#111111" },
						},
					},
				],
				total: 1,
				page: 1,
				pageSize: 8,
				totalPages: 1,
				hasPreviousPage: false,
				hasNextPage: false,
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
