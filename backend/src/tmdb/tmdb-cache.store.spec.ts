import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	jitterTtl,
	MemoryTmdbCacheStore,
	type RedisLikeClient,
	RedisTmdbCacheStore,
	TMDB_REDIS_KEY_PREFIX,
} from "./tmdb-cache.store";
import { TmdbHttpClient } from "./tmdb-http";

function fakeRedis(): RedisLikeClient & { data: Map<string, string> } {
	const data = new Map<string, string>();
	let snapshot: string[] = [];
	return {
		data,
		get: vi.fn(async (key: string) => data.get(key) ?? null),
		set: vi.fn(async (key: string, value: string) => {
			data.set(key, value);
			return "OK";
		}),
		// Pages two keys at a time so `clear` has to follow the cursor. Like real
		// SCAN, deleting already-returned keys does not shift later pages.
		scan: vi.fn(async (cursor: string, _m, pattern: string) => {
			if (cursor === "0")
				snapshot = [...data.keys()].filter((k) =>
					k.startsWith(pattern.replace("*", "")),
				);
			const matching = snapshot;
			const start = Number(cursor);
			const next = start + 2 >= matching.length ? "0" : String(start + 2);
			return [next, matching.slice(start, start + 2)] as [string, string[]];
		}),
		del: vi.fn(async (...keys: string[]) => {
			for (const k of keys) data.delete(k);
			return keys.length;
		}),
	};
}

function jsonResponse(body: unknown, status = 200) {
	return {
		ok: status >= 200 && status < 300,
		status,
		headers: { get: () => null },
		json: () => Promise.resolve(body),
	};
}

describe("RedisTmdbCacheStore", () => {
	let warn: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
		vi.spyOn(Logger.prototype, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("round-trips JSON under a prefixed key with a millisecond TTL", async () => {
		const redis = fakeRedis();
		const store = new RedisTmdbCacheStore(redis, undefined, () => 0.5);

		await store.set("tv:detail:1399", { id: 1399 }, 86_400_000);

		expect(redis.set).toHaveBeenCalledWith(
			`${TMDB_REDIS_KEY_PREFIX}tv:detail:1399`,
			JSON.stringify({ id: 1399 }),
			"PX",
			86_400_000,
		);
		expect(await store.get("tv:detail:1399")).toEqual({ id: 1399 });
		expect(await store.get("tv:detail:missing")).toBeUndefined();
	});

	it("spreads TTLs by up to 10% either way so a fan-out does not expire at once", () => {
		expect(jitterTtl(1000, () => 0)).toBe(900);
		expect(jitterTtl(1000, () => 0.5)).toBe(1000);
		expect(jitterTtl(1000, () => 0.999_999)).toBe(1100);
		expect(jitterTtl(0, () => 0)).toBe(1);
	});

	it("clears only its own prefix by walking the keyspace with SCAN", async () => {
		const redis = fakeRedis();
		const store = new RedisTmdbCacheStore(redis);
		for (const key of ["a", "b", "c", "d", "e"]) await store.set(key, 1, 1000);
		redis.data.set("other:keep", "1");

		await store.clear();

		expect([...redis.data.keys()]).toEqual(["other:keep"]);
		expect(redis.scan).toHaveBeenCalledTimes(3);
	});

	it("treats a failing read as a miss and a failing write as a no-op", async () => {
		const redis = fakeRedis();
		vi.mocked(redis.get).mockRejectedValue(new Error("ECONNREFUSED"));
		vi.mocked(redis.set).mockRejectedValue(new Error("ECONNREFUSED"));
		const store = new RedisTmdbCacheStore(redis);

		await expect(store.get("k")).resolves.toBeUndefined();
		await expect(store.set("k", 1, 1000)).resolves.toBeUndefined();
	});

	it("logs one warning per outage and one recovery", async () => {
		const redis = fakeRedis();
		vi.mocked(redis.get).mockRejectedValue(new Error("down"));
		const store = new RedisTmdbCacheStore(redis);

		await store.get("a");
		await store.get("b");
		await store.get("c");
		expect(warn).toHaveBeenCalledTimes(1);

		vi.mocked(redis.get).mockResolvedValue(null);
		await store.get("d");
		vi.mocked(redis.get).mockRejectedValue(new Error("down again"));
		await store.get("e");
		expect(warn).toHaveBeenCalledTimes(2);
	});

	it("falls through to TMDB when Redis is down and keeps serving", async () => {
		const redis = fakeRedis();
		vi.mocked(redis.get).mockRejectedValue(new Error("down"));
		vi.mocked(redis.set).mockRejectedValue(new Error("down"));
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 7 }));
		vi.stubGlobal("fetch", fetchMock);
		const client = new TmdbHttpClient(
			"key",
			"test",
			new RedisTmdbCacheStore(redis),
		);

		const first = await client.fetchCached("https://tmdb/tv/7", "tv:detail:7");
		const second = await client.fetchCached("https://tmdb/tv/7", "tv:detail:7");

		expect(await first.json()).toEqual({ id: 7 });
		expect(await second.json()).toEqual({ id: 7 });
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("is shared across clients so one service's fetch is another's hit", async () => {
		const redis = fakeRedis();
		const store = new RedisTmdbCacheStore(redis);
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 7 }));
		vi.stubGlobal("fetch", fetchMock);
		const shows = new TmdbHttpClient("key", "shows", store);
		const discover = new TmdbHttpClient("key", "discover", store);

		await shows.fetchCached("https://tmdb/tv/7", "tv:detail:7");
		await discover.fetchCached("https://tmdb/tv/7", "tv:detail:7");

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("coalesces concurrent misses across clients sharing a store", async () => {
		const store = new RedisTmdbCacheStore(fakeRedis());
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 7 }));
		vi.stubGlobal("fetch", fetchMock);
		const shows = new TmdbHttpClient("key", "shows", store);
		const discover = new TmdbHttpClient("key", "discover", store);

		await Promise.all([
			shows.fetchCached("https://tmdb/tv/7", "tv:detail:7"),
			discover.fetchCached("https://tmdb/tv/7", "tv:detail:7"),
		]);

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});

describe("MemoryTmdbCacheStore", () => {
	it("hands out copies, so mutating a result cannot corrupt the cache", async () => {
		const store = new MemoryTmdbCacheStore();
		const original = { results: [3, 1, 2] };
		await store.set("k", original, 1000);
		original.results.push(4);

		const first = (await store.get("k")) as { results: number[] };
		first.results.sort();

		expect(await store.get("k")).toEqual({ results: [3, 1, 2] });
	});

	it("expires entries after their TTL", async () => {
		vi.useFakeTimers();
		try {
			const store = new MemoryTmdbCacheStore();
			await store.set("k", 1, 1000);
			expect(await store.get("k")).toBe(1);
			vi.advanceTimersByTime(1001);
			expect(await store.get("k")).toBeUndefined();
		} finally {
			vi.useRealTimers();
		}
	});
});
