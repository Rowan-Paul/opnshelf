const ACTIVE_ACCOUNT_DELETION_STATUSES = [
	"queued",
	"running",
	"waiting_retry",
] as const;
const TERMINAL_ACCOUNT_DELETION_STATUSES = ["completed", "failed"] as const;

export type AccountDeletionStatusJob = {
	status: string;
	totalRecords: number;
	deletedRecords: number;
	currentStep?: string;
	lastError?: string;
};

const STEP_LABELS: Record<string, string> = {
	movies: "Deleting movies…",
	episodes: "Deleting episodes…",
	follows: "Deleting follows…",
	list_items: "Deleting list items…",
	lists: "Deleting lists…",
	profile: "Deleting profile…",
	db_cleanup: "Cleaning up account data…",
	completed: "Deletion complete",
};

export function isActiveAccountDeletionStatus(status: string): boolean {
	return (ACTIVE_ACCOUNT_DELETION_STATUSES as readonly string[]).includes(
		status,
	);
}

export function isTerminalAccountDeletionStatus(status: string): boolean {
	return (TERMINAL_ACCOUNT_DELETION_STATUSES as readonly string[]).includes(
		status,
	);
}

export function getAccountDeletionStepLabel(
	step: string | undefined,
): string {
	if (!step) {
		return "Preparing…";
	}
	return STEP_LABELS[step] ?? "Processing…";
}

export function getAccountDeletionProgress(
	job: AccountDeletionStatusJob,
): number | null {
	if (job.status === "completed") {
		return 100;
	}

	if (job.status === "queued") {
		return 0;
	}

	if (job.totalRecords > 0) {
		return Math.max(
			0,
			Math.min(
				99,
				Math.round((job.deletedRecords / job.totalRecords) * 100),
			),
		);
	}

	return null;
}

export function getAccountDeletionStatusMessage(
	job: AccountDeletionStatusJob,
): string {
	if (job.status === "queued") {
		return "Queued for deletion…";
	}
	if (job.status === "failed") {
		return (
			job.lastError ??
			"Account deletion failed. Please try again or contact support."
		);
	}
	if (job.status === "completed") {
		return "Your account has been deleted.";
	}
	return getAccountDeletionStepLabel(job.currentStep);
}
