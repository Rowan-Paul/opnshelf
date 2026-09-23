import { describe, expect, it } from "vitest";
import {
	PUBLIC_MEDIA_CACHE_CONTROL,
	publicMediaPageHeaders,
} from "./cache-control";

describe("publicMediaPageHeaders", () => {
	it("allows shared caching for anonymous SSR", () => {
		expect(publicMediaPageHeaders(true, false)).toEqual({
			"Cache-Control": PUBLIC_MEDIA_CACHE_CONTROL,
		});
	});

	it("disables caching when SSR can resolve a session", () => {
		expect(publicMediaPageHeaders(true, true)).toEqual({
			"Cache-Control": "private, no-store",
		});
	});

	it("disables caching when the route loader has no public content", () => {
		expect(publicMediaPageHeaders(false, false)).toEqual({
			"Cache-Control": "private, no-store",
		});
	});
});
