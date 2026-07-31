/**
 * Error shapes and rate-limit arithmetic for the Trakt import pipeline. Pure
 * except for reading the wall clock, so the retry maths can be tested directly.
 */
import {
	BadRequestException,
	HttpException,
	HttpStatus,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";

export type ImportWriteFailureReason =
	| "duplicate_record"
	| "metadata_unavailable"
	| "upstream_write_failed"
	| "unknown";

export type ClassifiedImportWriteError = {
	reason: ImportWriteFailureReason;
	message: string;
	rawMessage: string;
};

export type PdsRateLimitSnapshot = {
	/** Points remaining in the current (binding) repo-write window. */
	remaining?: number;
	/** Unix epoch (seconds) when that window resets. */
	reset?: number;
};

export const PDS_RETRY_FALLBACK_SECONDS = 60;
// PDS repo writes have BOTH an hourly and a daily budget. When the daily budget
// (atproto: ~35k points/day) is exhausted, ratelimit-reset points at the next
// day rollover — up to ~24h out. Cap at 25h (24h + 1h margin) so clock skew or a
// window measured slightly past 24h can't clip a legitimate reset and re-trip us.
// A 1h cap made us wake hourly, re-trip the still-empty daily budget, and
// busy-loop forever without progress.
export const PDS_RETRY_MAX_SECONDS = 25 * 60 * 60;

export class TraktApiError extends Error {
	constructor(
		message: string,
		public readonly status: number,
		public readonly retryAfterSeconds?: number,
	) {
		super(message);
	}
}

export class PdsRateLimitError extends Error {
	constructor(public readonly retryAfterSeconds?: number) {
		super("PDS rate limit reached");
	}
}

/**
 * Humanize a retry delay for user-facing status messages. Rate-limit waits can
 * be many minutes now (PDS write budgets refill hourly), so raw seconds —
 * "Retrying in 2717 seconds" — read badly.
 */
export function formatRetryDelay(totalSeconds: number): string {
	const s = Math.max(0, Math.round(totalSeconds));
	if (s < 60) return `${s} second${s === 1 ? "" : "s"}`;
	const minutes = Math.round(s / 60);
	if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
	const hours = Math.floor(minutes / 60);
	const remMinutes = minutes % 60;
	const hourPart = `${hours} hour${hours === 1 ? "" : "s"}`;
	return remMinutes > 0
		? `${hourPart} ${remMinutes} minute${remMinutes === 1 ? "" : "s"}`
		: hourPart;
}

export function getErrorMessage(error: unknown): string {
	if (error instanceof TraktApiError) {
		return error.message;
	}
	if (error instanceof HttpException) {
		return error.message;
	}
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}

export function isPdsRateLimitError(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"status" in error &&
		(error as { status: unknown }).status === 429
	);
}

/**
 * True when an applyWrites batch failed because a record at one of the
 * (deterministic) rkeys already exists in the PDS. This is the crash-recovery
 * signal: a prior run wrote to the PDS but died before the DB write. The
 * caller retries the batch as `update` ops, which is a safe idempotent
 * overwrite because the rkey is a content hash (existing record is identical).
 */
export function isRecordExistsError(error: unknown): boolean {
	const message = getErrorMessage(error).toLowerCase();
	return (
		message.includes("already exists") ||
		message.includes("recordalreadyexists") ||
		message.includes("could not create") ||
		message.includes("invalidswap")
	);
}

/**
 * Read the IETF RateLimit headers off a successful applyWrites response so the
 * caller can pace itself against the live repo-write budget. Returns undefined
 * when the PDS doesn't surface them (older builds) — callers fall back to
 * reacting to a 429 instead.
 */
export function parsePdsRateLimitSnapshot(
	headers: unknown,
): PdsRateLimitSnapshot | undefined {
	if (typeof headers !== "object" || headers === null) return undefined;
	const h = headers as Record<string, string>;
	const remainingRaw = h["ratelimit-remaining"] ?? h["RateLimit-Remaining"];
	const resetRaw = h["ratelimit-reset"] ?? h["RateLimit-Reset"];
	const remaining =
		remainingRaw === undefined ? undefined : Number(remainingRaw);
	const reset = resetRaw === undefined ? undefined : Number(resetRaw);
	const snapshot: PdsRateLimitSnapshot = {
		remaining: Number.isFinite(remaining) ? remaining : undefined,
		reset: Number.isFinite(reset) ? reset : undefined,
	};
	return snapshot.remaining === undefined && snapshot.reset === undefined
		? undefined
		: snapshot;
}

