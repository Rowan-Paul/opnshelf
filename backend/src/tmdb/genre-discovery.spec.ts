import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { mockEnvironment } from "../../test/env";
import { DiscoverMoviesDto } from "../movies/dto/movie.dto";
import { MoviesTmdbService } from "../movies/movies-tmdb.service";
import { DiscoverShowsDto } from "../shows/dto/show.dto";
import { ShowsTmdbService } from "../shows/shows-tmdb.service";

afterEach(() => vi.unstubAllGlobals());

it.each(["movie", "tv"])(
	"filters %s discovery by genre without reusing another genre's cache",
	async (type) => {
		const fetch = vi.fn(async (_url: string | URL | Request) =>
			Response.json({
				results: [],
				page: 2,
				total_pages: 3,
				total_results: 42,
			}),
		);
		vi.stubGlobal("fetch", fetch);
		const config = mockEnvironment({ TMDB_API_KEY: "test" });
		const movie = new MoviesTmdbService(config);
		const show = new ShowsTmdbService(config);
		const discover = (genre?: number) =>
			type === "movie"
				? movie.discoverMovies(undefined, 2, undefined, genre)
				: show.discoverShows(undefined, 2, undefined, genre);
		await discover(18);
		await discover(35);
		await discover();
		await discover(18);
		expect(fetch).toHaveBeenCalledTimes(3);
		const urls = fetch.mock.calls.map(([url]) => new URL(String(url)));
		expect(urls.map((url) => url.pathname)).toEqual(
			Array(3).fill(`/3/discover/${type}`),
		);
		expect(urls.map((url) => url.searchParams.get("with_genres"))).toEqual([
			"18",
			"35",
			null,
		]);
		expect(urls.every((url) => url.searchParams.get("page") === "2")).toBe(
			true,
		);
	},
);

it.each([DiscoverMoviesDto, DiscoverShowsDto])(
	"validates genre IDs for %s",
	async (Dto) => {
		for (const genreId of ["18", undefined])
			expect(await validate(plainToInstance(Dto, { genreId }))).toEqual([]);
		for (const genreId of ["-1", "0", "1.2", "bad", ["18", "35"]])
			expect(await validate(plainToInstance(Dto, { genreId }))).not.toEqual([]);
	},
);
