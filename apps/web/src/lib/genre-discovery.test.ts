import { genreDiscoverySearch, parseGenreDiscovery } from "@opnshelf/api";
import { describe, expect, it } from "vitest";
import { searchRouteSchema } from "./search-results";

describe("genre discovery URLs", () => {
	it.each([
		"movie",
		"show",
	] as const)("preserves genre and %s catalogue across Web and Mobile params", (type) => {
		const search = genreDiscoverySearch(type, { id: 18, name: "Drama" });
		const params = Object.fromEntries(
			new URLSearchParams(
				Object.entries(search).map(([key, value]) => [key, String(value)]),
			),
		);
		expect(parseGenreDiscovery(params)).toEqual(search);
		expect(parseGenreDiscovery(searchRouteSchema.parse(params))).toEqual(
			search,
		);
		expect(search.type).toBe(type === "movie" ? "movies" : "shows");
	});
	it.each([
		{},
		{ genre: 18 },
		{ genre: 18, type: "all" },
		{ genre: -1, type: "movies" },
		{ genre: "bad", type: "movies" },
		{ genre: [18, 35], type: "movies" },
	])("does not browse an invalid or unscoped genre: %j", (params) => {
		expect(parseGenreDiscovery(params)).toBeUndefined();
	});
});
