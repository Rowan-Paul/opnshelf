import { describe, expect, it } from "vitest";
import { backdropSrcSet, posterSrcSet } from "./tmdb-image";

describe("TMDB srcsets", () => {
	it("offers smaller posters for a w500 poster", () => {
		expect(posterSrcSet("https://image.tmdb.org/t/p/w500/a.jpg")).toBe(
			"https://image.tmdb.org/t/p/w185/a.jpg 185w, https://image.tmdb.org/t/p/w342/a.jpg 342w, https://image.tmdb.org/t/p/w500/a.jpg 500w",
		);
	});

	it("offers w780 for a w1280 backdrop", () => {
		expect(backdropSrcSet("https://image.tmdb.org/t/p/w1280/b.jpg")).toBe(
			"https://image.tmdb.org/t/p/w780/b.jpg 780w, https://image.tmdb.org/t/p/w1280/b.jpg 1280w",
		);
	});

	it("leaves other sizes and hosts alone", () => {
		expect(
			posterSrcSet("https://image.tmdb.org/t/p/w300/a.jpg"),
		).toBeUndefined();
		expect(
			backdropSrcSet("https://image.tmdb.org/t/p/w780/a.jpg"),
		).toBeUndefined();
		expect(backdropSrcSet("/hero.jpg")).toBeUndefined();
		expect(backdropSrcSet("")).toBeUndefined();
	});
});
