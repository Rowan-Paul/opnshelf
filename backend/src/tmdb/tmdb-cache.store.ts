import { Logger } from "@nestjs/common";

/**
 * Where `TmdbHttpClient.fetchCached` keeps parsed TMDB JSON.
 *
 * Two implementations: an in-process LRU map, which is the default and what
 * every unit test gets, and a Redis-backed store that survives deploys and
 * Staging sleeps (ADR 0041). Both are best-effort: a store never throws out
 * of `get` or `set`, so a cache outage degrades to live TMDB calls.
 */
export interface TmdbCacheStore {
	/** Resolves the cached value, or `undefined` on a miss or a store error. */
	get(key: string): Promise<unknown | undefined>;
	set(key: string, value: unknown, ttlMs: number): Promise<void>;
	/** Drops every entry this store owns. Exposed for tests / explicit invalidation. */
	clear(): Promise<void>;
}

/**
 * Upper bound on entries in the in-memory store. One detail page fills six to
 * ten keys, and crawlers walk dozens of Media Items a minute, so a smaller
 * cache turned over before a popular page was ever asked for twice.
 */
export const TMDB_CACHE_MAX_ENTRIES = 2000;

interface MemoryEntry {
	value: unknown;
	expiresAt: number;
}

/** Per-process LRU store. Iteration order of a Map is recency order. */
export class MemoryTmdbCacheStore implements TmdbCacheStore {
	private readonly entries = new Map<string, MemoryEntry>();

	constructor(private readonly maxEntries = TMDB_CACHE_MAX_ENTRIES) {}

	async get(key: string): Promise<unknown | undefined> {
		const entry = this.entries.get(key);
		if (!entry) return undefined;
		if (entry.expiresAt <= Date.now()) {
			this.entries.delete(key);
			return undefined;
		}
		// Re-insert so eviction drops the least recently used key, not the
		// oldest: popular Media Items stay cached through a crawl.
		this.entries.delete(key);
		this.entries.set(key, entry);
		return entry.value;
	}

	async set(key: string, value: unknown, ttlMs: number): Promise<void> {
		if (this.entries.size >= this.maxEntries && !this.entries.has(key)) {
			const oldest = this.entries.keys().next().value;
			if (oldest !== undefined) this.entries.delete(oldest);
		}
		this.entries.delete(key);
		this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
	}

	async clear(): Promise<void> {
		this.entries.clear();
	}
}

/**
 * The slice of an ioredis client the store uses. Kept minimal so tests can
 * pass a fake and so the store does not depend on ioredis types directly.
 */
export interface RedisLikeClient {
	get(key: string): Promise<string | null>;
	set(key: string, value: string, mode: "PX", ttlMs: number): Promise<unknown>;
	/** Delete every key matching a pattern; used only by `clear`. */
	keys(pattern: string): Promise<string[]>;
	del(...keys: string[]): Promise<number>;
}

export const TMDB_REDIS_KEY_PREFIX = "tmdb:";

/**
 * Redis-backed store. Fails open: any Redis error is logged once per outage
 * and treated as a miss (on `get`) or a no-op (on `set`), so the caller falls
 * through to a live TMDB request and the app behaves as it did before the
 * cache existed.
 */
export class RedisTmdbCacheStore implements TmdbCacheStore {
	private readonly logger = new Logger(RedisTmdbCacheStore.name);
	/** True while the last Redis call failed, so a long outage logs one warning. */
	private degraded = false;

	constructor(
		private readonly client: RedisLikeClient,
		private readonly prefix = TMDB_REDIS_KEY_PREFIX,
	) {}

	async get(key: string): Promise<unknown | undefined> {
		try {
			const raw = await this.client.get(this.prefix + key);
			this.recover();
			if (raw === null) return undefined;
			return JSON.parse(raw) as unknown;
		} catch (error) {
			this.degrade("read", error);
			return undefined;
		}
	}

	async set(key: string, value: unknown, ttlMs: number): Promise<void> {
		try {
			await this.client.set(
				this.prefix + key,
				JSON.stringify(value),
				"PX",
				Math.max(1, Math.round(ttlMs)),
			);
			this.recover();
		} catch (error) {
			this.degrade("write", error);
		}
	}

	async clear(): Promise<void> {
		try {
			const keys = await this.client.keys(`${this.prefix}*`);
			if (keys.length > 0) await this.client.del(...keys);
			this.recover();
		} catch (error) {
			this.degrade("clear", error);
		}
	}

	private degrade(operation: string, error: unknown): void {
		if (this.degraded) return;
		this.degraded = true;
		const message = error instanceof Error ? error.message : String(error);
		this.logger.warn(
			`Redis ${operation} failed; serving TMDB reads without the cache until it recovers: ${message}`,
		);
	}

	private recover(): void {
		if (!this.degraded) return;
		this.degraded = false;
		this.logger.log("Redis reachable again; TMDB cache restored");
	}
}
