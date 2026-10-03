import { NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseEnvironment } from "../config/env.schema";
import { MemoryTmdbCacheStore } from "../tmdb/tmdb-cache.store";
import { FeaturedCatalogService } from "./featured-catalog.service";

afterEach(() => vi.unstubAllGlobals());
const service = () =>
	new FeaturedCatalogService(
		parseEnvironment({ TMDB_API_KEY: "fixture-key" }),
		new MemoryTmdbCacheStore(),
	);
describe("Featured catalog validation", () => {
	it("looks up the exact season, including Specials, while retaining the show title", async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({ name: "Show title", poster_path: "/show.jpg" }),
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({ name: "Specials", poster_path: "/specials.jpg" }),
				),
			);
		vi.stubGlobal("fetch", fetch);
		expect(
			await service().resolve({
				mediaType: "season",
				mediaId: 12,
				seasonNumber: 0,
			}),
		).toEqual({ title: "Show title", posterPath: "/specials.jpg" });
		expect(fetch.mock.calls[1][0]).toContain("/tv/12/season/0?");
	});
	it.each([401, 403, 422])(
		"does not treat HTTP %i as a confirmed missing title",
		async (status) => {
			vi.stubGlobal(
				"fetch",
				vi.fn().mockResolvedValue(new Response(null, { status })),
			);
			await expect(
				service().resolve({ mediaType: "movie", mediaId: 12 }),
			).rejects.toBeInstanceOf(ServiceUnavailableException);
		},
	);
	it("recognizes a genuine missing catalog title", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
		);
		await expect(
			service().resolve({ mediaType: "movie", mediaId: 12 }),
		).rejects.toBeInstanceOf(NotFoundException);
	});
});
