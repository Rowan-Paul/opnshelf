import type { Direction, SyncRecord } from "./reconcile";

/** Record types a User can enable per Integration connection. */
export type SyncRecordTypes = {
	watches?: boolean;
	ratings?: boolean;
	lists?: boolean;
	watchlist?: boolean;
	favorites?: boolean;
	notes?: boolean;
	library?: boolean;
	reviews?: boolean;
};

export const SYNC_RECORD_TYPES = {
	watches: "Watches",
	ratings: "Ratings",
	lists: "Lists",
	watchlist: "the watchlist",
	favorites: "Favorites",
	notes: "Notes",
	library: "Library Items",
	reviews: "Reviews",
} as const satisfies Record<keyof SyncRecordTypes, string>;

/**
 * What a provider can sync (ADR 0051). The shared core refuses settings and
 * Needs attention choices outside it, so no adapter repeats those checks.
 */
export type IntegrationCapabilities = {
	records: readonly (keyof SyncRecordTypes)[];
	directions: readonly Direction[];
};

/**
 * The remote side of one Integration provider (ADR 0051). The shared core owns
 * links, baselines, conflicts and Needs attention; an adapter only reads and
 * writes the provider and reports what it cannot represent as a thrown error.
 */
export interface IntegrationRemote<Credential> {
	/** A complete read; partial reads throw. Durable adapter state must use the run's acquired leaseId. */
	snapshot(
		credential: Credential,
		types?: SyncRecordTypes,
		leaseId?: string,
		/** Read-only checkpoints may stop a long snapshot between requests. */
		checkpoint?: () => void,
	): Promise<SyncRecord[]>;
	/** A scoped read that confirms the outcome of one write. */
	readForRecord(
		credential: Credential,
		record: SyncRecord,
	): Promise<SyncRecord[]>;
	write(
		credential: Credential,
		record: SyncRecord,
		remove?: boolean,
		previous?: SyncRecord | null,
		onCreated?: (record: SyncRecord) => Promise<void>,
	): Promise<void>;
}
