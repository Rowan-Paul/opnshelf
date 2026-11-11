import { ConflictException } from "@nestjs/common";
import { coded } from "../common/error-codes";

/** A provider failure with a user-safe message. Status 401 asks the User to reconnect. */
export class IntegrationError extends Error {
	constructor(
		message: string,
		readonly status = 0,
		readonly retrySeconds = 60,
	) {
		super(message);
	}
}

/**
 * The remote changed while it was read. The sync run stops without marking
 * the item it was working on and reads a fresh snapshot shortly.
 */
export class SyncSnapshotChanged extends IntegrationError {}

/** A provider-wide outage stops the run without marking individual items. */
export class IntegrationUnavailable extends IntegrationError {}

/** SDK transports can wrap a provider's typed failure in an error cause. */
export function integrationFailure(error: unknown): unknown {
	const seen = new Set<unknown>();
	let cause = error;
	while (cause && typeof cause === "object" && !seen.has(cause)) {
		if (cause instanceof IntegrationError) return cause;
		seen.add(cause);
		cause = "cause" in cause ? cause.cause : undefined;
	}
	return error;
}

/**
 * The connection is busy with a sync run. Clients retry a 409 carrying this
 * code automatically; nothing was changed when it is thrown.
 */
export function syncBusy(
	message = "Sync is finishing its current operation. Try again shortly.",
) {
	return new ConflictException({
		statusCode: 409,
		...coded("SYNC_BUSY", message),
	});
}
export function isSyncBusy(error: unknown) {
	if (!(error instanceof ConflictException)) return false;
	const response = error.getResponse();
	return (
		typeof response === "object" &&
		(response as { code?: unknown }).code === "SYNC_BUSY"
	);
}
