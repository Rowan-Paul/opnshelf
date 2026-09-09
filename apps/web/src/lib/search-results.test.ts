import type { UnifiedSearchResultDto } from "@opnshelf/api";
import { describe, expect, it } from "vitest";
import {
	buildSearchLocation,
	collectShownKeys,
	dedupeResults,
	getBackdropUrl,
	getCastTotalPages,
	getPosterUrl,
	getSearchTotalPages,
	getTitle,
	hasResultsForTab,
	isSearchTab,
	isSearchTabLoading,
	mediaKey,
	resolveSearchTab,
	SEARCH_TABS,
	searchLocationNeedsUpdate,
	searchRouteSchema,
	splitByMediaType,
	toRatingItems,
	toUnifiedResult,
	toUnseenDiscoverItems,
} from "./search-results";

function result(
	overrides: Partial<UnifiedSearchResultDto> & {
		id: number;
		media_type: "movie" | "tv";
	},
): UnifiedSearchResultDto {
	return { popularity: 0, vote_average: 0, vote_count: 0, ...overrides };
}

describe("searchRouteSchema", () => {
	it("defaults page to 1 when params are missing", () => {
		expect(searchRouteSchema.parse({})).toEqual({ page: 1 });
	});

	it("coerces a page string from the URL", () => {
		expect(
			searchRouteSchema.parse({ q: "dune", type: "movies", page: "3" }),
		).toEqual({ q: "dune", type: "movies", page: 3 });
	});

	it("rejects a page below one or not a number", () => {
		expect(() => searchRouteSchema.parse({ page: "0" })).toThrow();
		expect(() => searchRouteSchema.parse({ page: "-2" })).toThrow();
		expect(() => searchRouteSchema.parse({ page: "abc" })).toThrow();
	});

	it("keeps an unknown type so the route can resolve it to All", () => {
		expect(searchRouteSchema.parse({ type: "bogus" }).type).toBe("bogus");
	});
});

describe("resolveSearchTab", () => {
	it("accepts every known tab", () => {
		for (const tab of SEARCH_TABS) {
			expect(resolveSearchTab(tab)).toBe(tab);
			expect(isSearchTab(tab)).toBe(true);
		}
	});

	it("falls back to All for missing, empty, or unknown values", () => {
		expect(resolveSearchTab(undefined)).toBe("all");
		expect(resolveSearchTab("")).toBe("all");
		expect(resolveSearchTab("Movies")).toBe("all");
		expect(resolveSearchTab("bogus")).toBe("all");
		expect(isSearchTab(null)).toBe(false);
	});
});

describe("buildSearchLocation", () => {
	it("returns undefined for the all-default state", () => {
		expect(buildSearchLocation({ query: "", tab: "all", page: 1 })).toBe(
			undefined,
		);
	});

	it("drops every default and keeps the rest", () => {
		expect(buildSearchLocation({ query: "dune", tab: "all", page: 1 })).toEqual(
			{ q: "dune" },
		);
		expect(buildSearchLocation({ query: "", tab: "cast", page: 1 })).toEqual({
			type: "cast",
		});
		expect(buildSearchLocation({ query: "", tab: "all", page: 2 })).toEqual({
			page: 2,
		});
		expect(
			buildSearchLocation({ query: "dune", tab: "shows", page: 4 }),
		).toEqual({ q: "dune", type: "shows", page: 4 });
	});
});

describe("searchLocationNeedsUpdate", () => {
	it("is false when local state already matches the URL", () => {
		expect(
			searchLocationNeedsUpdate(
				{ query: "dune", tab: "movies", page: 2 },
				{ q: "dune", type: "movies", page: 2 },
			),
		).toBe(false);
		expect(
			searchLocationNeedsUpdate(
				{ query: "", tab: "all", page: 1 },
				{ page: 1 },
			),
		).toBe(false);
	});

	it("treats missing and default URL values as equal to local defaults", () => {
		expect(
			searchLocationNeedsUpdate(
				{ query: "", tab: "all", page: 1 },
				{ q: "", type: "", page: 1 },
			),
		).toBe(false);
	});

	it("is true when the query, tab, or page differs", () => {
		expect(
			searchLocationNeedsUpdate(
				{ query: "dune", tab: "all", page: 1 },
				{ page: 1 },
			),
		).toBe(true);
		expect(
			searchLocationNeedsUpdate(
				{ query: "", tab: "people", page: 1 },
				{ page: 1 },
			),
		).toBe(true);
		expect(
			searchLocationNeedsUpdate(
				{ query: "", tab: "all", page: 3 },
				{ page: 1 },
			),
		).toBe(true);
	});

	it("rewrites an unknown type in the URL back to All", () => {
		expect(
			searchLocationNeedsUpdate(
				{ query: "", tab: "all", page: 1 },
				{ type: "bogus", page: 1 },
			),
		).toBe(true);
	});
});