export function reportPdsRateLimit(
	headers: unknown,
	options?: { onRateLimit?: (snapshot: PdsRateLimitSnapshot) => void },
): void {
	if (!options?.onRateLimit) return;
	const snapshot = parsePdsRateLimitSnapshot(headers);
	if (snapshot) options.onRateLimit(snapshot);
}

/** Seconds until the binding repo-write window resets, floored and capped. */
export function secondsUntilPdsReset(snapshot?: PdsRateLimitSnapshot): number {
	if (snapshot?.reset !== undefined && Number.isFinite(snapshot.reset)) {
		const delta = Math.ceil(snapshot.reset - Date.now() / 1000) + 1;
		if (delta > 0) return Math.min(delta, PDS_RETRY_MAX_SECONDS);
	}
	return PDS_RETRY_FALLBACK_SECONDS;
}

export function getPdsRetryAfterSeconds(error: unknown): number | undefined {
	if (typeof error !== "object" || error === null) return undefined;
	const headers = (error as Record<string, unknown>).headers;
	if (!headers || typeof headers !== "object") return undefined;
	const h = headers as Record<string, string>;

	// The atproto PDS throttles repo writes with the IETF RateLimit headers,
	// NOT Retry-After. `ratelimit-reset` is the absolute Unix epoch (seconds)
	// when the (hourly) write budget refills — convert it to a delay from now.
	// Reading the wrong header here is why we used to busy-retry every 60s and
	// keep re-hitting the limit before the window had actually reset.
	const reset = h["ratelimit-reset"] ?? h["RateLimit-Reset"];
	if (reset) {
		const resetEpoch = Number(reset);
		if (Number.isFinite(resetEpoch)) {
			// +1s so we resume just after the window rolls, not on its edge.
			const delta = Math.ceil(resetEpoch - Date.now() / 1000) + 1;
			if (delta > 0) return delta;
		}
	}

	// Fallback: some proxies send a plain Retry-After (delta seconds).
	const retryAfter = h["retry-after"] ?? h["Retry-After"];
	if (retryAfter) {
		const parsed = Number(retryAfter);
		if (Number.isFinite(parsed)) return parsed;
	}
	return undefined;
}

export function classifyImportWriteError(
	error: unknown,
): ClassifiedImportWriteError {
	const rawMessage = getErrorMessage(error) || "Failed to import watch item";
	const normalizedMessage = rawMessage.toLowerCase();

	if (
		normalizedMessage.includes("unique constraint failed") ||
		normalizedMessage.includes("duplicate key") ||
		normalizedMessage.includes("duplicate") ||
		normalizedMessage.includes("trackedmovie_rkey_key") ||
		normalizedMessage.includes("trackedepisode_rkey_key") ||
		normalizedMessage.includes("`rkey`")
	) {
		return {
			reason: "duplicate_record",
			message: "This watch was already imported.",
			rawMessage,
		};
	}

	if (
		normalizedMessage.includes("tmdb") ||
		normalizedMessage.includes("show details") ||
		normalizedMessage.includes("movie details") ||
		normalizedMessage.includes("metadata") ||
		normalizedMessage.includes("season details") ||
		normalizedMessage.includes("episode details")
	) {
		return {
			reason: "metadata_unavailable",
			message: "We couldn't fetch details for this title right now.",
			rawMessage,
		};
	}

	if (
		normalizedMessage.includes("atproto") ||
		normalizedMessage.includes("pds") ||
		normalizedMessage.includes("putrecord") ||
		normalizedMessage.includes("repo.putrecord") ||
		normalizedMessage.includes("repo#putrecord") ||
		normalizedMessage.includes("upstream")
	) {
		return {
			reason: "upstream_write_failed",
			message: "We couldn't save this watch right now. Please try again.",
			rawMessage,
		};
	}

	return {
		reason: "unknown",
		message: "We couldn't import this item.",
		rawMessage,
	};
}

export function toPublicTraktException(error: unknown): Error {
	if (error instanceof HttpException) {
		return error;
	}
	if (error instanceof TraktApiError) {
		if (error.status === 404) {
			return new NotFoundException(error.message);
		}
		if (error.status === 401 || error.status === 403 || error.status < 500) {
			return new BadRequestException(error.message);
		}
		if (error.status === 429) {
			return new HttpException(error.message, HttpStatus.TOO_MANY_REQUESTS);
		}
		return new ServiceUnavailableException(error.message);
	}
	if (error instanceof Error) {
		return error;
	}
	return new Error(String(error));
}
