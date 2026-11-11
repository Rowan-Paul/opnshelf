import { ServiceUnavailableException } from "@nestjs/common";

export function retryAfterSeconds(value: string | null, fallback: number) {
	if (!value?.trim()) return fallback;
	const seconds = Number(value);
	const delay = Number.isFinite(seconds)
		? seconds
		: (Date.parse(value) - Date.now()) / 1000;
	return Number.isFinite(delay) && delay >= 0
		? Math.max(1, Math.ceil(delay))
		: fallback;
}

/** Servers may expose the reset timestamp instead of Retry-After. */
export function pdsRetrySeconds(
	headers: Headers | Record<string, string> | undefined,
	fallback: number,
) {
	const values = new Headers(headers);
	const retry = retryAfterSeconds(values.get("retry-after"), 0);
	const reset = Number(values.get("ratelimit-reset"));
	const resetDelay = Number.isFinite(reset)
		? Math.max(0, Math.ceil(reset - Date.now() / 1000))
		: 0;
	return Math.max(retry, resetDelay) || fallback;
}

/** A temporary PDS failure must not invalidate a saved session. */
export class PdsRequestError extends ServiceUnavailableException {
	constructor(
		readonly upstreamStatus: number,
		readonly retrySeconds: number,
	) {
		super(
			upstreamStatus === 429
				? "Your repository rate limit was reached. Sync will retry."
				: "Your repository is temporarily unavailable. Try again shortly.",
		);
	}
}

/** OAuth and XRPC wrap HTTP errors in causes; retain only safe diagnostics. */
export function pdsRequestError(error: unknown): PdsRequestError | undefined {
	const seen = new Set<unknown>();
	while (error && typeof error === "object" && !seen.has(error)) {
		if (error instanceof PdsRequestError) return error;
		seen.add(error);
		const candidate = error as {
			status?: number;
			statusCode?: number;
			headers?: Headers | Record<string, string>;
			response?: Response;
			cause?: unknown;
		};
		const status =
			candidate.response?.status ?? candidate.statusCode ?? candidate.status;
		if (status === 429 || (status && status >= 500 && status <= 599)) {
			const headers = candidate.response?.headers ?? candidate.headers;
			return new PdsRequestError(
				status,
				pdsRetrySeconds(headers, status === 429 ? 300 : 60),
			);
		}
		error = candidate.cause;
	}
	return undefined;
}
