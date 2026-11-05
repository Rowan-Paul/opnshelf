import { getHttpStatus, isUnauthorizedError } from "./http-errors";

/**
 * What a client reports to PostHog when a TanStack mutation fails.
 *
 * Mutation failures end in a toast, so they never reach exception autocapture
 * (which only sees uncaught errors and unhandled rejections). The avatar
 * upload regression in #283 returned 400 on every attempt for weeks without a
 * single PostHog event. Each client wires `describeMutationFailure` into its
 * QueryClient's MutationCache so every failed mutation becomes one exception
 * event.
 *
 * The report is deliberately categorical. The server message and the thrown
 * error are left out: validation messages can echo user input, and the URL
 * fields are already stripped from PostHog events for the same reason.
 *
 * What it does carry is enough to investigate someone else's failure without
 * asking them to reproduce it: the server's `code` (a registered, categorical
 * reason such as EMAIL_CODE_EXPIRED), the request ID that also appears in the
 * backend's log line for that request, the API operation (method and path
 * template, never the filled-in path), the route section and the release.
 * Every field is checked against a strict shape, so a stray token, code or
 * email address in the error can never pass through.
 */
export interface MutationFailureReport {
	/** Synthetic error whose message groups by mutation key and status. */
	error: Error;
	properties: {
		/**
		 * Every report is built on the same line, so PostHog's default
		 * stack-based grouping would merge all mutation failures into one
		 * issue. Group by the message (mutation key and status) instead.
		 */
		$exception_fingerprint: string;
		mutation_key: string;
		http_status: number | null;
		error_name: string;
		request_id: string | null;
		/** Registered server error code, e.g. SYNC_BUSY. */
		error_code: string | null;
		/** API call that failed, e.g. "POST /auth/verify-email". */
		api_operation: string | null;
		/** First path segment of the screen, e.g. "/settings". */
		route: string | null;
		/** Commit SHA of the client build. */
		release: string | null;
	};
}

/** Where the failure happened, supplied by each client. */
export interface MutationFailureContext {
	/** Current pathname; only its first segment is reported. */
	pathname?: string | null;
	release?: string | null;
}

export class MutationFailedError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MutationFailedError";
	}
}

/**
 * Returns null when the failure is not worth reporting: a 401 means the
 * session expired, which the client's unauthorized flow already handles.
 */
export function describeMutationFailure(
	error: unknown,
	mutationKey: ReadonlyArray<unknown> | undefined,
	context: MutationFailureContext = {},
): MutationFailureReport | null {
	if (isUnauthorizedError(error)) return null;
	const status = getHttpStatus(error);

	const key = formatMutationKey(mutationKey);
	const suffix = status === undefined ? "" : ` with HTTP ${status}`;

	const message = `${key} failed${suffix}`;

	return {
		error: new MutationFailedError(message),
		properties: {
			$exception_fingerprint: `MutationFailedError: ${message}`,
			mutation_key: key,
			http_status: status ?? null,
			error_name: errorName(error),
			request_id: errorField(error, "requestId", UUID),
			error_code: errorField(error, "code", ERROR_CODE),
			api_operation: errorField(error, "apiOperation", API_OPERATION),
			route: routeSection(context.pathname),
			release: matching(context.release, RELEASE),
		},
	};
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// The backend's ErrorCode registry is SCREAMING_SNAKE_CASE.
const ERROR_CODE = /^[A-Z][A-Z0-9_]{1,63}$/;
// Path templates keep parameters as `{name}`, so no identifier fills them.
const API_OPERATION = /^[A-Z]{3,7} \/[A-Za-z0-9_/{}.-]{0,200}$/;
const RELEASE = /^[0-9a-f]{7,40}$/;
const ROUTE_SECTION = /^[a-z0-9-]{1,40}$/;

function errorField(error: unknown, key: string, shape: RegExp): string | null {
	if (typeof error !== "object" || error === null) return null;
	return matching((error as Record<string, unknown>)[key], shape);
}

function matching(value: unknown, shape: RegExp): string | null {
	return typeof value === "string" && shape.test(value) ? value : null;
}

/**
 * Same granularity as the clients' pageview and screen events: the first path
 * segment only, because deeper segments are handles, DIDs and media IDs.
 */
function routeSection(pathname: string | null | undefined): string | null {
	if (typeof pathname !== "string") return null;
	const section = pathname.split(/[?#]/)[0].split("/")[1] ?? "";
	if (!section) return "/";
	return ROUTE_SECTION.test(section) ? `/${section}` : null;
}

function formatMutationKey(key: ReadonlyArray<unknown> | undefined): string {
	if (!key || key.length === 0) return "unknown";
	return key
		.map((part) => (typeof part === "string" ? part : JSON.stringify(part)))
		.join("/");
}

function errorName(error: unknown): string {
	if (error instanceof Error && error.name) return error.name;
	if (typeof error === "object" && error !== null) return "object";
	return typeof error;
}
