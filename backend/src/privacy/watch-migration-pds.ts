import {
	privacyRepositoryConfig,
	type PrivacyRepositoryConfig,
	type PrivacyCollection,
} from "./privacy-category";
import { includesWatchSpaceGrant } from "../auth/oauth-scopes";
import {
	WatchMigrationConflict,
	type StoredWatch,
	type ReversibleWatchMigrationRepository,
	type WatchReference,
} from "./watch-record-migration";

export const WATCH_SPACE_TYPE = "xyz.opnshelf.watches";
export interface WatchOAuthSession {
	did: string;
	fetchHandler(path: string, init?: RequestInit): Promise<Response>;
	getTokenInfo(): Promise<{ scope?: string | string[] }>;
}
export class WatchMigrationPdsError extends Error {
	constructor(
		readonly code: string,
		readonly status: number,
	) {
		// Never include OAuth response headers, URLs, tokens or record bodies.
		super(`Watch privacy request failed (${code})`);
	}
}
const MEMBER_POLICY = "com.atproto.simplespace.defs#memberListPolicy";
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
function object(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** OAuth/DPoP transport using reference Spaces. Public deletion uses CAS;
 * private deletion rechecks the source under the documented alpha contract. */
export class WatchMigrationPds implements ReversibleWatchMigrationRepository {
	readonly space: string;
	constructor(
		private readonly ownerDid: string,
		private readonly session: WatchOAuthSession,
		private readonly operationSignal?: AbortSignal,
		private readonly config: PrivacyRepositoryConfig = privacyRepositoryConfig(
			"watches",
		),
	) {
		if (session.did !== ownerDid)
			throw new Error("Watch migration owner does not match the session");
		this.space = `at://${ownerDid}/space/${config.spaceType}/${config.skey}`;
	}
	private params(ref: WatchReference, privateRepo: boolean) {
		if (
			!this.config.collections.includes(ref.collection) ||
			!/^[a-zA-Z0-9._~:-]{1,512}$/.test(ref.rkey) ||
			ref.rkey === "." ||
			ref.rkey === ".."
		) {
			throw new Error("Invalid Watch reference");
		}
		return {
			...(privateRepo ? { space: this.space } : {}),
			repo: this.ownerDid,
			collection: ref.collection,
			rkey: ref.rkey,
		};
	}
	private async call(
		method: string,
		params: Record<string, unknown>,
		write = false,
	): Promise<Record<string, unknown>> {
		this.operationSignal?.throwIfAborted();
		if (
			this.session.did !== this.ownerDid ||
			((method.startsWith("com.atproto.space.") ||
				method.startsWith("com.atproto.simplespace.")) &&
				!includesWatchSpaceGrant(
					(await this.session.getTokenInfo()).scope,
					this.config.scope,
					this.ownerDid,
				))
		) {
			throw new WatchMigrationPdsError("InsufficientScope", 403);
		}
		const query = new URLSearchParams();
		if (!write)
			for (const [key, value] of Object.entries(params))
				query.set(key, String(value));
		const response = await this.session.fetchHandler(
			`/xrpc/${method}${write ? "" : `?${query}`}`,
			{
				method: write ? "POST" : "GET",
				...(write
					? {
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify(params),
						}
					: {}),
				signal: AbortSignal.any([
					AbortSignal.timeout(10_000),
					...(this.operationSignal ? [this.operationSignal] : []),
				]),
			},
		);
		const reader = response.body?.getReader();
		const chunks: Uint8Array[] = [];
		let size = 0;
		if (reader) {
			try {
				for (;;) {
					const { value, done } = await reader.read();
					if (done) break;
					size += value.byteLength;
					if (size > MAX_RESPONSE_BYTES)
						throw new WatchMigrationPdsError(
							"ResponseTooLarge",
							response.status,
						);
					chunks.push(value);
				}
			} finally {
				await reader.cancel();
				reader.releaseLock();
			}
		}
		let body: unknown;
		try {
			body = size ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
		} catch {
			throw new WatchMigrationPdsError("InvalidResponse", response.status);
		}
		if (!object(body))
			throw new WatchMigrationPdsError("InvalidResponse", response.status);
		if (!response.ok) {
			throw new WatchMigrationPdsError(
				typeof body.error === "string" && /^[A-Za-z]{1,80}$/.test(body.error)
					? body.error
					: "UnknownError",
				response.status,
			);
		}
		return body;
	}
	/** Interactive private operations use the same owner/policy/scope checks. */
	async watchRequest(method: string, params: object, write: boolean) {
		await this.assertExistingPrivate();
		const input = params as Record<string, unknown>;
		if (input.repo !== this.ownerDid) throw new Error("Watch owner mismatch");
		const collections = Array.isArray(input.writes)
			? input.writes.map((w) => w.collection)
			: [input.collection];
		if (
			collections.some(
				(c) => !this.config.collections.some((allowed) => allowed === c),
			)
		)
			throw new Error("Invalid Watch collection");
		return this.call(
			`com.atproto.space.${method}`,
			{ ...input, space: this.space },
			write,
		);
	}
	async list(
		collection: PrivacyCollection,
		privateRepo: boolean,
		cursor?: string,
		limit = 100,
	) {
		const body = await this.call(
			`com.atproto.${privateRepo ? "space" : "repo"}.listRecords`,
			{
				...(privateRepo ? { space: this.space } : {}),
				repo: this.ownerDid,
				collection,
				limit,
				...(cursor ? { cursor } : {}),
			},
		);
		if (
			!Array.isArray(body.records) ||
			(body.cursor !== undefined && typeof body.cursor !== "string")
		)
			throw new WatchMigrationPdsError("InvalidResponse", 502);
		const prefix = privateRepo
			? `${this.space}/${this.ownerDid}/${collection}/`
			: `at://${this.ownerDid}/${collection}/`;
		const records = body.records.map((record) => {
			if (
				!object(record) ||
				(privateRepo
					? record.collection !== collection || typeof record.rkey !== "string"
					: typeof record.uri !== "string" || !record.uri.startsWith(prefix)) ||
				typeof record.cid !== "string" ||
				!object(record.value) ||
				record.value.$type !== collection
			)
				throw new WatchMigrationPdsError("InvalidRecord", 502);
			const rkey = privateRepo
				? String(record.rkey)
				: String(record.uri).slice(prefix.length);
			this.params({ collection, rkey }, privateRepo);
			return {
				collection,
				rkey,
				uri: `${prefix}${rkey}`,
				cid: record.cid,
				value: record.value,
			};
		});
		return { records, cursor: body.cursor as string | undefined };
	}
	assertPrivate(): Promise<void> {
		return this.checkPrivate(true);
	}
	assertExistingPrivate(): Promise<void> {
		return this.checkPrivate(false);
	}
	private async checkPrivate(create: boolean): Promise<void> {
		let config: Record<string, unknown>;
		try {
			config = await this.call("com.atproto.simplespace.getSpace", {
				space: this.space,
			});
		} catch (error) {
			if (
				!create ||
				!(error instanceof WatchMigrationPdsError) ||
				!["SpaceNotFound", "SpaceDeleted"].includes(error.code)
			)
				throw error;
			try {
				await this.call(
					"com.atproto.simplespace.createSpace",
					{
						spaceType: this.config.spaceType,
						skey: this.config.skey,
						readPolicy: { $type: MEMBER_POLICY },
						writePolicy: { $type: MEMBER_POLICY },
						appAccess: { $type: "com.atproto.simplespace.defs#open" },
					},
					true,
				);
			} catch (race) {
				if (
					!(race instanceof WatchMigrationPdsError) ||
					race.code !== "SpaceAlreadyExists"
				)
					throw race;
			}
			config = await this.call("com.atproto.simplespace.getSpace", {
				space: this.space,
			});
		}
		for (const key of ["readPolicy", "writePolicy"]) {
			if (!object(config[key]) || config[key].$type !== MEMBER_POLICY)
				throw new WatchMigrationPdsError("SpaceNotPrivate", 403);
		}
		const members = await this.call("com.atproto.simplespace.listMembers", {
			space: this.space,
			limit: 100,
		});
		if (
			!Array.isArray(members.members) ||
			members.cursor ||
			members.members.some(
				(member) => !object(member) || member.did !== this.ownerDid,
			)
		) {
			throw new WatchMigrationPdsError("SpaceNotPrivate", 403);
		}
	}
	private async read(
		ref: WatchReference,
		privateRepo: boolean,
	): Promise<StoredWatch | undefined> {
		try {
			const response = await this.call(
				`com.atproto.${privateRepo ? "space" : "repo"}.getRecord`,
				this.params(ref, privateRepo),
			);
			if (
				typeof response.cid !== "string" ||
				!response.cid ||
				!object(response.value) ||
				response.value.$type !== ref.collection
			) {
				throw new WatchMigrationPdsError("InvalidRecord", 502);
			}
			return { cid: response.cid, value: response.value };
		} catch (error) {
			if (
				error instanceof WatchMigrationPdsError &&
				error.code === "RecordNotFound"
			)
				return undefined;
			throw error;
		}
	}
	readPublic(ref: WatchReference) {
		return this.read(ref, false);
	}
	readPrivate(ref: WatchReference) {
		return this.read(ref, true);
	}
	createPrivate(ref: WatchReference, record: StoredWatch) {
		return this.create(ref, record, true);
	}
	createPublic(ref: WatchReference, record: StoredWatch) {
		return this.create(ref, record, false);
	}
	private async create(
		ref: WatchReference,
		record: StoredWatch,
		privateRepo: boolean,
	) {
		try {
			await this.call(
				`com.atproto.${privateRepo ? "space" : "repo"}.createRecord`,
				{
					...this.params(ref, privateRepo),
					record: record.value,
					validate: false,
				},
				true,
			);
		} catch (error) {
			// Public and Spaces PDSs use different create-conflict error codes.
			// A timeout can also follow a successful create. Recover only from
			// evidence of the exact destination copy, never an error name alone.
			const existing = await this.read(ref, privateRepo).catch(() => undefined);
			if (!existing) throw error;
			if (existing.cid !== record.cid) throw new WatchMigrationConflict();
		}
	}
	deletePublic(ref: WatchReference, expectedCid: string) {
		return this.remove(ref, expectedCid, false);
	}
	async deletePrivate(ref: WatchReference, expectedCid: string) {
		// Reference Spaces has no atomic revision precondition. Detect changes
		// already visible now; another app can still write between this read and
		// delete. ADR 0048 explicitly accepts that limitation for this alpha.
		const current = await this.readPrivate(ref);
		if (!current) return;
		if (current.cid !== expectedCid) throw new WatchMigrationConflict();
		return this.remove(ref, expectedCid, true);
	}
	private async remove(
		ref: WatchReference,
		expectedCid: string,
		privateRepo: boolean,
	) {
		if (!expectedCid)
			throw new Error("Conditional deletion requires a record CID");
		try {
			await this.call(
				`com.atproto.${privateRepo ? "space" : "repo"}.deleteRecord`,
				{
					...this.params(ref, privateRepo),
					...(privateRepo ? {} : { swapRecord: expectedCid }),
				},
				true,
			);
		} catch (error) {
			if (
				error instanceof WatchMigrationPdsError &&
				error.code === "InvalidSwap"
			) {
				// Tranquil also uses InvalidSwap if the source was deleted concurrently.
				// Re-read only to distinguish absence; never retry an unconditional delete.
				if (!(await this.read(ref, privateRepo))) return;
				throw new WatchMigrationConflict();
			}
			if (
				!(error instanceof WatchMigrationPdsError) ||
				error.code !== "RecordNotFound"
			)
				throw error;
		}
	}
}
