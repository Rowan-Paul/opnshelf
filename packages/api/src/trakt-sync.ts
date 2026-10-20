import type {
	SyncIssueDto,
	SyncRecordDto,
	SyncResolveDto,
	SyncSettingsDto,
	SyncStatusDto,
} from "./generated/types.gen";

export const TRAKT_SYNC_DIRECTIONS: {
	value: SyncSettingsDto["direction"];
	label: string;
	title: string;
	description: string;
}[] = [
	{
		value: "inbound",
		label: "Trakt → Opnshelf",
		title: "From Trakt",
		description: "Bring changes into Opnshelf",
	},
	{
		value: "outbound",
		label: "Opnshelf → Trakt",
		title: "To Trakt",
		description: "Send changes to Trakt",
	},
	{
		value: "both",
		label: "Both directions",
		title: "Both ways",
		description: "Keep both services up to date",
	},
];
export const TRAKT_SYNC_SCOPES: {
	value: SyncSettingsDto["historyScope"];
	label: string;
}[] = [
	{ value: "all", label: "All existing history and future changes" },
	{ value: "future", label: "Future changes only" },
];
export const TRAKT_SYNC_RECORDS = [
	{ value: "watches", label: "Watch history" },
	{ value: "ratings", label: "Ratings" },
	{ value: "watchlist", label: "Watchlist" },
	{ value: "favorites", label: "Favorites" },
	{ value: "lists", label: "Custom Lists" },
	{ value: "library", label: "Library" },
	{ value: "notes", label: "Notes" },
	{ value: "reviews", label: "Reviews" },
] as const;
export const TRAKT_PUBLICATION_COPY =
	"I understand that sync uses the destination’s privacy settings. Private content can become public when transferred to a public destination. Ratings and Reviews in Opnshelf are public.";
export const TRAKT_LIST_COPY =
	"Sync custom Lists, including notes and manual order. Lists with the same name may need your choice before pairing. Watchlist sync includes Trakt’s automatic removals after watching.";
export const TRAKT_FAVORITES_COPY =
	"Sync favorite movies and shows, including notes and manual order. Private Favorites cannot be sent to Trakt yet. Unsupported items and Trakt limits appear in Needs attention.";
export const TRAKT_CONTENT_COPY =
	"Sync standalone Notes, Library ownership and your Reviews. Library item notes and Box Sets stay in Opnshelf. Unsupported formats, attachments and text need your attention. Imported Reviews do not create blog mirrors or Bluesky posts. Trakt Reviews must meet its English and 200-word requirements.";
export const TRAKT_SCOPE_COPY =
	"Previously linked records catch up when re-enabled. Future changes start when the initial comparison finishes and refer to when a record is added or changed, not when you watched it.";
export const TRAKT_HANDOFF_COPY =
	"Continue my unfinished Import in Trakt Sync. Its progress and results stay available, but the original Import cannot resume—even if I disconnect sync.";
export function traktSettings(status: SyncStatusDto): SyncSettingsDto {
	return {
		direction: status.direction,
		watches: status.watches,
		ratings: status.ratings,
		lists: status.lists ?? false,
		watchlist: status.watchlist ?? false,
		favorites: status.favorites ?? false,
		notes: status.notes ?? false,
		library: status.library ?? false,
		reviews: status.reviews ?? false,
		contentPublicationConsent: status.contentPublicationConsent ?? false,
		listPublicationConsent: status.listPublicationConsent ?? false,
		historyScope: status.historyScope,
		publicationConsent: status.publicationConsent,
	};
}
export function traktResolutionLabel(
	action: SyncResolveDto["action"],
	sourceExists: boolean,
) {
	if (action !== "trakt" && action !== "opnshelf") return action;
	return `Use ${action === "trakt" ? "Trakt" : "Opnshelf"}${sourceExists ? " (keep or restore this version)" : " (delete the other version)"}`;
}
export function traktError(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (
		error &&
		typeof error === "object" &&
		"message" in error &&
		typeof error.message === "string"
	)
		return error.message;
	return "Could not complete this action. Try again.";
}
/**
 * Errors and unresolved items take priority over background progress on both clients.
 */
export function traktSyncErrorMessage(
	sync:
		| (Pick<SyncStatusDto, "status"> &
				Partial<Pick<SyncStatusDto, "lastError" | "needsAttention">>)
		| undefined,
): string | null {
	if (!sync || sync.status === "disconnected") return null;
	if (sync.lastError) return "Trakt sync error";
	if (sync.needsAttention) return "Trakt sync needs attention";
	return null;
}
export function traktSyncCatchUpMessage(
	sync:
		| (Pick<SyncStatusDto, "status" | "remaining" | "progress"> &
				Partial<Pick<SyncStatusDto, "lastError" | "needsAttention">>)
		| undefined,
): string | null {
	const error = traktSyncErrorMessage(sync);
	if (error) return error;
	if (sync?.status === "preparing") return "Comparing with Trakt";
	if (sync?.status === "active" && sync.remaining > 0)
		return `Syncing with Trakt${sync.progress !== undefined ? ` — ${sync.progress}%` : ""}`;
	return null;
}
/**
 * Whether the User's Watch history is already coming over from Trakt — an
 * Import that has not stopped, or Trakt Sync bringing Watches in — so
 * onboarding can skip asking which titles they have watched.
 */
export function bringsTraktWatches(
	importJob: { status: string } | null | undefined,
	sync: Pick<SyncStatusDto, "status" | "direction" | "watches"> | undefined,
): boolean {
	if (importJob && importJob.status !== "failed") return true;
	return Boolean(
		sync &&
			(sync.status === "active" || sync.status === "preparing") &&
			sync.watches &&
			sync.direction !== "outbound",
	);
}

/** Older servers omit structured recovery fields; keep uncertain writes safe during rollout. */
export function traktIssueRecovery(
	item: SyncIssueDto,
): "verify" | "choose" | "retry" {
	if (item.recovery) return item.recovery;
	if (/outcome of creating .* is unknown/i.test(item.issue)) return "verify";
	return item.opnshelf && item.trakt ? "choose" : "retry";
}
export const TRAKT_UNCONFIRMED_CHOICE_COPY =
	"Check your Trakt account first. If this item is missing, choosing Opnshelf sends the current version to Trakt once, even if sync is now inbound. Choosing Trakt deletes the Opnshelf version. An earlier request could still complete and create a duplicate.";
export const TRAKT_MISSING_CONFIRMATION =
	"I checked Trakt and confirmed this item is missing.";

export function traktSyncActionLabel(status: SyncStatusDto): string {
	return status.syncState === "running"
		? "Syncing with Trakt…"
		: status.syncState === "queued"
			? "Sync queued"
			: status.syncState === "waiting"
				? "Waiting to retry"
				: "Sync now";
}

export function traktSyncStateMessage(status: SyncStatusDto): string | null {
	if (status.syncState === "running")
		return "Syncing with Trakt. You can keep using Opnshelf.";
	if (status.syncState === "queued")
		return "Your sync is queued. You can leave this page.";
	if (status.syncState === "waiting")
		return status.nextCheckAt
			? `Sync will retry automatically at ${new Date(status.nextCheckAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}.`
			: "Sync will retry automatically.";
	return null;
}

export function traktRecordTitle(
	record: SyncRecordDto | null | undefined,
): string | undefined {
	if (!record) return undefined;
	if (record.mediaType === "episode")
		return `${record.title} · S${record.season}E${record.episode}`;
	if (record.mediaType === "season")
		return `${record.title} · Season ${record.season}`;
	return record.title;
}
