import { mockEnvironment } from "../../test/env";
import { BackendEnv } from "../config/env.schema";
import { Test, type TestingModule } from "@nestjs/testing";

vi.mock("../prisma/prisma.service", () => ({
	PrismaService: vi.fn(),
}));

import { ColorExtractionService } from "../movies/color-extraction.service";
import { PrismaService } from "../prisma/prisma.service";
import { ShowCatalogueService } from "./show-catalogue.service";
import { ShowProgressService } from "./show-progress.service";
import {
	type WatchProvidersResponse,
	ShowsTmdbService,
} from "./shows-tmdb.service";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ShowProgressService", () => {
	let service: ShowProgressService;
	let catalogue: ShowCatalogueService;
	let tmdb: ShowsTmdbService;

	const mockPrismaService = {
		user: { findUniqueOrThrow: vi.fn() },
		trackedEpisode: {
			findMany: vi.fn(),
			findFirst: vi.fn(),
			count: vi.fn(),
			groupBy: vi.fn(),
		},
		show: {
			findUnique: vi.fn(),
			upsert: vi.fn(),
			update: vi.fn(),
		},
		season: {
			findMany: vi.fn(),
		},
		episode: {
			findFirst: vi.fn(),
			findMany: vi.fn(),
			count: vi.fn(),
			groupBy: vi.fn(),
		},
		list: {
			findFirst: vi.fn(),
		},
		$queryRaw: vi.fn(),
	};

	const mockBackendEnv = mockEnvironment({
		get: vi.fn((key: string) => {
			if (key === "TMDB_API_KEY") return "test-api-key";
			return undefined;
		}),
	});

	const mockColorExtractionService = {
		extractColorsFromPoster: vi.fn(),
	};

	beforeEach(async () => {
		vi.clearAllMocks();
		mockFetch.mockReset();
		mockPrismaService.trackedEpisode.findMany.mockResolvedValue([]);
		mockPrismaService.season.findMany.mockResolvedValue([]);
		mockPrismaService.episode.findMany.mockResolvedValue([]);

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ShowProgressService,
				ShowCatalogueService,
				ShowsTmdbService,
				{ provide: PrismaService, useValue: mockPrismaService },
				{ provide: BackendEnv, useValue: mockBackendEnv },
				{
					provide: ColorExtractionService,
					useValue: mockColorExtractionService,
				},
			],
		}).compile();

		service = module.get<ShowProgressService>(ShowProgressService);
		catalogue = module.get<ShowCatalogueService>(ShowCatalogueService);
		tmdb = module.get<ShowsTmdbService>(ShowsTmdbService);
		vi.spyOn(tmdb, "getUpNextAvailability").mockResolvedValue({
			id: 1,
			results: {},
		});
	});

	describe("getUserUpNext", () => {
		it("filters flat-rate offers in the watch country before pagination and warms unfiltered reads", async () => {
			const ids = ["1", "2", "3", "4"];
			mockPrismaService.trackedEpisode.findMany.mockResolvedValue(
				ids.map((showId) => ({
					id: showId,
					showId,
					seasonNumber: 1,
					episodeNumber: 1,
					watchedDate: new Date("2025-01-01"),
					createdAt: new Date("2025-01-01"),
					show: {
						showId,
						title: showId,
						posterPath: null,
						backdropPath: null,
						firstAirYear: null,
						firstAirDate: null,
						overview: null,
						colors: null,
					},
				})),
			);
			mockPrismaService.$queryRaw.mockResolvedValue(
				ids.map((showId) => ({
					showId,
					seasonNumber: 2,
					episodeNumber: 1,
					name: "Next",
					airDate: new Date("2025-01-02"),
				})),
			);
			mockPrismaService.episode.groupBy.mockResolvedValue(
				ids.map((showId) => ({ showId, _count: 10 })),
			);
			mockPrismaService.trackedEpisode.groupBy.mockResolvedValue(
				ids.map((showId) => ({ showId, seasonNumber: 1, episodeNumber: 1 })),
			);
			mockPrismaService.user.findUniqueOrThrow.mockResolvedValue({
				watchCountry: "NL",
				streamingServiceIds: [8],
			});
			vi.spyOn(catalogue, "ensureShowHasColors").mockResolvedValue(null);
			const offer = {
				provider_id: 8,
				provider_name: "Netflix",
				logo_path: "",
				display_priority: 1,
			};
			vi.mocked(tmdb.getUpNextAvailability).mockImplementation(
				async (id): Promise<WatchProvidersResponse> => ({
					id: Number(id),
					results:
						id === "1"
							? { NL: { link: "", buy: [offer] } }
							: id === "3"
								? { US: { link: "", flatrate: [offer] } }
								: { NL: { link: "", flatrate: [offer] } },
				}),
			);
			const filtered = await service.getUserUpNext(
				"did:plc:abc123",
				2,
				1,
				"title",
				"asc",
				undefined,
				"mine",
			);
			expect(filtered).toMatchObject({
				total: 2,
				totalPages: 2,
				page: 2,
				hasPreviousPage: true,
				hasNextPage: false,
			});
			expect(filtered.items.map((item) => item.showId)).toEqual(["4"]);
			expect(tmdb.getUpNextAvailability).toHaveBeenCalledWith("4", 2);
			vi.mocked(tmdb.getUpNextAvailability).mockClear();
			const unfiltered = await service.getUserUpNext("did:plc:abc123", 1, 1);
			expect(unfiltered.total).toBe(4);
			expect(tmdb.getUpNextAvailability).toHaveBeenCalledTimes(4);
			mockPrismaService.user.findUniqueOrThrow.mockResolvedValue({
				watchCountry: "NL",
				streamingServiceIds: [],
			});
			await expect(
				service.getUserUpNext(
					"did:plc:abc123",
					9,
					1,
					"title",
					"asc",
					undefined,
					"mine",
				),
			).resolves.toMatchObject({ items: [], total: 0, totalPages: 0, page: 1 });
			// An explicit selection works even without saved subscriptions.
			const custom = await service.getUserUpNext(
				"did:plc:abc123",
				1,
				1,
				"title",
				"asc",
				undefined,
				"8,350",
			);
			expect(custom).toMatchObject({
				total: 2,
				totalPages: 2,
				hasNextPage: true,
			});
			expect(custom.items.map((item) => item.showId)).toEqual(["2"]);
			await expect(
				service.getUserUpNext(
					"did:plc:abc123",
					1,
					1,
					"title",
					"asc",
					undefined,
					"350",
				),
			).resolves.toMatchObject({ items: [], total: 0 });
			vi.mocked(tmdb.getUpNextAvailability).mockRejectedValue(
				new Error("TMDB offline"),
			);
			await expect(
				service.getUserUpNext("did:plc:abc123"),
			).resolves.toMatchObject({ total: 4 });
			await expect(
				service.getUserUpNext(
					"did:plc:abc123",
					1,
					8,
					"title",
					"asc",
					undefined,
					"mine",
				),
			).rejects.toThrow("TMDB offline");
		});

		it("ranks an undated show below a dated one even when logged later", async () => {
			// show-1 was genuinely watched in 2024. show-2 is undated — the whole
			// show marked watched during onboarding, so its createdAt is today.
			// latestWatchedDate falls back to createdAt for show-2, so sorting on
			// that alone would put the undated show first (ADR 0037 forbids it).
			mockPrismaService.trackedEpisode.findMany = vi.fn().mockResolvedValue([
				{
					id: "t1",
					showId: "show-1",
					seasonNumber: 1,
					episodeNumber: 1,
					watchedDate: new Date("2024-05-01T00:00:00.000Z"),
					createdAt: new Date("2024-05-01T00:00:00.000Z"),
					show: {
						showId: "show-1",
						title: "Dated Show",
						posterPath: null,
						backdropPath: null,
						firstAirYear: 2024,
						firstAirDate: new Date("2024-01-01T00:00:00.000Z"),
						overview: null,
						colors: null,
					},
				},
				{
					id: "t2",
					showId: "show-2",
					seasonNumber: 1,
					episodeNumber: 1,
					watchedDate: null,
					createdAt: new Date("2026-09-19T00:00:00.000Z"),
					show: {
						showId: "show-2",
						title: "Undated Show",
						posterPath: null,
						backdropPath: null,
						firstAirYear: 2024,
						firstAirDate: new Date("2024-01-01T00:00:00.000Z"),
						overview: null,
						colors: null,
					},
				},
			]);

			mockPrismaService.$queryRaw = vi.fn().mockResolvedValue([
				{
					showId: "show-1",
					seasonNumber: 1,
					episodeNumber: 2,
					name: "Next 1",
					airDate: new Date("2024-05-02T00:00:00.000Z"),
					overview: null,
					stillPath: null,
				},
				{
					showId: "show-2",
					seasonNumber: 1,
					episodeNumber: 2,
					name: "Next 2",
					airDate: new Date("2024-05-02T00:00:00.000Z"),
					overview: null,
					stillPath: null,
				},
			]);

			mockPrismaService.episode = {
				...mockPrismaService.episode,
				groupBy: vi.fn().mockResolvedValue([
					{ showId: "show-1", _count: 10 },
					{ showId: "show-2", _count: 10 },
				]),
			};
			mockPrismaService.trackedEpisode.groupBy = vi.fn().mockResolvedValue([
				{ showId: "show-1", seasonNumber: 1, episodeNumber: 1 },
				{ showId: "show-2", seasonNumber: 1, episodeNumber: 1 },
			]);

			const desc = await service.getUserUpNext("did:plc:abc123");
			expect(desc.items.map((i) => i.showId)).toEqual(["show-1", "show-2"]);

			// "After every dated Watch" holds in both directions, so flipping the
			// sort order must not float the undated show to the top.
			const asc = await service.getUserUpNext(
				"did:plc:abc123",
				1,
				8,
				"lastWatched",
				"asc",
			);
			expect(asc.items.map((i) => i.showId)).toEqual(["show-1", "show-2"]);

			// The internal flag must not leak into the response.
			expect(desc.items[0]).not.toHaveProperty("isUndated");
		});

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

			// The anchor VALUES rows are bound parameters, never inlined SQL text.
			const nextEpisodeQuery = mockPrismaService.$queryRaw.mock.calls[0][0];
			expect(nextEpisodeQuery.values).toEqual(
				expect.arrayContaining(["show-1", 1, 2]),
			);
			expect(nextEpisodeQuery.sql).not.toContain("show-1");
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
			// furthest episode: watchedDate desc first, distinct on showId. An
			// undated Watch must never win the anchor, so nulls sort last.
			expect(mockPrismaService.trackedEpisode.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					orderBy: [
						{ watchedDate: { sort: "desc", nulls: "last" } },
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
			expect(mockPrismaService.show.findUnique).not.toHaveBeenCalled();

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

	describe("getShowProgress", () => {
		it("reports unavailable progress from incomplete persisted metadata without TMDB repair", async () => {
			mockPrismaService.trackedEpisode.findMany.mockResolvedValue([
				{ showId: "123", seasonNumber: 1, episodeNumber: 1 },
			]);
			mockPrismaService.season.findMany.mockResolvedValue([]);
			mockPrismaService.episode.findMany.mockResolvedValue([]);
			const sync = vi
				.spyOn(catalogue, "syncShowMetadata")
				.mockResolvedValue(undefined);

			await expect(
				service.getShowProgress("did:plc:viewer", ["123"]),
			).resolves.toEqual([
				{
					showId: "123",
					hasWatches: true,
					episodesWatched: 1,
					episodesTotal: 0,
					state: "unavailable",
					remainingEpisodes: 0,
					percentage: 0,
					seasons: [],
				},
			]);
			expect(sync).not.toHaveBeenCalled();
		});

		it("deduplicates repeated watches when persisted progress is unavailable", async () => {
			mockPrismaService.trackedEpisode.findMany.mockResolvedValue([
				{ showId: "123", seasonNumber: 1, episodeNumber: 1 },
				{ showId: "123", seasonNumber: 1, episodeNumber: 1 },
			]);
			mockPrismaService.season.findMany.mockResolvedValue([]);
			mockPrismaService.episode.findMany.mockResolvedValue([]);

			await expect(
				service.getShowProgress("did:plc:viewer", ["123"]),
			).resolves.toEqual([
				{
					showId: "123",
					hasWatches: true,
					episodesWatched: 1,
					episodesTotal: 0,
					state: "unavailable",
					remainingEpisodes: 0,
					percentage: 0,
					seasons: [],
				},
			]);
		});

		it("uses complete persisted metadata without TMDB fan-out", async () => {
			mockPrismaService.trackedEpisode.findMany.mockResolvedValue([
				{ showId: "123", seasonNumber: 1, episodeNumber: 1 },
				{ showId: "123", seasonNumber: 1, episodeNumber: 1 },
			]);
			mockPrismaService.season.findMany.mockResolvedValue([
				{ showId: "123", seasonNumber: 1, episodeCount: 3 },
			]);
			mockPrismaService.episode.findMany.mockResolvedValue([
				{
					showId: "123",
					seasonNumber: 1,
					episodeNumber: 1,
					airDate: new Date("2020-01-01"),
				},
				{
					showId: "123",
					seasonNumber: 1,
					episodeNumber: 2,
					airDate: new Date("2020-01-08"),
				},
				{
					showId: "123",
					seasonNumber: 1,
					episodeNumber: 3,
					airDate: new Date("2099-01-01"),
				},
			]);

			await expect(
				service.getShowProgress("did:plc:viewer", ["123"]),
			).resolves.toEqual([
				{
					showId: "123",
					hasWatches: true,
					episodesWatched: 1,
					episodesTotal: 2,
					state: "partial",
					remainingEpisodes: 1,
					percentage: 50,
					seasons: [
						{
							seasonNumber: 1,
							episodesWatched: 1,
							episodesTotal: 2,
							state: "partial",
							remainingEpisodes: 1,
							percentage: 50,
						},
					],
				},
			]);
			expect(mockFetch).not.toHaveBeenCalled();

			const incomplete = await service.getShowProgress("did:plc:viewer", [
				"456",
			]);
			expect(incomplete).toEqual([
				{
					showId: "456",
					hasWatches: false,
					episodesWatched: 0,
					episodesTotal: 0,
					state: "unavailable",
					remainingEpisodes: 0,
					percentage: 0,
					seasons: [],
				},
			]);
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
				orderBy: [
					{ watchedDate: { sort: "desc", nulls: "last" } },
					{ createdAt: "desc" },
				],
			});
			expect(result).toHaveLength(2);
			expect(result[0]).toMatchObject({
				id: "tracked-1",
				showId: "123",
				episodeWatchCount: 2,
			});
			expect(result[0].show.colors).toEqual(colors);
			expect(result[1]).toMatchObject({ showId: "456", episodeWatchCount: 1 });
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
