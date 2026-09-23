import { afterEach, describe, expect, it, vi } from "vitest";
import { TMDB_CACHE_MAX_ENTRIES, TmdbHttpClient } from "./tmdb-http";

function jsonResponse(body: unknown, status = 200) {
	return {
		ok: status >= 200 && status < 300,
		status,
		headers: { get: () => null },
		json: () => Promise.resolve(body),
	};
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("TmdbHttpClient.fetchCached", () => {
	it("shares one TMDB request between concurrent misses on the same key", async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 1399 }));
		vi.stubGlobal("fetch", fetchMock);
		const client = new TmdbHttpClient("key");

		const [a, b] = await Promise.all([
			client.fetchCached("https://tmdb/tv/1399", "tv:detail:1399"),
			client.fetchCached("https://tmdb/tv/1399", "tv:detail:1399"),
		]);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(await a.json()).toEqual({ id: 1399 });
		expect(await b.json()).toEqual({ id: 1399 });
	});

	it("gives each waiter its own error response when the shared request fails", async () => {
		const fetchMock = vi
			.fn()
			.mockImplementation(() =>
				Promise.resolve(jsonResponse({ status_message: "nope" }, 404)),
			);
		vi.stubGlobal("fetch", fetchMock);
		const client = new TmdbHttpClient("key");

		const [a, b] = await Promise.all([
			client.fetchCached("https://tmdb/tv/0", "tv:detail:0"),
			client.fetchCached("https://tmdb/tv/0", "tv:detail:0"),
		]);

		expect(a.status).toBe(404);
		expect(b.status).toBe(404);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("evicts the least recently used key, keeping ones that are still read", async () => {
		const fetchMock = vi
			.fn()
			.mockImplementation((url: string) =>
				Promise.resolve(jsonResponse({ url })),
			);
		vi.stubGlobal("fetch", fetchMock);
		const client = new TmdbHttpClient("key");

		await client.fetchCached("https://tmdb/hot", "hot");
		for (let i = 1; i < TMDB_CACHE_MAX_ENTRIES; i++) {
			await client.fetchCached(`https://tmdb/${i}`, `key:${i}`);
		}
		// Reading "hot" makes key:1 the least recently used entry.
		await client.fetchCached("https://tmdb/hot", "hot");
		await client.fetchCached("https://tmdb/overflow", "overflow");
		fetchMock.mockClear();

		await client.fetchCached("https://tmdb/hot", "hot");
		expect(fetchMock).not.toHaveBeenCalled();
		await client.fetchCached("https://tmdb/1", "key:1");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
