import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	MemoryTmdbCacheStore,
	type RedisLikeClient,
	RedisTmdbCacheStore,
	TMDB_REDIS_KEY_PREFIX,
} from "./tmdb-cache.store";
import { TmdbHttpClient } from "./tmdb-http";

function fakeRedis(): RedisLikeClient & { data: Map<string, string> } {
	const data = new Map<string, string>();
	return {
		data,
		get: vi.fn(async (key: string) => data.get(key) ?? null),
		set: vi.fn(async (key: string, value: string) => {
			data.set(key, value);
			return "OK";
		}),
		keys: vi.fn(async (pattern: string) =>
			[...data.keys()].filter((k) => k.startsWith(pattern.replace("*", ""))),
		),
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
		const store = new RedisTmdbCacheStore(redis);

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
});

describe("MemoryTmdbCacheStore", () => {
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
