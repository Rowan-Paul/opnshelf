import { slugifyName } from "../../../packages/api/src/media-slug";
import { mediaPageUrl, slugifyMediaName } from "./reviews.service";

/**
 * These URLs go out in Bluesky Cross-posts and Blog Mirrors, so they are the
 * most visible URLs Opnshelf emits. They must match what the Web App and
 * Mobile App build (ADR 0023).
 */
describe("media page URLs", () => {
	const titles = [
		"Pokémon",
		"Amélie",
		"Léon: The Professional",
		"Marvel's Agents of S.H.I.E.L.D.",
		"WALL·E",
		"Spider-Man: No Way Home",
		"9-1-1",
		"",
	];

	// The backend cannot import @opnshelf/api, so its slug is a second copy.
	// This is the guard that stops the two drifting.
	it("slugs identically to @opnshelf/api", () => {
		for (const title of titles) {
			expect(slugifyMediaName(title)).toBe(slugifyName(title));
		}
	});

	it("slugs an episode URL from the show name, not the composite label", () => {
		expect(mediaPageUrl("episode", "1396", 1, 1, "Breaking Bad")).toContain(
			"/shows/1396/breaking-bad/seasons/1/episodes/1",
		);
	});

	it("transliterates rather than mangling accents", () => {
		expect(
			mediaPageUrl("show", "60572", undefined, undefined, "Pokémon"),
		).toContain("/shows/60572/pokemon");
	});
});
