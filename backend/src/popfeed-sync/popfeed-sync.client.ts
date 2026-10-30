import { Injectable } from "@nestjs/common";
import { z } from "zod";
import type {
	IntegrationRemote,
	SyncRecordTypes,
} from "../integrations/adapter";
import { IntegrationError } from "../integrations/integration-error";
import type { SyncRecord } from "../integrations/reconcile";
import {
	LIST,
	LIST_ITEM,
	popfeedRecords,
	REVIEW,
	type PopfeedRecord,
} from "./popfeed-records";

/** Where the User's Popfeed records live, and the timezone their dates mean. */
export type PopfeedCredential = { did: string; pds: string; timeZone: string };

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
			response = await fetch(new URL(`/xrpc/${path}`, credential.pds), {
				headers: { accept: "application/json" },
				signal: AbortSignal.timeout(15_000),
			});
		} catch {
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
		const before = await this.revision(credential);
		const items = types.watches || types.watchlist || types.lists;
		const listItems = items ? await this.collection(credential, LIST_ITEM) : [];
		const reviews =
			types.ratings || types.reviews
				? await this.collection(credential, REVIEW)
				: [];
		// List records name custom Lists and, on older items, carry the List role.
		const lists = items ? await this.collection(credential, LIST) : [];
		if ((await this.revision(credential)) !== before)
			throw new IntegrationError(
				"Your Popfeed records changed during the read. Sync will read a fresh snapshot.",
				0,
				5,
			);
		return popfeedRecords(
			{ listItems, reviews, lists },
			types,
			credential.timeZone,
		);
	}

	async readForRecord(): Promise<SyncRecord[]> {
		throw new IntegrationError("Opnshelf → Popfeed is not available yet.");
	}

	async write(): Promise<void> {
		throw new IntegrationError("Opnshelf → Popfeed is not available yet.");
	}
}
