const ACTIVE_TRAKT_IMPORT_STATUSES = [
	"queued",
	"running",
	"waiting_retry",
] as const;
const TERMINAL_TRAKT_IMPORT_STATUSES = ["completed", "failed"] as const;
const KNOWN_TRAKT_IMPORT_STATUSES = [
	...ACTIVE_TRAKT_IMPORT_STATUSES,
	...TERMINAL_TRAKT_IMPORT_STATUSES,
] as const;

type KnownTraktImportStatus = (typeof KNOWN_TRAKT_IMPORT_STATUSES)[number];

export type TraktImportStatusJob = {
	status: string;
	currentPage: number;
	totalPages?: number;
	importedCount: number;
	skippedCount: number;
	failedCount: number;
	lastError?: string;
	/** ISO timestamp of the next scheduled attempt (drives the retry countdown). */
	nextRunAt?: string;
};

export function isActiveTraktImportStatus(status: string): boolean {
	return ACTIVE_TRAKT_IMPORT_STATUSES.includes(
		status as (typeof ACTIVE_TRAKT_IMPORT_STATUSES)[number],
	);
}

export function isTerminalTraktImportStatus(status: string): boolean {
	return TERMINAL_TRAKT_IMPORT_STATUSES.includes(
		status as (typeof TERMINAL_TRAKT_IMPORT_STATUSES)[number],
	);
}

export function isKnownTraktImportStatus(
	status: string,
): status is KnownTraktImportStatus {
	return KNOWN_TRAKT_IMPORT_STATUSES.includes(status as KnownTraktImportStatus);
}

export function getTraktImportStatusMessage(
	job: TraktImportStatusJob,
): string | null {
	if (job.status === "queued") {
		return "Queued on the server. We’ll keep importing your full watch history in the background.";
	}
	if (job.status === "waiting_retry") {
		return (
			job.lastError ?? "Waiting for Trakt rate limits to reset before retrying."
		);
	}
	if (job.status === "running") {
		return `Imported ${job.importedCount}, skipped ${job.skippedCount}, failed ${job.failedCount}.`;
	}
	if (job.status === "completed") {
		return `Finished. Imported ${job.importedCount}, skipped ${job.skippedCount}, failed ${job.failedCount}.`;
	}
	if (job.status === "failed") {
		return (
			job.lastError ?? "Import failed. You can retry from onboarding later."
		);
	}
	return null;
}

/**
 * Humanize a remaining duration for a live retry countdown. Rounds up so it
 * never reads "0 minutes" while a wait is still pending.
 */
export function formatRetryCountdown(remainingMs: number): string {
	const seconds = Math.ceil(remainingMs / 1000);
	if (seconds < 60) return "less than a minute";
	const minutes = Math.ceil(seconds / 60);
	if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
	const hours = Math.floor(minutes / 60);
	const remMinutes = minutes % 60;
	const hourPart = `${hours} hour${hours === 1 ? "" : "s"}`;
	return remMinutes > 0
		? `${hourPart} ${remMinutes} minute${remMinutes === 1 ? "" : "s"}`
		: hourPart;
}

/**
 * Strip the static "Retrying in N seconds." tail from a rate-limit lastError so
 * callers can pair the reason with a live countdown instead.
 */
export function getRetryReason(lastError?: string): string | undefined {
	if (!lastError) return undefined;
	const reason = lastError.replace(/\s*Retrying in [^.]*\.?/i, "").trim();
	return reason || undefined;
}

export function getTraktImportStatusProgress(
	job: TraktImportStatusJob,
): number | null {
	if (job.status === "completed") {
		return 100;
	}

	if (job.status === "queued") {
		return 0;
	}

	if (
		(job.status === "running" || job.status === "waiting_retry" || job.status === "failed") &&
		typeof job.totalPages === "number" &&
		job.totalPages > 0
	) {
		return Math.max(
			0,
			Math.min(100, Math.round((job.currentPage / job.totalPages) * 100)),
		);
	}

	return null;
}
