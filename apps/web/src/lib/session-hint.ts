import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { hasSessionCookie } from "./api";

/**
 * A non-secret marker on the Web origin that this browser was signed in when
 * it last checked. The API's session cookie is host-only on the API hostname,
 * so the Web server cannot see it; without this marker SSR had to render
 * nothing until the browser asked `/auth/me`, which pushed the landing page
 * and its footer in after hydration for every visitor (ADR 0039).
 *
 * It only decides what to render while the browser check runs. It grants
 * nothing: the API still authenticates every request with its own cookie.
 */
export const SIGNED_IN_HINT_COOKIE = "opnshelf_signed_in";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Whether a raw `Cookie` header says this visitor may be signed in. */
export function hasSignedInHint(cookieHeader: string | undefined): boolean {
	if (!cookieHeader) return false;
	if (hasSessionCookie(cookieHeader)) return true;
	return cookieHeader
		.split(";")
		.some((pair) => pair.trim() === `${SIGNED_IN_HINT_COOKIE}=1`);
}

/**
 * Where SSR leaves its decision for the hydrating render. The server can see
 * HttpOnly cookies that `document.cookie` cannot, such as a legacy
 * parent-domain session, so the browser reuses the server's answer rather
 * than recomputing one that could disagree.
 */
export const SIGNED_IN_HINT_QUERY_KEY = ["session-hint"] as const;

/**
 * Whether this render should wait for the browser session check before
 * choosing between signed-in and public content.
 */
export const mayBeSignedIn = createIsomorphicFn()
	.server((): boolean => hasSignedInHint(getRequestHeader("cookie")))
	.client((): boolean => hasSignedInHint(document.cookie));

/** Records the browser session check's outcome for the next page load. */
export function rememberSignedIn(signedIn: boolean): void {
	if (typeof document === "undefined") return;
	if (hasSignedInHint(document.cookie) === signedIn) return;
	const secure = window.location.protocol === "https:" ? "; Secure" : "";
	// biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is missing from older Safari and Firefox, and SSR must see this on the first request
	document.cookie = signedIn
		? `${SIGNED_IN_HINT_COOKIE}=1; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`
		: `${SIGNED_IN_HINT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}
