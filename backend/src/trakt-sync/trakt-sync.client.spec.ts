import { afterEach, describe, expect, it, vi } from "vitest";
import { parseEnvironment } from "../config/env.schema";
import { normalizeRemote, TraktSyncClient } from "./trakt-sync.client";

const movie = {
	type: "movie",
	id: 41,
	watched_at: "unknown",
	movie: { title: "Fixture", ids: { trakt: 12, tmdb: 34 } },
};
const config = parseEnvironment({
	NODE_ENV: "test",
	TRAKT_API_KEY: "fixture",
	BACKEND_PUBLIC_URL: "http://localhost",
});
const page = (data: unknown, count = 1, pages = 1) => ({
	data,
	headers: new Headers({
		"x-pagination-item-count": String(count),
		"x-pagination-page-count": String(pages),
	}),
});

describe("Trakt transport boundaries", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});
	it("accepts an empty successful revocation response", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(null, { status: 200 })),
		);
		await expect(
			new TraktSyncClient(config).revoke("fixture"),
		).resolves.toBeUndefined();
	});
	it("paces separate accounts independently", async () => {
		vi.useFakeTimers();
		const fetcher = vi.fn(async () => new Response("{}"));
		vi.stubGlobal("fetch", fetcher);
		const client = new TraktSyncClient(config);
		await client.request("/users/settings", "account-a");
		const queued = client.request("/users/settings", "account-a");
		await client.request("/users/settings", "account-b");
		expect(fetcher).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(1100);
		await queued;
		expect(fetcher).toHaveBeenCalledTimes(3);
	});
	it("confirms known Watches by title and Ratings by category without reading full history", async () => {
		const client = new TraktSyncClient(config);
		const request = vi
			.spyOn(client, "request")
			.mockResolvedValue(page([movie]));
		await expect(
			client.readForRecord("fixture", normalizeRemote(movie, "watch")),
		).resolves.toHaveLength(1);
		expect(request).toHaveBeenLastCalledWith(
			"/sync/history/movies/12?page=1&limit=100",
			"fixture",
		);
		request.mockResolvedValue(page([], 0, 0));
		await client.readForRecord("fixture", {
			...normalizeRemote(movie, "watch"),
			kind: "rating",
		});
		expect(request).toHaveBeenLastCalledWith(
			"/sync/ratings/movies?page=1&limit=100",
			"fixture",
		);
	});
	it("resolves an exported episode using its parent TMDB ID and episode coordinates", async () => {
		const client = new TraktSyncClient(config);
		const request = vi
			.spyOn(client, "request")
			.mockResolvedValueOnce(
				page([{ type: "show", show: { ids: { trakt: 20, tmdb: 34 } } }]),
			)
			.mockResolvedValueOnce(page({ ids: { trakt: 88 }, season: 2, number: 3 }))
			.mockResolvedValueOnce(page([], 0, 0));
		await client.readForRecord("fixture", {
			...normalizeRemote(movie, "watch"),
			traktId: undefined,
			mediaType: "episode",
			season: 2,
			episode: 3,
		});
		expect(request.mock.calls.map((c) => c[0])).toEqual([
			"/search/tmdb/34?type=show",
			"/shows/20/seasons/2/episodes/3",
			"/sync/history/episodes/88?page=1&limit=100",
		]);
	});

	it("keeps unknown dates absent and separates event identity from media identity", () => {
		expect(normalizeRemote(movie, "watch")).toMatchObject({
			key: "watch:41",
			mediaId: "34",
			traktId: 12,
			value: null,
		});
		expect(() =>
			normalizeRemote({ ...movie, watched_at: "nonsense" }, "watch"),
		).toThrow();
	});
	it("uses the parent show TMDB ID for episode and season Ratings", () => {
		expect(
			normalizeRemote(
				{
					type: "episode",
					rating: 8,
					episode: { season: 2, number: 3, ids: { trakt: 6, tmdb: 7 } },
					show: { title: "Show", ids: { trakt: 8, tmdb: 9 } },
				},
				"rating",
			),
		).toMatchObject({
			mediaId: "9",
			traktId: 6,
			traktParentId: 8,
			season: 2,
			episode: 3,
			value: 8,
		});
	});
	it("rejects missing, changing, or truncated pagination instead of treating it as deletions", async () => {
		const client = new TraktSyncClient(config);
		const request = vi.spyOn(client, "request");
		request.mockResolvedValueOnce({ data: [], headers: new Headers() });
		await expect(
			client.pages("/sync/history", "fixture", "watch"),
		).rejects.toThrow("pagination");
		request
			.mockResolvedValueOnce(page([movie], 2, 2))
			.mockResolvedValueOnce(page([], 2, 2));
		await expect(
			client.pages("/sync/history", "fixture", "watch"),
		).rejects.toThrow("incomplete");
	});
	it("rejects a history snapshot when activity changed during its pages", async () => {
		const client = new TraktSyncClient(config);
		vi.spyOn(client, "pages").mockResolvedValue([]);
		vi.spyOn(client, "request")
			.mockResolvedValueOnce(page({ all: "before" }))
			.mockResolvedValueOnce(page({ all: "after" }));
		await expect(client.snapshot("fixture")).rejects.toThrow("changed during");
	});
	it("removes exactly one history event and preserves No date on outbound writes", async () => {
		const client = new TraktSyncClient(config);
		const request = vi.spyOn(client, "request").mockResolvedValue(page({}));
		const record = normalizeRemote(movie, "watch");
		await client.write("fixture", record, true);
		expect(request).toHaveBeenLastCalledWith(
			"/sync/history/remove",
			"fixture",
			{ ids: [41] },
		);
		await client.write("fixture", record);
		expect(request).toHaveBeenLastCalledWith("/sync/history", "fixture", {
			movies: [{ ids: { trakt: 12 }, watched_at: "unknown" }],
		});
	});
	it("reports unmatched writes as unresolved", async () => {
		const client = new TraktSyncClient(config);
		vi.spyOn(client, "request").mockResolvedValue(
			page({ not_found: { movies: [{ ids: { tmdb: 34 } }] } }),
		);
		await expect(
			client.write("fixture", normalizeRemote(movie, "watch")),
		).rejects.toThrow("could not match");
	});
});