describe("titles and images", () => {
	it("prefers the movie title, then the show name, then Unknown", () => {
		expect(
			getTitle(result({ id: 1, media_type: "movie", title: "Dune" })),
		).toBe("Dune");
		expect(
			getTitle(result({ id: 1, media_type: "tv", name: "Severance" })),
		).toBe("Severance");
		expect(getTitle(result({ id: 1, media_type: "tv", title: "" }))).toBe(
			"Unknown",
		);
	});

	it("builds TMDB image URLs and stays empty without a path", () => {
		const withImages = result({
			id: 1,
			media_type: "movie",
			poster_path: "/p.jpg",
			backdrop_path: "/b.jpg",
		});
		expect(getPosterUrl(withImages)).toBe(
			"https://image.tmdb.org/t/p/w500/p.jpg",
		);
		expect(getBackdropUrl(withImages)).toBe(
			"https://image.tmdb.org/t/p/original/b.jpg",
		);

		const bare = result({ id: 1, media_type: "movie" });
		expect(getPosterUrl(bare)).toBe("");
		expect(getBackdropUrl(bare)).toBeUndefined();
	});
});

describe("toUnifiedResult", () => {
	it("widens a movie into the unified shape", () => {
		expect(
			toUnifiedResult(
				{
					id: 5,
					title: "Dune",
					poster_path: "/p.jpg",
					release_date: "2026-10-01",
					overview: "Sand.",
					vote_average: 8.1,
				},
				"movie",
			),
		).toEqual({
			id: 5,
			media_type: "movie",
			title: "Dune",
			name: undefined,
			poster_path: "/p.jpg",
			backdrop_path: undefined,
			release_date: "2026-10-01",
			first_air_date: undefined,
			overview: "Sand.",
			popularity: 0,
			vote_average: 8.1,
			vote_count: 0,
		});
	});

	it("widens a show and defaults a missing rating to zero", () => {
		const unified = toUnifiedResult(
			{ id: 9, name: "Severance", first_air_date: "2022-02-18" },
			"tv",
		);
		expect(unified.media_type).toBe("tv");
		expect(unified.name).toBe("Severance");
		expect(unified.title).toBeUndefined();
		expect(unified.first_air_date).toBe("2022-02-18");
		expect(unified.vote_average).toBe(0);
	});
});

describe("dedupeResults / mediaKey", () => {
	it("keys by media type and id", () => {
		expect(mediaKey({ id: 3, media_type: "tv" })).toBe("tv-3");
	});

	it("keeps the first of repeated ids but allows the same id across types", () => {
		const movie = result({ id: 1, media_type: "movie", title: "first" });
		const dupe = result({ id: 1, media_type: "movie", title: "second" });
		const show = result({ id: 1, media_type: "tv" });
		expect(dedupeResults([movie, dupe, show])).toEqual([movie, show]);
	});

	it("passes an empty list through", () => {
		expect(dedupeResults([])).toEqual([]);
	});
});

describe("discover rows", () => {
	it("collects keys across rows and hides already-shown titles", () => {
		const shown = collectShownKeys([
			[result({ id: 1, media_type: "movie" })],
			[],
			[
				result({ id: 2, media_type: "tv" }),
				result({ id: 3, media_type: "movie" }),
			],
		]);
		expect(shown).toEqual(new Set(["movie-1", "tv-2", "movie-3"]));

		const movies = toUnseenDiscoverItems(
			[
				{ id: 1, title: "Shown" },
				{ id: 2, title: "Same id, other type" },
				{ id: 4, title: "Fresh" },
			],
			"movie",
			shown,
		);
		expect(movies.map((m) => [m.id, m.media_type, m.title])).toEqual([
			[2, "movie", "Same id, other type"],
			[4, "movie", "Fresh"],
		]);

		const shows = toUnseenDiscoverItems(
			[
				{ id: 2, name: "Shown" },
				{ id: 5, name: "Fresh" },
			],
			"tv",
			shown,
		);
		expect(shows.map((s) => s.id)).toEqual([5]);
	});

	it("shows everything when nothing has been shown yet", () => {
		expect(
			toUnseenDiscoverItems([{ id: 1, title: "A" }], "movie", new Set()),
		).toHaveLength(1);
		expect(toUnseenDiscoverItems([], "movie", new Set())).toEqual([]);
	});
});

