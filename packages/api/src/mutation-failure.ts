import { getHttpStatus } from "./http-errors";

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
 */
export interface MutationFailureReport {
	/** Synthetic error whose message groups by mutation key and status. */
	error: Error;
	properties: {
		mutation_key: string;
		http_status: number | null;
		error_name: string;
	};
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
): MutationFailureReport | null {
	const status = getHttpStatus(error);
	if (status === 401) return null;

	const key = formatMutationKey(mutationKey);
	const suffix = status === undefined ? "" : ` with HTTP ${status}`;

	return {
		error: new MutationFailedError(`${key} failed${suffix}`),
		properties: {
			mutation_key: key,
			http_status: status ?? null,
			error_name: errorName(error),
		},
	};
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
