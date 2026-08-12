import { slugifyName } from "@opnshelf/api";
import { describe, expect, it } from "vitest";

/**
 * The Web App and the Mobile App must build byte-identical media URLs, so the
 * slug has exactly one definition (ADR 0023). These cases are the ones where
 * the hand-rolled `[^a-z0-9]+ -> "-"` version this replaced disagreed with it.
 */
describe("slugifyName", () => {
	it("transliterates accents instead of mangling them", () => {
		expect(slugifyName("Pokémon")).toBe("pokemon");
		expect(slugifyName("Amélie")).toBe("amelie");
		expect(slugifyName("Léon: The Professional")).toBe("leon-the-professional");
	});

	it("drops punctuation rather than turning it into hyphens", () => {
		expect(slugifyName("Marvel's Agents of S.H.I.E.L.D.")).toBe(
			"marvels-agents-of-shield",
		);
		expect(slugifyName("WALL·E")).toBe("walle");
	});

	it("keeps the cases that were already right", () => {
		expect(slugifyName("Spider-Man: No Way Home")).toBe(
			"spider-man-no-way-home",
		);
		expect(slugifyName("9-1-1")).toBe("9-1-1");
	});

	// An empty slug would collapse the URL to `/movies/603/`, matching no route.
	it("falls back to a placeholder segment rather than an empty one", () => {
		expect(slugifyName("")).toBe("-");
		expect(slugifyName("!!!")).toBe("-");
	});
});
