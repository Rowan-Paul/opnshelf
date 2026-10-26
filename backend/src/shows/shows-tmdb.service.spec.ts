import { mockEnvironment } from "../../test/env";
import { MemoryTmdbCacheStore } from "../tmdb/tmdb-cache.store";
import { TMDB_DETAIL_CACHE_TTL_MS } from "../tmdb/tmdb-http";
import { ShowsTmdbService } from "./shows-tmdb.service";

const offer = {
	provider_id: 8,
	provider_name: "Netflix",
	logo_path: "",
	display_priority: 1,
};

describe("Up Next season availability", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it("falls back only when season data is absent, and reuses cached reads", async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(Response.json({ id: 1, results: {} }))
			.mockResolvedValueOnce(
				Response.json({
					id: 1,
					results: { NL: { link: "", flatrate: [offer] } },
				}),
			)
			.mockResolvedValueOnce(
				Response.json({ id: 2, results: { NL: { link: "", buy: [offer] } } }),
			);
		vi.stubGlobal("fetch", fetch);
		const service = new ShowsTmdbService(
			mockEnvironment({ TMDB_API_KEY: "test" }),
		);
		expect(
			(await service.getUpNextAvailability("1", 2)).results.NL.flatrate,
		).toEqual([offer]);
		await service.getUpNextAvailability("1", 2);
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(fetch.mock.calls[0][0]).toContain("/tv/1/season/2/watch/providers?");
		expect(fetch.mock.calls[1][0]).toContain("/tv/1/watch/providers?");
		expect(
			(await service.getUpNextAvailability("1", 3)).results.NL.flatrate,
		).toBeUndefined();
		expect(fetch).toHaveBeenCalledTimes(3);
	});

	it("caches missing seasons across service instances until the detail TTL expires", async () => {
		vi.useFakeTimers();
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(new Response(null, { status: 404 }))
			.mockResolvedValueOnce(Response.json({ id: 1, results: {} }))
			.mockResolvedValueOnce(
				Response.json({ results: { NL: { link: "", flatrate: [offer] } } }),
			);
		vi.stubGlobal("fetch", fetch);
		const config = mockEnvironment({ TMDB_API_KEY: "test" });
		const store = new MemoryTmdbCacheStore();
		const first = new ShowsTmdbService(config, store);
		const second = new ShowsTmdbService(config, store);
		await expect(first.getUpNextAvailability("1", 2)).resolves.toEqual({
			id: 1,
			results: {},
		});
		await expect(second.getUpNextAvailability("1", 2)).resolves.toEqual({
			id: 1,
			results: {},
		});
		expect(fetch).toHaveBeenCalledTimes(2);
		vi.advanceTimersByTime(TMDB_DETAIL_CACHE_TTL_MS);
		expect(
			(await second.getUpNextAvailability("1", 2)).results.NL.flatrate,
		).toEqual([offer]);
		expect(fetch).toHaveBeenCalledTimes(3);
	});

	it("falls back on a missing season but does not treat upstream errors as missing data", async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(new Response(null, { status: 404 }))
			.mockResolvedValueOnce(Response.json({ id: 1, results: {} }))
			.mockResolvedValueOnce(new Response(null, { status: 403 }));
		vi.stubGlobal("fetch", fetch);
		const service = new ShowsTmdbService(
			mockEnvironment({ TMDB_API_KEY: "test" }),
		);
		await expect(service.getUpNextAvailability("1", 2)).resolves.toEqual({
			id: 1,
			results: {},
		});
		await expect(service.getUpNextAvailability("1", 3)).rejects.toThrow(
			"Failed to fetch season availability",
		);
		expect(fetch).toHaveBeenCalledTimes(3);
	});
});

describe("Episode navigation", () => {
	it.each([
		{ episodeNumber: 4, previous: 2, next: 7 },
		{ episodeNumber: 5, previous: 4, next: 7 },
		{ episodeNumber: 1, previous: null, next: 2 },
		{ episodeNumber: 9, previous: 7, next: null },
	])(
		"finds neighbors of episode $episodeNumber in an unordered season",
		async ({ episodeNumber, previous, next }) => {
			const service = new ShowsTmdbService(
				mockEnvironment({ TMDB_API_KEY: "test" }),
			);
			vi.spyOn(service, "getShowDetails").mockResolvedValue({
				id: 1,
				name: "Show",
				number_of_seasons: 1,
				popularity: 0,
				vote_average: 0,
				vote_count: 0,
			});
			const episodes = [7, 2, 4].map((number) => ({
				id: number,
				name: `Episode ${number}`,
				season_number: 1,
				episode_number: number,
			}));
			vi.spyOn(service, "getSeasonDetails").mockResolvedValue({
				id: 1,
				name: "Season 1",
				season_number: 1,
				episodes,
			});

			await expect(
				service.getEpisodeContext("1", 1, episodeNumber),
			).resolves.toEqual({
				previous:
					previous === null
						? null
						: { seasonNumber: 1, episodeNumber: previous },
				next: next === null ? null : { seasonNumber: 1, episodeNumber: next },
			});
			expect(episodes.map((episode) => episode.episode_number)).toEqual([
				7, 2, 4,
			]);
		},
	);
});

describe("Season poster language", () => {
	afterEach(() => vi.unstubAllGlobals());

	it.each([
		{
			posters: [{ file_path: "/english.jpg", iso_639_1: "en" }],
			expected: "/english.jpg",
		},
		{
			posters: [{ file_path: "/neutral.jpg", iso_639_1: null }],
			expected: "/neutral.jpg",
		},
		{
			posters: [{ file_path: "/hebrew.jpg", iso_639_1: "he" }],
			expected: "/show.jpg",
		},
		{ posters: [], expected: "/show.jpg" },
		{
			posters: [
				{ file_path: "/neutral.jpg", iso_639_1: null },
				{ file_path: "/english.jpg", iso_639_1: "en" },
			],
			expected: "/english.jpg",
		},
	])(
		"uses suitable season artwork or lets clients fall back to the show: $expected",
		async ({ posters, expected }) => {
			const fetch = vi.fn(async (input: string) => {
				const path = new URL(input).pathname;
				if (path.endsWith("/images")) return Response.json({ posters });
				if (path.endsWith("/videos")) return Response.json({ results: [] });
				const season = {
					id: 1,
					name: "Season 1",
					season_number: 1,
					poster_path: "/hebrew.jpg",
				};
				return Response.json(
					path.endsWith("/season/1")
						? { ...season, episodes: [] }
						: { id: 334888, seasons: [season], poster_path: "/show.jpg" },
				);
			});
			vi.stubGlobal("fetch", fetch);
			const service = new ShowsTmdbService(
				mockEnvironment({ TMDB_API_KEY: "test" }),
			);
			const show = await service.getShowDetails("334888");
			const season = await service.getSeasonDetails("334888", 1);
			expect(show.seasons?.[0].poster_path).toBe(expected);
			expect(season.poster_path).toBe(expected);
			expect(
				fetch.mock.calls.filter(([url]) => url.includes("/images")),
			).toHaveLength(1);
		},
	);
});
