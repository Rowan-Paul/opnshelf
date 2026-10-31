import {
	popfeedSyncControllerAction,
	popfeedSyncControllerConfigure,
	popfeedSyncControllerConnect,
	popfeedSyncControllerIssues,
	popfeedSyncControllerMatches,
	popfeedSyncControllerResolve,
	popfeedSyncControllerStatus,
	traktSyncControllerAction,
	traktSyncControllerConfigure,
	traktSyncControllerConnect,
	traktSyncControllerIssues,
	traktSyncControllerMatches,
	traktSyncControllerResolve,
	traktSyncControllerStatus,
} from "./generated/sdk.gen";
import type {
	IntegrationIssueDto,
	IntegrationIssuesDto,
	IntegrationResolveDto,
	SyncActionDto,
	SyncIssueDto,
	SyncSettingsDto,
	SyncStatusDto,
	TraktMatchCandidateDto,
} from "./generated/types.gen";

/**
 * One definition per Integration (ADR 0051). Both clients render every
 * Integration from these, so names, record types and directions stay in step.
 */
export type IntegrationId = "trakt" | "popfeed";
export type IntegrationRecordType =
	| "watches"
	| "ratings"
	| "watchlist"
	| "favorites"
	| "lists"
	| "library"
	| "notes"
	| "reviews";
export type IntegrationDirection = SyncSettingsDto["direction"];

export type IntegrationApi = {
	status(signal?: AbortSignal): Promise<SyncStatusDto>;
	/** OAuth Integrations return a URL to open; repository Integrations connect in place. */
	connect(options: {
		platform: "web" | "mobile";
		returnTo?: "onboarding";
	}): Promise<{ url?: string }>;
	configure(settings: SyncSettingsDto): Promise<SyncStatusDto>;
	action(action: SyncActionDto["action"]): Promise<SyncStatusDto>;
	issues(
		query: { view: "attention" | "ignored"; page: number; pageSize: number },
		signal?: AbortSignal,
	): Promise<IntegrationIssuesDto>;
	resolve(id: string, choice: IntegrationResolveDto): Promise<SyncStatusDto>;
	matches(
		id: string,
		query: string,
		signal?: AbortSignal,
	): Promise<TraktMatchCandidateDto[]>;
};

export type IntegrationDefinition = {
	id: IntegrationId;
	name: string;
	/** One line for the Integrations list and the management page. */
	summary: string;
	records: readonly IntegrationRecordType[];
	directions: readonly IntegrationDirection[];
	connect: "oauth" | "repository";
	/** How often the server reads the provider, shown under the last check. */
	checkCopy: string;
	/** Shown when only some directions exist yet. */
	directionNote?: string;
	/**
	 * The External Integration Access (ADR 0030) needed before Opnshelf may
	 * write this provider's records. Absent when the provider's sign-in grants it.
	 */
	writeGrant?: "popfeed";
	api: IntegrationApi;
};

export const INTEGRATION_RECORDS: {
	value: IntegrationRecordType;
	label: string;
}[] = [
	{ value: "watches", label: "Watch history" },
	{ value: "ratings", label: "Ratings" },
	{ value: "watchlist", label: "Watchlist" },
	{ value: "favorites", label: "Favorites" },
	{ value: "lists", label: "Custom Lists" },
	{ value: "library", label: "Library" },
	{ value: "notes", label: "Notes" },
	{ value: "reviews", label: "Reviews" },
];

const traktIssue = ({
	trakt,
	traktState,
	...item
}: SyncIssueDto): IntegrationIssueDto => ({
	...item,
	remote: trakt,
	remoteState: traktState,
});

