import { describe, expect, it } from "vitest";
import { mediaHref, movieHref, personHref, showHref } from "./media-href";

/**
 * The Mobile App captures `opnshelf.xyz` links (ADR 0022), so these paths must
 * be exactly what the Web App serves (ADR 0023).
 *
 * This file exists because `as Href` casts silently bypass Expo's typed-route
 * union: the old `/show/[id]` paths survived a full rename with a clean
 * typecheck. String assertions catch what the compiler cannot.
 */
describe("media hrefs match the Web App's URL shapes", () => {
	it("builds movie and show paths with plural segments and a slug", () => {
		expect(movieHref(603, "The Matrix")).toBe("/movies/603/the-matrix");
		expect(showHref(1396, "Breaking Bad")).toBe("/shows/1396/breaking-bad");
		expect(personHref(287, "Brad Pitt")).toBe("/people/287/brad-pitt");
	});

	it("nests seasons and episodes under plural segments", () => {
		expect(showHref(1396, "Breaking Bad", 1)).toBe(
			"/shows/1396/breaking-bad/seasons/1",
		);
		expect(showHref(1396, "Breaking Bad", 1, 1)).toBe(
			"/shows/1396/breaking-bad/seasons/1/episodes/1",
		);
	});

	// The composite-label trap: mediaId is the show, so the slug is the show.
	it("slugs an episode from the show title, never the composite label", () => {
		expect(
			mediaHref({
				mediaType: "episode",
				mediaId: "1396",
				mediaTitle: "Breaking Bad",
				seasonNumber: 1,
				episodeNumber: 1,
			}),
		).toBe("/shows/1396/breaking-bad/seasons/1/episodes/1");
	});

	it("transliterates accents the same way the shared slug does", () => {
		expect(movieHref(1, "Amélie")).toBe("/movies/1/amelie");
		expect(showHref(2, "Pokémon")).toBe("/shows/2/pokemon");
	});

	it("keeps the reviewId query so the detail screen can scroll to it", () => {
		expect(
			mediaHref({
				mediaType: "movie",
				mediaId: "603",
				mediaTitle: "The Matrix",
				reviewId: "abc",
			}),
		).toBe("/movies/603/the-matrix?reviewId=abc");
	});

	// An empty slug segment would match no route, so a missing title still
	// yields a routable path.
	it("builds a routable path when the title is missing", () => {
		expect(mediaHref({ mediaType: "movie", mediaId: "603" })).toBe(
			"/movies/603/-",
		);
	});
});
