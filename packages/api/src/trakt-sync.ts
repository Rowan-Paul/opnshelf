import type {
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
export const TRAKT_PUBLICATION_COPY =
	"I understand that sync can make private content public. Watches and Ratings imported into Opnshelf are public. Lists and watchlists use the privacy settings where they’re saved.";
export const TRAKT_LIST_COPY =
	"Sync custom Lists, including notes and manual order. Lists with the same name may need your choice before pairing. Watchlist sync includes Trakt’s automatic removals after watching.";
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
 * The site-wide banner line while Trakt Sync is still comparing or catching up
 * on a backlog larger than one batch, or `null` when it has nothing to report.
 */
export function traktSyncCatchUpMessage(
	sync: Pick<SyncStatusDto, "status" | "remaining" | "progress"> | undefined,
): string | null {
	if (sync?.status === "preparing")
		return "Comparing your Trakt history in the background";
	if (sync?.status === "active" && sync.remaining > 0)
		return `Syncing your Trakt history in the background${sync.progress !== undefined ? ` — ${sync.progress}%` : ""}`;
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
