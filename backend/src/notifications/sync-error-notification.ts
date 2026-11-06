import type { IntegrationConnection } from "../generated/client";

export const syncErrorSelect = {
	id: true,
	userDid: true,
	provider: true,
	status: true,
	lastError: true,
	lastSuccessAt: true,
} as const;

export function syncErrorNotification(
	connection: Pick<IntegrationConnection, keyof typeof syncErrorSelect>,
) {
	if (
		!["trakt", "popfeed"].includes(connection.provider) ||
		!(
			connection.status === "reconnect" ||
			(connection.status === "active" && connection.lastError)
		)
	)
		return null;
	const name = connection.provider === "trakt" ? "Trakt" : "Popfeed";
	const reconnect = connection.status === "reconnect";
	return {
		key: `sync:${connection.id}:${connection.lastSuccessAt?.toISOString() ?? "initial"}:${reconnect ? "reconnect" : "error"}`,
		title: reconnect
			? `${name} Sync needs reconnecting`
			: `${name} Sync could not finish`,
		body: reconnect
			? `Reconnect ${name} to continue syncing. Your data is retained.`
			: `Your data is retained and Sync will retry automatically. Open ${name} Sync for details.`,
		path: `/integrations/${connection.provider}`,
	};
}
