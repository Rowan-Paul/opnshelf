import { Logger } from "@nestjs/common";

/**
 * Shared HTTP plumbing for the TMDB v3 REST API.
 *
 * Responsibilities:
 *  - Fail fast with a descriptive error when TMDB_API_KEY is missing.
 *  - Apply a per-request timeout via AbortSignal.
 *  - Retry transient failures (network errors, 5xx) and 429 rate limits with
 *    bounded exponential backoff, honouring the Retry-After header when present.
 *  - Never retry other 4xx responses (e.g. 404 "not found"), so callers keep
 *    their existing not-found semantics.
 *  - Optionally cache idempotent GETs in a short-TTL in-memory cache.
 *
 * Auth note: this client uses TMDB v3 query-param auth (?api_key=). The
 * codebase only configures TMDB_API_KEY (v3). If a v4 read access token is
 * ever introduced, prefer it via an `Authorization: Bearer <token>` header and
 * drop the query param — that change is isolated to this file.
 */

export const TMDB_BASE_URL = "https://api.themoviedb.org/3";
export const TMDB_TIMEOUT_MS = 10_000;
export const TMDB_MAX_RETRIES = 3;
/** Base backoff in ms; doubled each attempt (200, 400, 800...). */
export const TMDB_BACKOFF_BASE_MS = 200;
/** Default TTL for cached detail/search GETs. */
export const TMDB_CACHE_TTL_MS = 1000 * 60 * 10;
/** Upper bound on entries per cache to avoid unbounded growth. */
export const TMDB_CACHE_MAX_ENTRIES = 500;

export class MissingTmdbApiKeyError extends Error {
	constructor() {
		super(
			"TMDB_API_KEY is not configured. Set TMDB_API_KEY in the backend environment to enable TMDB requests.",
		);
		this.name = "MissingTmdbApiKeyError";
	}
}

/**
 * Minimal shape the callers depend on. Mirrors the parts of the Fetch
 * `Response` the existing services already branch on (`ok`, `status`, `json`),
 * so existing `if (!response.ok) { ... }` blocks keep working unchanged and
 * jest mocks that only provide `{ ok, json }` remain compatible.
 */
export interface TmdbResponse {
	ok: boolean;
	status: number;
	headers?: { get?(name: string): string | null };
	json<T>(): Promise<T>;
}

interface CacheEntry {
	value: TMDBCachedResult;
	expiresAt: number;
}

/** Parsed JSON we may cache for a successful GET. */
type TMDBCachedResult = unknown;

const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Decide how long to wait before a retry. Prefers the server's Retry-After
 * header (seconds, or an HTTP date) and falls back to exponential backoff.
 */
function computeBackoffMs(
	attempt: number,
	retryAfterHeader: string | null | undefined,
): number {
	if (retryAfterHeader) {
		const asSeconds = Number(retryAfterHeader);
		if (Number.isFinite(asSeconds) && asSeconds >= 0) {
			return Math.min(asSeconds * 1000, 30_000);
		}
		const asDate = Date.parse(retryAfterHeader);
		if (!Number.isNaN(asDate)) {
			return Math.max(0, Math.min(asDate - Date.now(), 30_000));
		}
	}
	return TMDB_BACKOFF_BASE_MS * 2 ** attempt;
}

function getHeader(response: TmdbResponse, name: string): string | null {
	try {
		return response.headers?.get?.(name) ?? null;
	} catch {
		return null;
	}
}

/**
 * Per-service TMDB HTTP client. Holds the resolved api key and an optional
 * in-memory response cache. One instance per NestJS service (injected via the
 * service constructor), so each test that builds a fresh service also gets a
 * fresh cache — no cross-test bleed.
 */
export class TmdbHttpClient {
	private readonly logger: Logger;
	private readonly cache = new Map<string, CacheEntry>();

	constructor(
		private readonly apiKey: string,
		loggerContext = "TmdbHttpClient",
	) {
		this.logger = new Logger(loggerContext);
	}

	/** Clears the in-memory cache. Exposed for tests / explicit invalidation. */
	clearCache(): void {
		this.cache.clear();
	}

	private assertApiKey(): void {
		if (!this.apiKey) {
			throw new MissingTmdbApiKeyError();
		}
	}

