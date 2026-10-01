import { Test } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { MoviesTmdbService } from "../movies/movies-tmdb.service";
import { ShowsTmdbService } from "../shows/shows-tmdb.service";
import { ShowProgressService } from "../shows/show-progress.service";
import { WatchPickerService, watchingBudget } from "./watch-picker.service";

vi.mock("../prisma/prisma.service", () => ({ PrismaService: vi.fn() }));

describe("Pick for me", () => {
	const prisma = {
		user: { findUniqueOrThrow: vi.fn() },
		list: { findFirst: vi.fn() },
		trackedEpisode: { findMany: vi.fn() },
	};
	const movies = { getMovieDetails: vi.fn(), getWatchProviders: vi.fn() };
	const shows = {
		getShowDetails: vi.fn(),
		getSeasonDetails: vi.fn(),
		getUpNextAvailability: vi.fn(),
	};
	const progress = { getUserUpNext: vi.fn() };
	let service: WatchPickerService;
	const netflix = {
		provider_id: 8,
		provider_name: "Netflix",
		logo_path: "/netflix.png",
		display_priority: 1,
	};
	const episode = (number: number, runtime = 40) => ({
		season_number: 1,
		episode_number: number,
		name: `Episode ${number}`,
		runtime,
		air_date: "2020-01-01",
	});
	beforeEach(async () => {
		vi.resetAllMocks();
		prisma.user.findUniqueOrThrow.mockResolvedValue({ watchCountry: "NL" });
		prisma.list.findFirst.mockResolvedValue({
			items: [
				{ mediaType: "show", mediaId: "1" },
				{ mediaType: "movie", mediaId: "2" },
			],
		});
		prisma.trackedEpisode.findMany.mockResolvedValue([]);
		progress.getUserUpNext.mockResolvedValue({ items: [], hasNextPage: false });
		movies.getMovieDetails.mockResolvedValue({
			title: "Movie",
			runtime: 120,
			release_date: "2020-01-01",
			genres: [{ name: "Drama" }],
		});
		movies.getWatchProviders.mockResolvedValue({
			results: { NL: { flatrate: [netflix] } },
		});
		shows.getShowDetails.mockResolvedValue({
			name: "Show",
			episode_run_time: [40],
			seasons: [{ season_number: 1 }],
			genres: [{ name: "Drama" }],
		});
		shows.getSeasonDetails.mockResolvedValue({
			episodes: [episode(1), episode(2), episode(3), episode(4), episode(5)],
		});
		shows.getUpNextAvailability.mockResolvedValue({
			results: { NL: { flatrate: [netflix] } },
		});
		const module = await Test.createTestingModule({
			providers: [
				WatchPickerService,
				{ provide: PrismaService, useValue: prisma },
				{ provide: MoviesTmdbService, useValue: movies },
				{ provide: ShowsTmdbService, useValue: shows },
				{ provide: ShowProgressService, useValue: progress },
			],
		}).compile();
		service = module.get(WatchPickerService);
	});
	it("reserves proportional breaks, capped at fifteen minutes", () => {
		expect(watchingBudget(60)).toBe(54);
		expect(watchingBudget(180)).toBe(165);
		expect(watchingBudget(300)).toBe(285);
	});
	it("offers a movie or a partial show within a three-hour evening", async () => {
		const result = await service.get("did:plc:test", { minutes: 180 });
		expect(
			result.items.map((i) => [i.mediaType, i.minutes, i.episodes.length]),
		).toEqual([
			["show", 160, 4],
			["movie", 120, 0],
		]);
	});
	it("includes later Up Next pages and deduplicates watchlist shows", async () => {
		prisma.trackedEpisode.findMany.mockResolvedValue([
			{ showId: "1", seasonNumber: 1, episodeNumber: 1 },
		]);
		progress.getUserUpNext
			.mockResolvedValueOnce({
				items: [
					{ showId: "1", nextEpisode: { seasonNumber: 1, episodeNumber: 2 } },
				],
				hasNextPage: true,
			})
			.mockResolvedValueOnce({
				items: [
					{ showId: "3", nextEpisode: { seasonNumber: 1, episodeNumber: 1 } },
				],
				hasNextPage: false,
			});
		const result = await service.get("did:plc:test", { minutes: 180 });
		expect(result.items.filter((i) => i.id === "show:1")).toHaveLength(1);
		expect(
			result.items.find((i) => i.id === "show:1")?.episodes[0].episodeNumber,
		).toBe(2);
		expect(result.items.some((i) => i.id === "show:3")).toBe(true);
	});
	it("stops at a season unavailable on selected services", async () => {
		shows.getShowDetails.mockResolvedValue({
			name: "Show",
			seasons: [{ season_number: 1 }, { season_number: 2 }],
		});
		shows.getSeasonDetails
			.mockResolvedValueOnce({ episodes: [episode(1)] })
			.mockResolvedValueOnce({
				episodes: [{ ...episode(1), season_number: 2 }],
			});
		shows.getUpNextAvailability
			.mockResolvedValueOnce({ results: { NL: { flatrate: [netflix] } } })
			.mockResolvedValueOnce({ results: { NL: { flatrate: [] } } });
		const result = await service.get("did:plc:test", {
			minutes: 180,
			services: "8",
		});
		expect(
			result.items.find((i) => i.mediaType === "show")?.episodes,
		).toHaveLength(1);
	});
	it("permits unknown availability when services are cleared", async () => {
		movies.getWatchProviders.mockResolvedValue({ results: {} });
		expect(
			(
				await service.get("did:plc:test", {
					minutes: 180,
					type: "movie",
					services: "8",
				})
			).items,
		).toHaveLength(0);
		expect(
			(await service.get("did:plc:test", { minutes: 180, type: "movie" }))
				.items,
		).toHaveLength(1);
	});
	it("labels fallback runtimes and stops before unaired episodes", async () => {
		shows.getSeasonDetails.mockResolvedValue({
			episodes: [
				{ ...episode(1), runtime: undefined },
				{ ...episode(2), air_date: "2999-01-01" },
			],
		});
		const item = (
			await service.get("did:plc:test", { minutes: 180, type: "show" })
		).items[0];
		expect(item.estimated).toBe(true);
		expect(item.minutes).toBe(40);
		expect(item.episodes).toHaveLength(1);
	});
	it("excludes unusable runtimes and filters genre and progress", async () => {
		movies.getMovieDetails.mockResolvedValue({
			title: "Movie",
			release_date: "2020-01-01",
			runtime: 0,
		});
		expect(
			(await service.get("did:plc:test", { minutes: 180, type: "movie" }))
				.items,
		).toHaveLength(0);
		expect(
			(await service.get("did:plc:test", { minutes: 180, genre: "Comedy" }))
				.items,
		).toHaveLength(0);
		expect(
			(
				await service.get("did:plc:test", {
					minutes: 180,
					progress: "continue",
				})
			).items,
		).toHaveLength(0);
	});
	it("does not silently turn catalogue failures into a smaller random pool", async () => {
		shows.getShowDetails.mockRejectedValue(new Error("Catalogue unavailable"));
		await expect(service.get("did:plc:test", { minutes: 180 })).rejects.toThrow(
			"Catalogue unavailable",
		);
	});
});
