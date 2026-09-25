import { Logger } from "@nestjs/common";
import {
	MemoryTmdbCacheStore,
	TMDB_CACHE_MAX_ENTRIES,
	type TmdbCacheStore,
} from "./tmdb-cache.store";

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
 *  - Optionally cache idempotent GETs in a {@link TmdbCacheStore}: per-process
 *    memory by default, Redis when the app provides one (ADR 0041).
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
/**
 * TTL for reads that change slowly: movie, show, season, episode and person
 * details, credits, videos and watch providers. A day of staleness is the
 * accepted cost of a cache that survives deploys (ADR 0041).
 */
export const TMDB_DETAIL_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
/** TTL for ranked or query-shaped lists: search, discover, trending, recommendations. */
export const TMDB_LIST_CACHE_TTL_MS = 1000 * 60 * 60;
/** Default TTL when a caller does not classify its read. */
export const TMDB_CACHE_TTL_MS = TMDB_LIST_CACHE_TTL_MS;
export { TMDB_CACHE_MAX_ENTRIES };

export class MissingTmdbApiKeyError extends Error {
	constructor() {
		super(
			"TMDB_API_KEY is not configured. Set TMDB_API_KEY in the backend environment to enable TMDB requests.",
		);
		this.name = "MissingTmdbApiKeyError";
	}
}

/**
 * The requested TMDB resource genuinely does not exist (HTTP 404 / not-found).
 * PERMANENT: the id is invalid and will never resolve, so callers on the
 * firehose path should drop the record rather than redeliver it.
 *
 * Carries the original caller-facing message (e.g. "Movie not found") so
 * existing `.rejects.toThrow("Movie not found")` expectations and
 * import-history's substring-based classifier keep working unchanged.
 */
export class TmdbNotFoundError extends Error {
	constructor(
		message: string,
		readonly status?: number,
	) {
		super(message);
		this.name = "TmdbNotFoundError";
	}
}

/**
 * TMDB is unreachable or failing in a way that is not the record's fault: a
 * 5xx after the retry budget is exhausted, a request timeout, or a network
 * error. TRANSIENT: the same request may succeed later, so callers on the
 * firehose path should NOT ack (so Tab redelivers) instead of dropping.
 */
export class TmdbServiceError extends Error {
	constructor(
		message: string,
		readonly status?: number,
		readonly cause?: unknown,
	) {
		super(message);
		this.name = "TmdbServiceError";
	}
}

/**
 * Translate a non-ok {@link TmdbResponse} into a typed error a caller can throw.
 *
 * A 404 (and any other non-5xx 4xx, e.g. 422 invalid id) is a genuine
 * not-found → {@link TmdbNotFoundError} (permanent). A 5xx that survived the
 * client's retries is an upstream outage → {@link TmdbServiceError}
 * (transient). `message` is the caller's existing not-found message so logs
 * and the import-history classifier are unchanged.
 */
export function tmdbErrorForResponse(
	response: TmdbResponse,
	message: string,
): TmdbNotFoundError | TmdbServiceError {
	const status =
		typeof response.status === "number" ? response.status : undefined;
	if (status !== undefined && status >= 500) {
		return new TmdbServiceError(message, status);
	}
	return new TmdbNotFoundError(message, status);
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
 * Per-service TMDB HTTP client. Holds the resolved api key and a response
 * cache store. Without an explicit store each instance gets its own in-memory
 * one, so each test that builds a fresh service also gets a fresh cache — no
 * cross-test bleed. In the running app every service shares the store from
 * `TmdbCacheModule`, so a show cached by one service is a hit for the others.
 */
export class TmdbHttpClient {
	private readonly logger: Logger;
	private readonly store: TmdbCacheStore;
	/** Misses already on their way to TMDB, so concurrent callers share one request. */
	private readonly inFlight = new Map<
		string,
		Promise<TMDBCachedResult | null>
	>();

	constructor(
		private readonly apiKey: string,
		loggerContext = "TmdbHttpClient",
		store?: TmdbCacheStore,
	) {
		this.logger = new Logger(loggerContext);
		this.store = store ?? new MemoryTmdbCacheStore();
	}

	/** Clears the cache store. Exposed for tests / explicit invalidation. */
	clearCache(): Promise<void> {
		return this.store.clear();
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
				// Retries exhausted on a network/timeout failure: surface a typed
				// transient error so firehose callers can redeliver rather than drop.
				throw new TmdbServiceError(
					`TMDB request failed after ${TMDB_MAX_RETRIES} retries: ${error instanceof Error ? error.message : String(error)}`,
					undefined,
					error,
				);
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
		throw new TmdbServiceError(
			"TMDB request failed after retries",
			undefined,
			lastError,
		);
	}

	/**
	 * Cached variant of {@link fetch} for idempotent GETs. Caches the parsed
	 * JSON of successful responses under `cacheKey` for `ttlMs`. On a cache hit
	 * returns a synthetic ok response wrapping the cached JSON. Non-ok responses
	 * are not cached unless the caller supplies a JSON value for a 404. That
	 * value is cached and returned as a successful response for the same TTL.
	 *
	 * Opt-in: only call this from safe detail/search GETs.
	 */
	async fetchCached(
		url: string,
		cacheKey: string,
		ttlMs: number = TMDB_CACHE_TTL_MS,
		options?: { notFoundValue: Record<string, unknown> },
	): Promise<TmdbResponse> {
		const cached = await this.store.get(cacheKey);
		if (cached !== undefined) {
			return makeCachedResponse(cached);
		}

		const shared = this.inFlight.get(cacheKey);
		if (shared) {
			const data = await shared;
			if (data !== null) return makeCachedResponse(data);
			// The shared request failed; make our own so this caller gets the
			// real error response rather than a borrowed one.
			return this.fetch(url);
		}

		let settle!: (data: TMDBCachedResult | null) => void;
		this.inFlight.set(
			cacheKey,
			new Promise((resolve) => {
				settle = resolve;
			}),
		);
		try {
			const response = await this.fetch(url);
			if (response.ok || (response.status === 404 && options)) {
				const data = response.ok
					? await response.json<TMDBCachedResult>()
					: options?.notFoundValue;
				await this.store.set(cacheKey, data, ttlMs);
				settle(data);
				return makeCachedResponse(data);
			}
			settle(null);
			return response;
		} catch (error) {
			settle(null);
			throw error;
		} finally {
			this.inFlight.delete(cacheKey);
		}
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