	/**
	 * Perform a single fetch with a timeout. Returns a `TmdbResponse`-shaped
	 * object on an HTTP response, or throws on network error / timeout.
	 */
	private async fetchOnce(url: string): Promise<TmdbResponse> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), TMDB_TIMEOUT_MS);
		try {
			// Call the global fetch so jest mocks of global.fetch still apply.
			const response = (await fetch(url, {
				signal: controller.signal,
			})) as unknown as TmdbResponse;
			return response;
		} finally {
			clearTimeout(timer);
		}
	}

	/**
	 * Fetch a TMDB URL with retry/backoff. `url` must already include the
	 * api_key query param via {@link buildUrl}. Retries on network errors, 5xx
	 * and 429; does not retry other 4xx (so 404 not-found reaches the caller).
	 */
	async fetch(url: string): Promise<TmdbResponse> {
		this.assertApiKey();

		let lastError: unknown;
		for (let attempt = 0; attempt <= TMDB_MAX_RETRIES; attempt++) {
			let response: TmdbResponse | undefined;
			try {
				response = await this.fetchOnce(url);
			} catch (error) {
				// Network error or timeout abort — retryable.
				lastError = error;
				if (attempt < TMDB_MAX_RETRIES) {
					await sleep(computeBackoffMs(attempt, null));
					continue;
				}
				throw error;
			}

			// Only an explicit numeric status drives retry decisions. A response
			// without a status (e.g. a minimal test mock) is treated as terminal
			// so we never retry — and never consume extra queued mock responses.
			const status =
				typeof response.status === "number" ? response.status : undefined;

			// Retry on rate limit or transient server errors.
			if (status !== undefined && (status === 429 || status >= 500)) {
				if (attempt < TMDB_MAX_RETRIES) {
					const retryAfter =
						status === 429 ? getHeader(response, "retry-after") : null;
					this.logger.warn(
						`TMDB request to ${redactUrl(url)} returned ${status}; retrying (attempt ${attempt + 1}/${TMDB_MAX_RETRIES}).`,
					);
					await sleep(computeBackoffMs(attempt, retryAfter));
					continue;
				}
			}

			// Success or non-retryable 4xx — hand back to caller as-is.
			return response;
		}

		// Exhausted retries on a transient failure with no usable response.
		throw lastError instanceof Error
			? lastError
			: new Error("TMDB request failed after retries");
	}

	/**
	 * Cached variant of {@link fetch} for idempotent GETs. Caches the parsed
	 * JSON of successful responses under `cacheKey` for `ttlMs`. On a cache hit
	 * returns a synthetic ok response wrapping the cached JSON. Non-ok responses
	 * are never cached, preserving not-found semantics for callers.
	 *
	 * Opt-in: only call this from safe detail/search GETs.
	 */
	async fetchCached(
		url: string,
		cacheKey: string,
		ttlMs: number = TMDB_CACHE_TTL_MS,
	): Promise<TmdbResponse> {
		const now = Date.now();
		const cached = this.cache.get(cacheKey);
		if (cached && cached.expiresAt > now) {
			return makeCachedResponse(cached.value);
		}
		if (cached) {
			this.cache.delete(cacheKey);
		}

		const response = await this.fetch(url);
		if (response.ok) {
			const data = await response.json<TMDBCachedResult>();
			this.setCache(cacheKey, data, ttlMs);
			return makeCachedResponse(data);
		}
		return response;
	}

	private setCache(key: string, value: TMDBCachedResult, ttlMs: number): void {
		if (this.cache.size >= TMDB_CACHE_MAX_ENTRIES) {
			// Simple bound: drop the oldest inserted entry.
			const oldest = this.cache.keys().next().value;
			if (oldest !== undefined) {
				this.cache.delete(oldest);
			}
		}
		this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
	}
}

/** Wrap an already-parsed JSON value in a Response-like object. */
function makeCachedResponse(value: TMDBCachedResult): TmdbResponse {
	return {
		ok: true,
		status: 200,
		json: <T>() => Promise.resolve(value as T),
	};
}

/** Strip the api_key from a URL for safe logging. */
function redactUrl(url: string): string {
	return url.replace(/api_key=[^&]+/, "api_key=***");
}
