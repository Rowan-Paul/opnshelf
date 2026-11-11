import { Injectable } from "@nestjs/common";
import { z } from "zod";
import type {
	IntegrationRemote,
	SyncRecordTypes,
} from "../integrations/adapter";
import {
	IntegrationError,
	SyncSnapshotChanged,
} from "../integrations/integration-error";
import type { SyncRecord } from "../integrations/reconcile";
import {
	LIST,
	LIST_ITEM,
	type PopfeedRecord,
	type PopfeedRepository,
	popfeedRecords,
	REVIEW,
} from "./popfeed-records";
import type { PopfeedWriter } from "./popfeed-writer";
import {
	syncPdsFailure,
	syncPdsRequests,
	syncPdsRequest,
} from "../integrations/sync-pds";

/**
 * Where the User's Popfeed records live and the timezone their dates mean.
 * `writer` exists only while the User grants Popfeed write access (ADR 0030).
 */
export type PopfeedCredential = {
	did: string;
	pds: string;
	timeZone: string;
	writer?: PopfeedWriter;
	/**
	 * The last consistent repository read and the commit revision it reflects.
	 * Lives as long as the credential, which is one sync run.
	 */
	read?: { rev: string; repository: PopfeedRepository };
};

const PAGE = 100;
// Stop instead of reading an unbounded repository in one sync run.
const MAX_PAGES = 200;

const pageSchema = z.object({
	records: z.array(z.object({ uri: z.string(), value: z.unknown() })),
	cursor: z.string().optional(),
});
const commitSchema = z.object({ cid: z.string(), rev: z.string() });

@Injectable()
export class PopfeedSyncClient implements IntegrationRemote<PopfeedCredential> {
	private async get(credential: PopfeedCredential, path: string) {
		let response: Response;
		try {
			response = await syncPdsRequests.run(credential.did, () =>
				syncPdsRequest(() =>
					fetch(new URL(`/xrpc/${path}`, credential.pds), {
						headers: { accept: "application/json" },
						signal: AbortSignal.timeout(15_000),
					}),
				),
			);
		} catch (error) {
			const failure = syncPdsFailure(error);
			if (failure instanceof IntegrationError) throw failure;
			throw new IntegrationError(
				"Your repository could not be reached. Sync will retry.",
				0,
				60,
			);
		}
		if (!response.ok)
			throw new IntegrationError(
				"Your repository did not return your Popfeed records. Sync will retry.",
				response.status,
				response.status === 429 ? 300 : 60,
			);
		return response.json() as Promise<unknown>;
	}

	private async collection(
		credential: PopfeedCredential,
		collection: string,
	): Promise<PopfeedRecord[]> {
		const records: PopfeedRecord[] = [];
		let cursor: string | undefined;
		for (let page = 0; page < MAX_PAGES; page++) {
			const query = new URLSearchParams({
				repo: credential.did,
				collection,
				limit: String(PAGE),
				...(cursor ? { cursor } : {}),
			});
			const data = pageSchema.parse(
				await this.get(credential, `com.atproto.repo.listRecords?${query}`),
			);
			records.push(...data.records);
			if (!data.cursor || !data.records.length) return records;
			cursor = data.cursor;
		}
		throw new IntegrationError(
			"Your Popfeed library is larger than one sync run can read.",
		);
	}

	private async revision(credential: PopfeedCredential) {
		const query = new URLSearchParams({ did: credential.did });
		return commitSchema.parse(
			await this.get(credential, `com.atproto.sync.getLatestCommit?${query}`),
		).rev;
	}

	async snapshot(
		credential: PopfeedCredential,
		types: SyncRecordTypes = {},
	): Promise<SyncRecord[]> {
		return popfeedRecords(
			await this.repository(credential),
			types,
			credential.timeZone,
		);
	}

	/**
	 * All three collections, for a writer that must see the current records.
	 * A writer given a partial view could recreate a record it missed, so a
	 * read the repository changed under stops the run instead.
	 */
	async repository(credential: PopfeedCredential): Promise<PopfeedRepository> {
		const repository = await this.read(credential);
		if (!repository)
			throw new SyncSnapshotChanged(
				"Your Popfeed records changed during the read. Sync will read a fresh snapshot.",
				0,
				5,
			);
		return repository;
	}

	/**
	 * A consistent read of all three collections, or null when the repository
	 * changed while it was read. A sync run reads the repository before a write,
	 * inside the writer and again to confirm it; while the commit revision is
	 * unchanged those reads return the same records, so reuse the last one.
	 * Every write advances the revision, so a confirmation always reads afresh.
	 */
	private async read(
		credential: PopfeedCredential,
	): Promise<PopfeedRepository | null> {
		const before = await this.revision(credential);
		if (credential.read?.rev === before) return credential.read.repository;
		const repository = await this.collections(credential);
		if ((await this.revision(credential)) !== before) return null;
		credential.read = { rev: before, repository };
		return repository;
	}

	private async collections(
		credential: PopfeedCredential,
	): Promise<PopfeedRepository> {
		const [listItems, reviews, lists] = await Promise.all([
			this.collection(credential, LIST_ITEM),
			this.collection(credential, REVIEW),
			// List records name custom Lists and, on older items, carry the List role.
			this.collection(credential, LIST),
		]);
		return { listItems, reviews, lists };
	}

	async readForRecord(
		credential: PopfeedCredential,
		record: SyncRecord,
	): Promise<SyncRecord[]> {
		return this.writerFor(credential).read(record.kind);
	}

	async write(
		credential: PopfeedCredential,
		record: SyncRecord,
		remove?: boolean,
		previous?: SyncRecord | null,
		onCreated?: (record: SyncRecord) => Promise<void>,
	): Promise<void> {
		return this.writerFor(credential).write(
			record,
			remove,
			previous,
			onCreated,
		);
	}

	private writerFor(credential: PopfeedCredential) {
		if (!credential.writer)
			throw new IntegrationError(
				"Allow Opnshelf to write your Popfeed records to send changes to Popfeed.",
				403,
			);
		return credential.writer;
	}
}
