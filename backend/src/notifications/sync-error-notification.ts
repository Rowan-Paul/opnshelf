import type { IntegrationConnection } from "../generated/client";

/** A failed run retries within minutes; only warn once the failure persists. */
export const SYNC_ERROR_GRACE_MS = 15 * 60_000;

const PROVIDERS = { trakt: "Trakt", popfeed: "Popfeed" } as const;

export const syncErrorWhere = {
	provider: { in: Object.keys(PROVIDERS) },
	OR: [{ status: "reconnect" }, { status: "active", lastError: { not: null } }],
};

export const syncErrorSelect = {
	id: true,
	userDid: true,
	provider: true,
	status: true,
	lastError: true,
	failingSince: true,
} as const;

export function syncErrorNotification(
	connection: Pick<IntegrationConnection, keyof typeof syncErrorSelect>,
	now = new Date(),
) {
	const name = PROVIDERS[connection.provider as keyof typeof PROVIDERS];
	const reconnect = connection.status === "reconnect";
	if (
		!name ||
		!connection.failingSince ||
		!(reconnect || (connection.status === "active" && connection.lastError)) ||
		// Reconnection never resolves itself, so it is not delayed.
		(!reconnect &&
			now.getTime() - connection.failingSince.getTime() < SYNC_ERROR_GRACE_MS)
	)
		return null;
	return {
		// One warning per failure episode and kind. A successful run, a new
		// connection, or a manual retry starts a new episode.
		key: `sync:${connection.id}:${connection.failingSince.toISOString()}:${reconnect ? "reconnect" : "error"}`,
		title: reconnect
			? `${name} Sync needs reconnecting`
			: `${name} Sync could not finish`,
		body: reconnect
			? `Reconnect ${name} to continue syncing. Your data is retained.`
			: `Your data is retained and Sync will retry automatically. Open ${name} Sync for details.`,
		path: `/integrations/${connection.provider}`,
	};
}

/** The connection id inside a key built by {@link syncErrorNotification}. */
export function syncErrorConnectionId(eventKey: string) {
	return eventKey.split(":")[1];
}