const trakt: IntegrationDefinition = {
	id: "trakt",
	name: "Trakt",
	summary:
		"Keep your Watch history, Ratings, Lists, Favorites, Notes, Library and Reviews in sync with Trakt.",
	records: [
		"watches",
		"ratings",
		"watchlist",
		"favorites",
		"lists",
		"library",
		"notes",
		"reviews",
	],
	directions: ["inbound", "outbound", "both"],
	connect: "oauth",
	checkCopy:
		"Trakt is checked about every 15 minutes; rate limits can delay transfers.",
	api: {
		status: async (signal) =>
			(await traktSyncControllerStatus({ signal, throwOnError: true })).data,
		connect: async (body) =>
			(await traktSyncControllerConnect({ body, throwOnError: true })).data,
		configure: async (body) =>
			(await traktSyncControllerConfigure({ body, throwOnError: true })).data,
		action: async (action) =>
			(
				await traktSyncControllerAction({
					body: { action },
					throwOnError: true,
				})
			).data,
		issues: async (query, signal) => {
			const page = (
				await traktSyncControllerIssues({ query, signal, throwOnError: true })
			).data;
			return { ...page, items: page.items.map(traktIssue) };
		},
		resolve: async (id, { action, confirmedRemoteMissing, ...choice }) =>
			(
				await traktSyncControllerResolve({
					path: { id },
					body: {
						...choice,
						action: action === "remote" ? "trakt" : action,
						confirmedTraktMissing: confirmedRemoteMissing,
					},
					throwOnError: true,
				})
			).data,
		matches: async (id, q, signal) =>
			(
				await traktSyncControllerMatches({
					path: { id },
					query: { q },
					signal,
					throwOnError: true,
				})
			).data,
	},
};

const popfeed: IntegrationDefinition = {
	id: "popfeed",
	name: "Popfeed",
	summary:
		"Keep your Watches, Ratings, Reviews, Lists and watchlist in sync with Popfeed.",
	records: ["watches", "ratings", "watchlist", "lists", "reviews"],
	directions: ["inbound", "outbound", "both"],
	connect: "repository",
	checkCopy: "Popfeed is checked about every 15 minutes.",
	writeGrant: "popfeed",
	api: {
		status: async (signal) =>
			(await popfeedSyncControllerStatus({ signal, throwOnError: true })).data,
		connect: async () => {
			await popfeedSyncControllerConnect({ throwOnError: true });
			return {};
		},
		configure: async (body) =>
			(await popfeedSyncControllerConfigure({ body, throwOnError: true })).data,
		action: async (action) =>
			(
				await popfeedSyncControllerAction({
					body: { action },
					throwOnError: true,
				})
			).data,
		issues: async (query, signal) =>
			(await popfeedSyncControllerIssues({ query, signal, throwOnError: true }))
				.data,
		resolve: async (id, body) =>
			(
				await popfeedSyncControllerResolve({
					path: { id },
					body,
					throwOnError: true,
				})
			).data,
		matches: async (id, q, signal) =>
			(
				await popfeedSyncControllerMatches({
					path: { id },
					query: { q },
					signal,
					throwOnError: true,
				})
			).data,
	},
};

export const TRAKT_INTEGRATION = trakt;
export const POPFEED_INTEGRATION = popfeed;
export const INTEGRATIONS: readonly IntegrationDefinition[] = [trakt, popfeed];

export function findIntegration(
	id: string | undefined,
): IntegrationDefinition | undefined {
	return INTEGRATIONS.find((integration) => integration.id === id);
}

/** Query and mutation keys stay per Integration, e.g. ["trakt-sync"]. */
export function integrationKey(integration: Pick<IntegrationDefinition, "id">) {
	return [`${integration.id}-sync`] as const;
}

export function integrationDirections(
	integration: Pick<IntegrationDefinition, "name" | "directions">,
) {
	const { name } = integration;
	return [
		{
			value: "inbound" as const,
			label: `${name} → Opnshelf`,
			title: `From ${name}`,
			description: "Bring changes into Opnshelf",
		},
		{
			value: "outbound" as const,
			label: `Opnshelf → ${name}`,
			title: `To ${name}`,
			description: `Send changes to ${name}`,
		},
		{
			value: "both" as const,
			label: "Both directions",
			title: "Both ways",
			description: "Keep both services up to date",
		},
	].filter((choice) => integration.directions.includes(choice.value));
}

