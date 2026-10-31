import type { SyncRecord } from "./reconcile";

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

/**
 * The remote side of one Integration provider (ADR 0051). The shared core owns
 * links, baselines, conflicts and Needs attention; an adapter only reads and
 * writes the provider and reports what it cannot represent as a thrown error.
 */
export interface IntegrationRemote<Credential> {
	/** A complete, consistent read of the enabled types. Partial reads must throw. */
	snapshot(
		credential: Credential,
		types?: SyncRecordTypes,
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
