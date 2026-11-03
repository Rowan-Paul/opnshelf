import { describe, expect, it } from "vitest";
import { mediaPath } from "./notification-media-path";

describe("notification media paths", () => {
	it.each([
		["movies", "42", "A <Movie>", "/movies/42/a-lessmoviegreater"],
		["shows", "24", "Pokémon & Friends", "/shows/24/pokemon-and-friends"],
		["movies", "7", "!!!", "/movies/7/title"],
		["shows", "8", "", "/shows/8/title"],
	] as const)("builds %s paths for %s", (kind, id, title, expected) => {
		expect(mediaPath(kind, id, title)).toBe(expected);
	});
});
