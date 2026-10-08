import type {
	SyncResolveDto,
	SyncSettingsDto,
	SyncStatusDto,
} from "./generated/types.gen";

export const TRAKT_SYNC_DIRECTIONS: {
	value: SyncSettingsDto["direction"];
	label: string;
}[] = [
	{ value: "both", label: "Both directions" },
	{ value: "inbound", label: "Trakt → Opnshelf" },
	{ value: "outbound", label: "Opnshelf → Trakt" },
];
export const TRAKT_SYNC_SCOPES: {
	value: SyncSettingsDto["historyScope"];
	label: string;
}[] = [
	{ value: "all", label: "All existing history and future changes" },
	{ value: "future", label: "Future changes only" },
];
export const TRAKT_PUBLICATION_COPY =
	"I understand that Watches and Ratings brought into Opnshelf become public, even if my Trakt profile is private.";
export const TRAKT_SCOPE_COPY =
	"Previously linked records catch up when re-enabled. Future changes start when the initial comparison finishes and refer to when a record is added or changed, not when you watched it.";
export const TRAKT_HANDOFF_COPY =
	"Continue my unfinished Import in Trakt Sync. Its progress and results stay available, but the original Import cannot resume—even if I disconnect sync.";
export function traktSettings(status: SyncStatusDto): SyncSettingsDto {
	return {
		direction: status.direction,
		watches: status.watches,
		ratings: status.ratings,
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
