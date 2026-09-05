import { lookup as dnsLookup } from "node:dns";
import type { LookupAddress, LookupAllOptions } from "node:dns";
import type { LookupFunction } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";
import type { RequestInit, Response } from "undici";
import {
	isBlockedIpAddress,
	type PublicUrlOptions,
	validatePublicHttpUrl,
} from "./public-url";

/**
 * Server-side fetch of a URL that a client (or a record a client controls)
 * chose. Two guards close the SSRF paths that a plain `fetch` leaves open:
 *
 * 1. `validatePublicHttpUrl` on the initial URL and on every redirect target,
 *    so a public host cannot bounce this server to `http://localhost`.
 * 2. A DNS lookup wrapper on the connection pool that rejects when any
 *    resolved address is private. The socket only ever connects to the
 *    addresses that passed, so there is no resolve-then-connect window for
 *    DNS rebinding to slip through.
 *
 * Redirects are followed here, not by undici, up to `maxRedirects` hops.
 * 301/302/303 re-issue the request as a bodiless GET; 307/308 keep method and
 * body. Request headers are forwarded unchanged across hops, so do not send
 * credentials through this function.
 */

export type SafeFetchInit = Omit<RequestInit, "redirect" | "dispatcher"> &
	PublicUrlOptions & {
		/** Redirect hops to follow before giving up. Defaults to 3. */
		maxRedirects?: number;
	};

export type SafeFetch = (
	url: string | URL,
	init?: SafeFetchInit,
) => Promise<Response>;

/** The `dns.lookup` shape the guarded lookup builds on; injectable for tests. */
export type LookupFn = (
	hostname: string,
	options: LookupAllOptions,
	callback: (
		error: NodeJS.ErrnoException | null,
		addresses: LookupAddress[],
	) => void,
) => void;

export type SafeFetchDependencies = {
	lookup?: LookupFn;
	fetch?: typeof undiciFetch;
};

export class SafeFetchError extends Error {}

/** The URL itself (initial or a redirect target) failed the public-host check. */
export class BlockedUrlError extends SafeFetchError {
	constructor(
		readonly url: string,
		readonly reason: string,
	) {
		super(`blocked URL ${url}: ${reason}`);
		this.name = "BlockedUrlError";
	}
}

/** A hostname resolved to at least one address this server must not reach. */
export class BlockedAddressError extends SafeFetchError {
	constructor(
		readonly hostname: string,
		readonly address: string,
	) {
		super(`${hostname} resolved to blocked address ${address}`);
		this.name = "BlockedAddressError";
	}
}

/** Too many hops, or a redirect without a usable `Location`. */
export class RedirectError extends SafeFetchError {
	constructor(reason: string) {
		super(`refusing redirect: ${reason}`);
		this.name = "RedirectError";
	}
}

const DEFAULT_MAX_REDIRECTS = 3;
const CONNECT_TIMEOUT_MS = 10_000;
const HEADERS_TIMEOUT_MS = 10_000;
const BODY_TIMEOUT_MS = 10_000;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const BODILESS_REDIRECT_STATUSES = new Set([301, 302, 303]);

const defaultLookup: LookupFn = (hostname, options, callback) =>
	dnsLookup(hostname, options, callback);

/**
 * Wraps a `dns.lookup` so that the socket layer only ever sees addresses that
 * pass `isBlockedIpAddress`. Resolves every address up front and rejects the
 * whole lookup if any of them is blocked, whichever one Node would have
 * picked.
 */
export function createGuardedLookup(
	lookup: LookupFn = defaultLookup,
): LookupFunction {
	return (hostname, options, callback) => {
		lookup(
			hostname,
			{ family: options.family, hints: options.hints, all: true },
			(error, addresses) => {
				if (error) {
					callback(error, []);
					return;
				}
				const blocked = addresses.find((entry) =>
					isBlockedIpAddress(entry.address),
				);
				if (blocked) {
					callback(new BlockedAddressError(hostname, blocked.address), []);
					return;
				}
				const [first] = addresses;
				if (!first) {
					const empty: NodeJS.ErrnoException = new Error(
						`${hostname} resolved to no addresses`,
					);
					empty.code = "ENOTFOUND";
					callback(empty, []);
					return;
				}
				if (options.all) {
					callback(null, addresses);
				} else {
					callback(null, first.address, first.family);
				}
			},
		);
	};
}

export function createSafeFetch(
	dependencies: SafeFetchDependencies = {},
): SafeFetch {
	const fetchImpl = dependencies.fetch ?? undiciFetch;
	const agent = new Agent({
		connect: {
			lookup: createGuardedLookup(dependencies.lookup),
			timeout: CONNECT_TIMEOUT_MS,
		},
		headersTimeout: HEADERS_TIMEOUT_MS,
		bodyTimeout: BODY_TIMEOUT_MS,
	});

	return async function safeFetch(input, init = {}) {
		const {
			allowHttp,
			maxRedirects = DEFAULT_MAX_REDIRECTS,
			...requestInit
		} = init;
		const urlOptions: PublicUrlOptions = { allowHttp };

		let url = assertPublicUrl(String(input), urlOptions);
		let method = requestInit.method;
		let body = requestInit.body;

		for (let hop = 0; ; hop += 1) {
			const response = await fetchImpl(url.href, {
				...requestInit,
				method,
				body,
				redirect: "manual",
				dispatcher: agent,
			});
			if (!REDIRECT_STATUSES.has(response.status)) {
				return response;
			}

			await discardBody(response);
			const location = response.headers.get("location");
			if (!location) {
				throw new RedirectError("missing Location header");
			}
			if (hop >= maxRedirects) {
				throw new RedirectError(`more than ${maxRedirects} redirects`);
			}
			let next: URL;
			try {
				next = new URL(location, url);
			} catch {
				throw new RedirectError(`invalid Location header ${location}`);
			}
			url = assertPublicUrl(next.href, urlOptions);
			if (BODILESS_REDIRECT_STATUSES.has(response.status)) {
				method = "GET";
				body = undefined;
			}
		}
	};
}

/** Default instance backed by the real `dns.lookup` and undici's `fetch`. */
export const safeFetch: SafeFetch = createSafeFetch();

function assertPublicUrl(value: string, options: PublicUrlOptions): URL {
	const rejection = validatePublicHttpUrl(value, options);
	if (rejection) {
		throw new BlockedUrlError(value, rejection);
	}
	return new URL(value);
}

async function discardBody(response: Response): Promise<void> {
	try {
		await response.body?.cancel();
	} catch {
		// Nothing to release if the stream is already closed.
	}
}