describe("result shaping", () => {
	const results = [
		result({ id: 1, media_type: "movie" }),
		result({ id: 2, media_type: "tv" }),
		result({ id: 3, media_type: "movie" }),
	];

	it("splits movies from shows preserving order", () => {
		expect(splitByMediaType(results)).toEqual({
			movies: [results[0], results[2]],
			shows: [results[1]],
		});
		expect(splitByMediaType([])).toEqual({ movies: [], shows: [] });
	});

	it("maps results to the ratings query shape", () => {
		expect(toRatingItems(results)).toEqual([
			{ id: 1, type: "movie" },
			{ id: 2, type: "show" },
			{ id: 3, type: "movie" },
		]);
	});
});

describe("hasResultsForTab", () => {
	const none = { movies: 0, shows: 0, people: 0, cast: 0 };

	it("is false everywhere with no results", () => {
		for (const tab of SEARCH_TABS) {
			expect(hasResultsForTab(tab, none)).toBe(false);
		}
	});

	it("checks only the active tab's collection", () => {
		expect(hasResultsForTab("movies", { ...none, movies: 1 })).toBe(true);
		expect(hasResultsForTab("movies", { ...none, shows: 1 })).toBe(false);
		expect(hasResultsForTab("shows", { ...none, shows: 1 })).toBe(true);
		expect(hasResultsForTab("people", { ...none, people: 1 })).toBe(true);
		expect(hasResultsForTab("people", { ...none, cast: 1 })).toBe(false);
		expect(hasResultsForTab("cast", { ...none, cast: 1 })).toBe(true);
	});

	it("counts movies or shows for All, but not people or cast", () => {
		expect(hasResultsForTab("all", { ...none, shows: 1 })).toBe(true);
		expect(hasResultsForTab("all", { ...none, movies: 1 })).toBe(true);
		expect(hasResultsForTab("all", { ...none, people: 1, cast: 1 })).toBe(
			false,
		);
	});
});

describe("isSearchTabLoading", () => {
	const idle = {
		isAuthenticated: true,
		isSearching: false,
		isSearchingPeople: false,
		isSearchingCast: false,
	};

	it("always waits on the main search", () => {
		expect(
			isSearchTabLoading({ ...idle, tab: "cast", isSearching: true }),
		).toBe(true);
	});

	it("waits on the Users search only on its tab and only when signed in", () => {
		expect(
			isSearchTabLoading({ ...idle, tab: "people", isSearchingPeople: true }),
		).toBe(true);
		expect(
			isSearchTabLoading({ ...idle, tab: "all", isSearchingPeople: true }),
		).toBe(false);
		expect(
			isSearchTabLoading({
				...idle,
				tab: "people",
				isSearchingPeople: true,
				isAuthenticated: false,
			}),
		).toBe(false);
	});

	it("waits on the Cast search only on its tab", () => {
		expect(
			isSearchTabLoading({ ...idle, tab: "cast", isSearchingCast: true }),
		).toBe(true);
		expect(
			isSearchTabLoading({ ...idle, tab: "movies", isSearchingCast: true }),
		).toBe(false);
	});
});

describe("page counts", () => {
	it("rounds the multi-search total up to whole pages, never below one", () => {
		expect(getSearchTotalPages(undefined)).toBe(1);
		expect(getSearchTotalPages(0)).toBe(1);
		expect(getSearchTotalPages(20)).toBe(1);
		expect(getSearchTotalPages(21)).toBe(2);
		expect(getSearchTotalPages(199)).toBe(10);
	});

	it("passes the cast page count through with a floor of one", () => {
		expect(getCastTotalPages(undefined)).toBe(1);
		expect(getCastTotalPages(0)).toBe(1);
		expect(getCastTotalPages(7)).toBe(7);
	});
});
