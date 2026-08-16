/**
 * Returns whether an AT Protocol record operation failed because the target
 * record is already absent. These errors are safe to treat as idempotent
 * success for deletes; transport, rate-limit, and server failures are not.
 */
export function isAtprotoRecordMissingError(error: unknown): boolean {
	if (!error || typeof error !== "object") {
		return false;
	}

	const candidate = error as {
		error?: string;
		status?: number;
		message?: string;
	};

	return (
		candidate.status === 404 ||
		candidate.error === "RecordNotFound" ||
		candidate.message?.includes("RecordNotFound") === true ||
		candidate.message?.includes("Delete target record does not exist") === true
	);
}
