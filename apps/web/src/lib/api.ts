import { configureApiClient, setDeviceIdentity } from "@opnshelf/api";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { env } from "#/env";
import { browserDeviceIdentity } from "./device";

/**
 * The subset of API call options this helper overrides. Using only `fetch`
 * (rather than the full `Options` type) keeps the result assignable to every
 * endpoint's `Options<TData>`, since `fetch` is a common optional field and is
 * not part of the generated query key.
 */
type SsrAuthOptions = { fetch?: typeof globalThis.fetch };

let configured = false;

/**
 * Configure the shared API client exactly once, at app/server bootstrap.
 *
 * Called from `router.tsx#getRouter()`, which runs at the start of every SSR
 * request and once on the client. This guarantees the base URL is correct on
 * the very first SSR request, before any route module loads — fixing the
 * order-dependent localhost fallback that happened when configuration relied on
 * per-route import side-effects.
 *
 * The base URL is a stable, request-independent env value, so writing it to the
 * process-global client config once is concurrency-safe.
 */
export function setupApiClient() {
	if (configured) {
		return { apiUrl: env.VITE_API_URL };
	}
	configured = true;

	const apiUrl = env.VITE_API_URL;
	configureApiClient(apiUrl);

	// Claim this browser profile as a Device (ADR-0015). Browser-only: there's no
	// localStorage during SSR, and the stamp only needs to happen once per client.
	if (typeof window !== "undefined") {
		setDeviceIdentity(browserDeviceIdentity());
	}

	return { apiUrl };
}

/**
 * Per-request options for an API call made during an SSR render that needs the
 * caller's session.
 *
 * Concurrency safety: there is no ambient cookie jar on the server, so we
 * forward the incoming request's `Cookie` header. We deliberately do NOT pass
 * it via `headers` — `createQueryKey()` folds `options.headers` into the query
 * key, which would make the SSR key diverge from the client's
 * `authControllerMeOptions()` key and break dehydration/hydration matching
 * (causing the exact client refetch flash we're fixing). Instead we inject the
 * cookie through a per-call `fetch` wrapper, which is part of `Options` but is
 * NOT included in the query key. The wrapper is created fresh per call and
 * closes over this request's cookie, so it never mutates the shared client and
 * cannot leak into another concurrent SSR request.
 *
 * On the client this returns no override; the global `credentials: 'include'`
 * config sends cookies automatically, keeping browser behavior identical.
 */
export const ssrAuthOptions = createIsomorphicFn()
	.server((): SsrAuthOptions => {
		const cookie = getRequestHeader("cookie");
		if (!cookie) {
			return {};
		}
		return {
			fetch: ((input: RequestInfo | URL, init?: RequestInit) => {
				const request = new Request(input, init);
				// Only set if the caller didn't already provide one.
				if (!request.headers.has("cookie")) {
					request.headers.set("cookie", cookie);
				}
				return globalThis.fetch(request);
			}) as typeof globalThis.fetch,
		};
	})
	.client((): SsrAuthOptions => ({}));

// Export configured status
export const apiConfig = {
	baseUrl: env.VITE_API_URL,
};
