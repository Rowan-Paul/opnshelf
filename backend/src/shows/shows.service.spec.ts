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

import { PrismaService } from "../prisma/prisma.service";
import { ColorExtractionService } from "../movies/color-extraction.service";
import { ShowsService } from "./shows.service";
import { ShowsTmdbService } from "./shows-tmdb.service";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ShowsService", () => {
	let service: ShowsService;

	const mockPrismaService = {
		trackedEpisode: {
			findMany: vi.fn(),
			findFirst: vi.fn(),
			upsert: vi.fn(),
			create: vi.fn(),
			createMany: vi.fn(),
			delete: vi.fn(),
			deleteMany: vi.fn(),
			groupBy: vi.fn(),
		},
		show: {
			findUnique: vi.fn(),
			upsert: vi.fn(),
			update: vi.fn(),
		},
		season: {
			findFirst: vi.fn(),
			findMany: vi.fn(),
			upsert: vi.fn(),
		},
		episode: {
			findFirst: vi.fn(),
			findMany: vi.fn(),
			upsert: vi.fn(),
			count: vi.fn(),
			groupBy: vi.fn(),
		},
		list: {
			findFirst: vi.fn(),
		},
		$queryRaw: vi.fn(),
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
			mockPrismaService.$queryRaw = vi.fn().mockResolvedValue([
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
				groupBy: vi.fn().mockResolvedValue([{ showId: "show-1", _count: 10 }]),
			};

			// Query 4: watched episodes groupBy
			mockPrismaService.trackedEpisode.groupBy = vi.fn().mockResolvedValue([
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

		it("narrows the anchor query to one show when showId is given (issue #201)", async () => {
			mockPrismaService.trackedEpisode.findMany.mockResolvedValue([]);

			await service.getUserUpNext(
				"did:plc:abc123",
				1,
				8,
				"lastWatched",
				"desc",
				"show-1",
			);

			expect(mockPrismaService.trackedEpisode.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({ showId: "show-1" }),
				}),
			);
		});

		it("anchors on the most recent watch, so a rewatch of an early episode moves up-next back (issue #158 semantics)", async () => {
			// The user is deep into the show (watched through S3E5), but their
			// most recent watch is a rewatch of S1E2. The anchor query orders by
			// watchedDate desc with distinct per show, so the DB hands back the
			// rewatched episode as the anchor — codified here as the intended
			// behavior: up-next follows the rewatch, not the furthest progress.
			mockPrismaService.trackedEpisode.findMany.mockResolvedValue([
				{
					id: "tracked-rewatch",
					showId: "show-1",
					seasonNumber: 1,
					episodeNumber: 2,
					watchedDate: new Date("2024-06-01T00:00:00.000Z"),
					createdAt: new Date("2024-06-01T00:00:00.000Z"),
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

			// Next aired episode after the S1E2 anchor is S1E3.
			mockPrismaService.$queryRaw = vi.fn().mockResolvedValue([
				{
					showId: "show-1",
					seasonNumber: 1,
					episodeNumber: 3,
					name: "Episode 3",
					airDate: new Date("2024-01-11T00:00:00.000Z"),
					overview: "Right after the rewatch",
					stillPath: "/still-3.jpg",
				},
			]);

			mockPrismaService.episode = {
				...mockPrismaService.episode,
				groupBy: vi.fn().mockResolvedValue([{ showId: "show-1", _count: 30 }]),
			};

			// Distinct watched episodes include S1E3 (already seen on the first
			// run through) — it must still come back as up-next.
			mockPrismaService.trackedEpisode.groupBy = vi.fn().mockResolvedValue([
				{ showId: "show-1", seasonNumber: 1, episodeNumber: 1 },
				{ showId: "show-1", seasonNumber: 1, episodeNumber: 2 },
				{ showId: "show-1", seasonNumber: 1, episodeNumber: 3 },
				{ showId: "show-1", seasonNumber: 2, episodeNumber: 1 },
				{ showId: "show-1", seasonNumber: 3, episodeNumber: 5 },
			]);

			mockPrismaService.show.findUnique.mockResolvedValue({
				posterPath: "/show-one.jpg",
				colors: { primary: "#111111" },
			});

			const result = await service.getUserUpNext("did:plc:abc123");

			// The anchor query must select the newest watch per show, not the
			// furthest episode: watchedDate desc first, distinct on showId.
			expect(mockPrismaService.trackedEpisode.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					orderBy: [
						{ watchedDate: "desc" },
						{ createdAt: "desc" },
						{ seasonNumber: "desc" },
						{ episodeNumber: "desc" },
					],
					distinct: ["showId"],
				}),
			);

			expect(result.items).toHaveLength(1);
			expect(result.items[0]).toMatchObject({
				showId: "show-1",
				episodesWatched: 5,
				totalEpisodes: 30,
				// Anchored on the rewatched early episode…
				lastWatched: { seasonNumber: 1, episodeNumber: 2 },
				// …and up-next is its immediate successor, even though the user
				// already watched it on the first run through the show.
				nextEpisode: {
					seasonNumber: 1,
					episodeNumber: 3,
					name: "Episode 3",
				},
			});
		});
	});

	describe("getUserReleaseCalendar", () => {
		it("should return upcoming tracked-show airings and future watchlist releases", async () => {
			// Mock tracked episodes to get the shows the user is watching
			mockPrismaService.trackedEpisode.findMany.mockResolvedValue([
				{
					id: "tracked-1",
					showId: "show-1",
					seasonNumber: 1,
					episodeNumber: 2,
					watchedDate: new Date("2024-01-10T00:00:00.000Z"),
					createdAt: new Date("2024-01-10T00:00:00.000Z"),
				},
			]);

			// Mock episodes from watched shows with air dates in range
			mockPrismaService.episode.findMany.mockResolvedValue([
				{
					id: "episode-1",
					tmdbId: 101,
					showId: "show-1",
					seasonNumber: 2,
					episodeNumber: 5,
					name: "Broadcast Episode",
					airDate: new Date("2099-01-12T00:00:00.000Z"),
					overview: "Broadcast overview",
					season: {
						id: "season-1",
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
				},
			]);

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
						mediaType: "season",
						mediaId: "show-3",
						seasonNumber: 1,
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
						releaseDate: "2099-01-10",
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
						releaseDate: "2099-01-11",
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
						episodes: [{ episode_number: 1 }],
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

	describe("getUserShows", () => {
		it("groups interleaved episodes while keeping the newest representative and colors", async () => {
			const colors = { primary: "#112233", secondary: "#445566" };
			mockPrismaService.trackedEpisode.findMany.mockResolvedValue([
				{
					id: "tracked-1",
					showId: "123",
					watchedDate: new Date("2024-01-15"),
					show: { name: "Show 1", colors },
				},
				{
					id: "tracked-2",
					showId: "456",
					watchedDate: new Date("2024-01-12"),
					show: { name: "Show 2", colors: null },
				},
				{
					id: "tracked-3",
					showId: "123",
					watchedDate: new Date("2024-01-10"),
					show: { name: "Show 1", colors: null },
				},
			]);

			const result = await service.getUserShows("did:plc:abc123");

			expect(mockPrismaService.trackedEpisode.findMany).toHaveBeenCalledWith({
				where: { userDid: "did:plc:abc123" },
				include: { show: true },
				orderBy: { watchedDate: "desc" },
			});
			expect(result).toHaveLength(2);
			expect(result[0]).toMatchObject({
				id: "tracked-1",
				showId: "123",
				watchCount: 2,
			});
			expect(result[0].show.colors).toEqual(colors);
			expect(result[1]).toMatchObject({ showId: "456", watchCount: 1 });
			expect(mockPrismaService.trackedEpisode.findMany).toHaveBeenCalledTimes(
				1,
			);
		});

		it("returns an empty array when the user has no tracked shows", async () => {
			mockPrismaService.trackedEpisode.findMany.mockResolvedValue([]);

			await expect(service.getUserShows("did:plc:unknown")).resolves.toEqual(
				[],
			);
		});
	});
});
