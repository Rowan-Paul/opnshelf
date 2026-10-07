/**
 * One recoverable public -> private Watch move. A durable journal must commit
 * the verified copy before public deletion; a worker may retry after any await.
 * The caller holds the account's migration lock and hides public derived data.
 * This module is not exposed by an API until those account-wide gates exist.
 */
export const WATCH_COLLECTIONS = [
	"xyz.opnshelf.movie",
	"xyz.opnshelf.episode",
] as const;
export type WatchCollection = (typeof WATCH_COLLECTIONS)[number];
export interface WatchReference {
	collection: WatchCollection;
	rkey: string;
}
export interface StoredWatch {
	cid: string;
	value: Record<string, unknown>;
}
export interface WatchMoveReceipt extends WatchReference, StoredWatch {}
export type WatchVisibility = "public" | "private";
export interface WatchMigrationJournal {
	assertDirection(target: WatchVisibility): Promise<void>;
	/** Scoped to one owner and migration, never shared with another migration. */
	load(ref: WatchReference): Promise<WatchMoveReceipt | undefined>;
	/** Insert once; a retry with a different CID must fail, never overwrite. */
	recordVerifiedCopy(receipt: WatchMoveReceipt): Promise<void>;
}
export interface WatchMigrationRepository {
	readPublic(ref: WatchReference): Promise<StoredWatch | undefined>;
	readPrivate(ref: WatchReference): Promise<StoredWatch | undefined>;
	/** Create-only: never replace an existing record, even on a retry. */
	createPrivate(ref: WatchReference, record: StoredWatch): Promise<void>;
	/** Must use the PDS's atomic swapRecord precondition. Missing is success. */
	deletePublic(ref: WatchReference, expectedCid: string): Promise<void>;
	/** Fail closed unless both policies and membership are owner-only. */
	assertPrivate(): Promise<void>;
}
export class WatchMigrationConflict extends Error {
	constructor() {
		super(
			"A Watch changed during the privacy change. Both copies were preserved.",
		);
	}
}

export async function moveWatchToPrivate(
	ref: WatchReference,
	repository: WatchMigrationRepository,
	journal: WatchMigrationJournal,
): Promise<"moved" | "missing"> {
	await journal.assertDirection("private");
	return moveWatch(ref, repository, journal);
}

async function moveWatch(
	ref: WatchReference,
	repository: WatchMigrationRepository,
	journal: WatchMigrationJournal,
): Promise<"moved" | "missing"> {
	await repository.assertPrivate();
	const receipt = await journal.load(ref);
	const source = await repository.readPublic(ref);
	// A missing source without a committed receipt could be a user deletion.
	// Never infer a completed move from an unrelated destination record.
	if (!source && !receipt) return "missing";
	const expectedCid = receipt?.cid ?? source?.cid;
	if (!expectedCid || (source && source.cid !== expectedCid)) {
		throw new WatchMigrationConflict();
	}
	let destination = await repository.readPrivate(ref);
	if (!destination && source && !receipt) {
		await repository.createPrivate(ref, source);
		destination = await repository.readPrivate(ref);
	}
	// CIDs identify the complete canonical record, including extension fields.
	// A lost/changed private copy must never cause deletion of the public copy.
	if (destination?.cid !== expectedCid) throw new WatchMigrationConflict();
	// Keep the full record in the durable journal until the migration finishes.
	// The two repositories cannot commit atomically: this snapshot permits recovery
	// even if an external client deletes the destination during source removal.
	await journal.recordVerifiedCopy({ ...ref, ...destination });
	await repository.assertPrivate();
	if (source) await repository.deletePublic(ref, expectedCid);
	// Do not mark the batch complete while a source remains or was recreated.
	if (await repository.readPublic(ref)) throw new WatchMigrationConflict();
	if ((await repository.readPrivate(ref))?.cid !== expectedCid) {
		throw new WatchMigrationConflict();
	}
	return "moved";
}

export interface ReversibleWatchMigrationRepository
	extends WatchMigrationRepository {
	/** Fail before copying anything public if the PDS cannot safely remove the source. */
	assertConditionalPrivateDelete(): Promise<void>;
	assertExistingPrivate(): Promise<void>;
	createPublic(ref: WatchReference, record: StoredWatch): Promise<void>;
	deletePrivate(ref: WatchReference, expectedCid: string): Promise<void>;
}

/** The copy/verify/journal/conditional-delete algorithm is symmetric. A journal
 * must belong to this direction's job; never reuse receipts from the prior move. */
export async function moveWatchToPublic(
	ref: WatchReference,
	repository: ReversibleWatchMigrationRepository,
	journal: WatchMigrationJournal,
): Promise<"moved" | "missing"> {
	await journal.assertDirection("public");
	await repository.assertConditionalPrivateDelete();
	return moveWatch(
		ref,
		{
			assertPrivate: () => repository.assertExistingPrivate(),
			readPublic: (key) => repository.readPrivate(key),
			readPrivate: (key) => repository.readPublic(key),
			createPrivate: (key, record) => repository.createPublic(key, record),
			deletePublic: (key, cid) => repository.deletePrivate(key, cid),
		},
		journal,
	);
}