export function integrationRecords(
	integration: Pick<IntegrationDefinition, "records">,
) {
	return INTEGRATION_RECORDS.filter(({ value }) =>
		integration.records.includes(value),
	);
}

export function integrationResolutionLabel(
	action: IntegrationResolveDto["action"],
	sourceExists: boolean,
	name: string,
) {
	if (action !== "remote" && action !== "opnshelf") return action;
	return `Use ${action === "remote" ? name : "Opnshelf"}${sourceExists ? " (keep or restore this version)" : " (delete the other version)"}`;
}

/** Older servers omit structured recovery fields; keep uncertain writes safe during rollout. */
export function integrationIssueRecovery(
	item: IntegrationIssueDto,
): "verify" | "choose" | "retry" {
	if (item.recovery) return item.recovery;
	if (/outcome of creating .* is unknown/i.test(item.issue)) return "verify";
	return item.opnshelf && item.remote ? "choose" : "retry";
}

/** Errors and unresolved items take priority over background progress on both clients. */
export function integrationErrorMessage(
	sync:
		| (Pick<SyncStatusDto, "status"> &
				Partial<Pick<SyncStatusDto, "lastError" | "needsAttention">>)
		| undefined,
	name: string,
): string | null {
	if (!sync || sync.status === "disconnected") return null;
	if (sync.lastError) return `${name} sync error`;
	if (sync.needsAttention) return `${name} sync needs attention`;
	return null;
}

export function integrationCatchUpMessage(
	sync:
		| (Pick<SyncStatusDto, "status" | "remaining" | "progress"> &
				Partial<Pick<SyncStatusDto, "lastError" | "needsAttention">>)
		| undefined,
	name: string,
): string | null {
	const error = integrationErrorMessage(sync, name);
	if (error) return error;
	if (sync?.status === "preparing") return `Comparing with ${name}`;
	if (sync?.status === "active" && sync.remaining > 0)
		return `Syncing with ${name}${sync.progress !== undefined ? ` — ${sync.progress}%` : ""}`;
	return null;
}

export function integrationActionLabel(
	status: SyncStatusDto,
	name: string,
): string {
	return status.syncState === "running"
		? `Syncing with ${name}…`
		: status.syncState === "queued"
			? "Sync queued"
			: status.syncState === "waiting"
				? "Waiting to retry"
				: "Sync now";
}

export function integrationStateMessage(
	status: SyncStatusDto,
	name: string,
): string | null {
	if (status.syncState === "running")
		return `Syncing with ${name}. You can keep using Opnshelf.`;
	if (status.syncState === "queued")
		return "Your sync is queued. You can leave this page.";
	if (status.syncState === "waiting")
		return status.nextCheckAt
			? `Sync will retry automatically at ${new Date(status.nextCheckAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}.`
			: "Sync will retry automatically.";
	return null;
}

export function integrationUnconfirmedChoiceCopy(name: string) {
	return `Check your ${name} account first. If this item is missing, choosing Opnshelf sends the current version to ${name} once, even if sync is now inbound. Choosing ${name} deletes the Opnshelf version. An earlier request could still complete and create a duplicate.`;
}
export function integrationMissingConfirmation(name: string) {
	return `I checked ${name} and confirmed this item is missing.`;
}

/** A short status line for the Integrations list. */
export function integrationStatusLabel(status: SyncStatusDto | undefined) {
	if (!status || status.status === "disconnected") return "Not connected";
	if (status.status === "reconnect") return "Reconnect to continue";
	if (status.lastError) return "Sync error";
	if (status.needsAttention) return "Needs attention";
	if (status.status === "preparing") return "Comparing your history";
	if (status.status === "active") return "Sync is on";
	return status.lastSuccessAt ? "Paused" : "Not set up yet";
}

