import { getWatchProviderLink } from "@opnshelf/api";
import { describe, expect, it } from "vitest";

describe("getWatchProviderLink", () => {
	it("opens a known service even when TMDB provides no watch page", () => {
		expect(getWatchProviderLink(337)).toBe("https://www.disneyplus.com/");
	});

	it("does not invent a destination for an unknown provider", () => {
		expect(getWatchProviderLink(999999)).toBeUndefined();
	});

	it("preserves the country and title on an unknown provider fallback", () => {
		const fallback = "https://www.themoviedb.org/movie/1/watch?locale=NL";
		expect(getWatchProviderLink(999999, fallback)).toBe(fallback);
	});

	it("does not send an Amazon add-on subscriber to the standalone service", () => {
		expect(getWatchProviderLink(582)).toBe("https://www.primevideo.com/");
		expect(getWatchProviderLink(531)).toBe("https://www.paramountplus.com/");
	});
});