/** Why a write grant is needed, shown before the User is sent to authorize it. */
export function integrationWriteGrantCopy(name: string) {
	return `Sending changes to ${name} needs permission to create and update your ${name} records. Your account asks you to approve it. Other devices then need to sign in again.`;
}

/**
 * Words for connecting and stopping an Integration. An OAuth provider has an
 * account to connect; a repository provider such as Popfeed only has a sync to
 * set up or turn off, because its records are already the User's own.
 */
export function integrationConnectionCopy(
	integration: Pick<IntegrationDefinition, "name" | "connect">,
	username?: string,
) {
	const { name } = integration;
	if (integration.connect === "oauth")
		return {
			heading: username ? `@${username}` : `Connect your ${name} account`,
			handle: undefined,
			start: `Connect ${name}`,
			starting: `Opening ${name}…`,
			stop: "Disconnect",
			stopTitle: `Disconnect ${name}?`,
			stopBody:
				"Disconnecting stops sync and revokes access. Transferred records remain on both services. Reconnecting this account catches up previously linked records.",
			stopConfirm: "Confirm disconnect",
		};
	return {
		heading: `Your ${name} records`,
		handle: username ? `@${username}` : undefined,
		start: `Set up ${name} Sync`,
		starting: "Setting up…",
		stop: `Turn off ${name} Sync`,
		stopTitle: `Turn off ${name} Sync?`,
		stopBody: `Sync stops. Records already transferred stay in Opnshelf and on ${name}. Turning it back on catches up previously linked records.`,
		stopConfirm: `Turn off ${name} Sync`,
	};
}

/**
 * Whether an Integration is bringing the User's Watches into Opnshelf, so
 * onboarding can skip asking which titles they have watched.
 */
export function bringsIntegrationWatches(
	sync: Pick<SyncStatusDto, "status" | "direction" | "watches"> | undefined,
): boolean {
	return Boolean(
		sync &&
			(sync.status === "active" || sync.status === "preparing") &&
			sync.watches &&
			sync.direction !== "outbound",
	);
}

/** Words for the onboarding step that offers every Integration at once. */
export function onboardingIntegrationsCopy(
	integrations: readonly Pick<IntegrationDefinition, "name">[] = INTEGRATIONS,
) {
	const names = integrations.map(({ name }) => name);
	const either =
		names.length < 3
			? names.join(" or ")
			: `${names.slice(0, -1).join(", ")}, or ${names.at(-1)}`;
	return {
		title: `Already on ${either}?`,
		body: "Bring your history over and keep it in step. You choose what moves and in which direction, and confirm before anything transfers.",
		later: "You can change this later in Settings.",
	};
}

/**
 * What an Integration's onboarding row offers next. Connecting an OAuth
 * provider leaves the app; setting up a repository provider happens in place.
 */
export function onboardingIntegrationAction(
	integration: Pick<IntegrationDefinition, "name" | "connect">,
	status: SyncStatusDto,
):
	| { kind: "unavailable" }
	| { kind: "on" }
	| {
			kind: "connect";
			label: string;
			accessibilityLabel: string;
			pending: string;
	  }
	| { kind: "choose"; label: string; accessibilityLabel: string } {
	if (!status.configured) return { kind: "unavailable" };
	if (status.status === "active" || status.status === "preparing")
		return { kind: "on" };
	// Every row says the same short "Set up", so the buttons line up; the row
	// names the Integration and the accessibility label repeats it.
	const { name } = integration;
	if (status.status === "disconnected" || status.status === "reconnect") {
		const reconnect = status.status === "reconnect";
		return {
			kind: "connect",
			label: reconnect ? "Reconnect" : "Set up",
			accessibilityLabel: `${reconnect ? "Reconnect" : "Set up"} ${name} Sync`,
			pending: integration.connect === "oauth" ? "Opening…" : "Setting up…",
		};
	}
	return {
		kind: "choose",
		label: "Set up",
		accessibilityLabel: `Choose what to sync with ${name}`,
	};
}
