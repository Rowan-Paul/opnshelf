import { Agent } from "@atproto/api";
import { Inject, Injectable } from "@nestjs/common";
import { AUTH_SERVICE } from "../auth/auth.tokens";
import type { AuthService } from "../auth/auth.service";
import { main as noteSchema } from "../lexicons/xyz/opnshelf/note";
import { main as librarySchema } from "../lexicons/xyz/opnshelf/library/item";
import { main as reviewSchema } from "../lexicons/xyz/opnshelf/review";
import { NotesService } from "../notes/notes.service";
import { LibraryService } from "../library/library.service";
import { PrismaService } from "../prisma/prisma.service";
import { ContentPrivacyCoordinator } from "../privacy/content-privacy-coordinator";
import {
	privacyRepositoryConfig,
	type PrivacyCollection,
} from "../privacy/privacy-category";
import { WatchMigrationPds } from "../privacy/watch-migration-pds";
import {
	createWatchAgent,
	requireWatchSession,
	watchOperation,
} from "../privacy/watch-operation";
import {
	contentValue,
	encodeContent,
	validateContent,
	type ContentKind,
	type ContentOptions,
} from "./content-value";
import {
	equivalent,
	fingerprint,
	mediaKey,
	type SyncRecord,
} from "./reconcile";

const collections = {
	note: "xyz.opnshelf.note",
	library: "xyz.opnshelf.library.item",
	review: "xyz.opnshelf.review",
} as const;
const schemas = {
	note: noteSchema,
	library: librarySchema,
	review: reviewSchema,
};
type Stored = {
	rkey: string;
	cid: string;
	uri: string;
	value: Record<string, unknown>;
};
export function localContentRecord(
	kind: ContentKind,
	stored: Stored,
	visibility: "public" | "private",
): SyncRecord {
	const r = schemas[kind].parse(stored.value);
	const value =
		kind === "note"
			? encodeContent({ content: noteSchema.parse(r).content })
			: kind === "review"
				? encodeContent({
						content: reviewSchema.parse(r).content,
						spoiler: reviewSchema.parse(r).spoiler ?? false,
					})
				: encodeContent({
						format: librarySchema.parse(r).format,
					});
	return {
		key: `${kind}:${stored.rkey}`,
		rkey: stored.rkey,
		cid: stored.cid,
		kind,
		mediaType: r.mediaType,
		mediaId: r.mediaId,
		season: r.seasonNumber ?? 0,
		episode: r.episodeNumber ?? 0,
		title:
			kind === "review"
				? reviewSchema.parse(r).title
				: `${kind === "note" ? "Note" : "Library Item"}: ${r.mediaType} ${r.mediaId}`,
		value,
		visibility,
		createdAt: r.createdAt,
	};
}

@Injectable()
export class LocalSyncContent {
	constructor(
		private readonly prisma: PrismaService,
		private readonly privacy: ContentPrivacyCoordinator,
		private readonly notes: NotesService,
		private readonly library: LibraryService,
		@Inject(AUTH_SERVICE) private readonly auth: Pick<AuthService, "restore">,
	) {}
	private async session(did: string) {
		const session = await this.auth.restore(did);
		if (!session) throw new Error("Sign in again to sync your content.");
		return requireWatchSession(session);
	}
	private async repository(did: string, kind: ContentKind) {
		const session = await this.session(did);
		const category = kind === "note" ? "notes" : "library";
		const scope =
			kind === "review" ? null : await this.privacy.scope(did, category);
		if (scope?.targetVisibility)
			throw new Error(
				"This category is changing privacy. Sync will retry after it finishes.",
			);
		const visibility: "public" | "private" =
			scope?.visibility === "private" ? "private" : "public";
		const agent = new Agent(session);
		const pds =
			kind === "review"
				? null
				: new WatchMigrationPds(
						did,
						requireWatchSession(session),
						watchOperation.getStore()?.signal,
						privacyRepositoryConfig(category),
					);
		if (visibility === "private") await pds?.assertExistingPrivate();
		const read = async () => {
			const result: Stored[] = [];
			let cursor: string | undefined;
			const cursors = new Set<string>();
			do {
				if (pds) {
					const page = await pds.list(
						collections[kind] as PrivacyCollection,
						visibility === "private",
						cursor,
					);
					result.push(...page.records);
					cursor = page.cursor;
				} else {
					const page = (
						await agent.com.atproto.repo.listRecords({
							repo: did,
							collection: collections.review,
							limit: 100,
							cursor,
						})
					).data;
					result.push(
						...page.records.map((record) => ({
							...record,
							rkey: record.uri.split("/").at(-1) ?? "",
						})),
					);
					cursor = page.cursor;
				}
				if (cursor && cursors.has(cursor))
					throw new Error(
						"Content pagination repeated. No removals were applied.",
					);
				if (cursor) cursors.add(cursor);
			} while (cursor);
			if (new Set(result.map((r) => r.rkey)).size !== result.length)
				throw new Error(
					"Content pagination contained duplicate records. No removals were applied.",
				);
			return result;
		};
		const records = await read();
		const after = await read();
		if (
			JSON.stringify(records.map((r) => [r.rkey, r.cid])) !==
			JSON.stringify(after.map((r) => [r.rkey, r.cid]))
		)
			throw new Error(
				"Content changed during the read. No removals were applied.",
			);
		return { records, visibility };
	}
	async snapshot(did: string, options: ContentOptions): Promise<SyncRecord[]> {
		const result: SyncRecord[] = [];
		for (const [scope, kind] of [
			["notes", "note"],
			["library", "library"],
			["reviews", "review"],
		] as const) {
			if (!options[scope]) continue;
			const repo = await this.repository(did, kind);
			result.push(
				...repo.records.map((r) =>
					localContentRecord(kind, r, repo.visibility),
				),
			);
		}
		const [movies, shows] = await Promise.all([
			this.prisma.movie.findMany({
				where: {
					movieId: {
						in: result
							.filter((r) => r.mediaType === "movie")
							.flatMap((r) => (r.mediaId ? [r.mediaId] : [])),
					},
				},
				select: { movieId: true, title: true },
			}),
			this.prisma.show.findMany({
				where: {
					showId: {
						in: result
							.filter((r) => r.mediaType !== "movie")
							.flatMap((r) => (r.mediaId ? [r.mediaId] : [])),
					},
				},
				select: { showId: true, title: true },
			}),
		]);
		for (const record of result) {
			if (record.kind === "review") continue;
			const title =
				record.mediaType === "movie"
					? movies.find((m) => m.movieId === record.mediaId)?.title
					: shows.find((s) => s.showId === record.mediaId)?.title;
			if (title) record.title = title;
		}
		for (const record of result.filter((r) => r.kind === "library")) {
			if (
				result.filter(
					(r) =>
						r.kind === "library" &&
						r.mediaType === record.mediaType &&
						r.mediaId === record.mediaId &&
						r.season === record.season &&
						r.episode === record.episode,
				).length > 1
			)
				record.problem =
					"Trakt cannot represent multiple owned formats for the same title. Your Library Items are preserved.";
		}
		return result;
	}
	async confirmDeleted(did: string, previous: SyncRecord) {
		const repo = await this.repository(did, previous.kind as ContentKind);
		if (repo.records.some((r) => r.rkey === previous.rkey))
			throw new Error(
				"The source repository still has this item. Retry after indexing.",
			);
	}
	async write(
		did: string,
		desired: SyncRecord | null,
		previous: SyncRecord | null,
		rkey: string,
	): Promise<SyncRecord | null> {
		const source = desired ?? previous;
		if (!source) return null;
		const kind = source.kind as ContentKind;
		const work = async () => {
			const repo = await this.repository(did, kind);
			const old = repo.records.find((r) => r.rkey === rkey);
			const current = old
				? localContentRecord(kind, old, repo.visibility)
				: null;
			if (desired && current && old && equivalent(desired, current)) {
				await this.index(did, kind, old);
				return current;
			}
			if (fingerprint(current) !== fingerprint(previous))
				throw new Error(
					"This item changed before transfer. Choose which version to keep.",
				);
			if (kind === "review" && old) {
				const indexed = await this.prisma.review.findUnique({
					where: { userDid_rkey: { userDid: did, rkey } },
				});
				if (indexed?.blogDocumentUri)
					throw new Error(
						"This Review has a Blog Mirror. Manage edits or deletion in Opnshelf, or choose the Opnshelf version.",
					);
			}
			const session = await this.session(did);
			const agent = createWatchAgent(session, true);
			const collection = collections[kind];
			if (!desired) {
				if (!old) return null;
				await agent.com.atproto.repo.deleteRecord({
					repo: did,
					collection,
					rkey,
					...(repo.visibility === "public" ? { swapRecord: old.cid } : {}),
				});
				if (kind === "note") await this.notes.deleteNoteRecord(did, rkey);
				else if (kind === "library")
					await this.library.deleteLibraryItemRecord(did, rkey);
				else
					await this.prisma.review.deleteMany({
						where: { userDid: did, rkey },
					});
				return null;
			}
			validateContent(desired);
			if (desired.mediaType === "list" || !desired.mediaId)
				throw new Error("This attachment has no Opnshelf equivalent.");
			if (
				!old &&
				kind !== "review" &&
				repo.records.some(
					(r) =>
						mediaKey(localContentRecord(kind, r, repo.visibility)) ===
						mediaKey(desired),
				)
			)
				throw new Error(
					"An existing item for this title needs an explicit source choice. Nothing was overwritten.",
				);
			const value = contentValue(desired);
			const record = {
				...old?.value,
				...schemas[kind].parse({
					$type: collections[kind],
					mediaType: desired.mediaType,
					mediaId: desired.mediaId,
					seasonNumber: desired.season,
					episodeNumber: desired.episode,
					createdAt:
						typeof old?.value.createdAt === "string"
							? old.value.createdAt
							: (desired.createdAt ?? new Date().toISOString()),
					...(kind === "note"
						? { content: value.content }
						: kind === "library"
							? {
									format: value.format,
									notes: old?.value.notes,
									boxSet: old?.value.boxSet,
								}
							: {
									content: value.content,
									spoiler: value.spoiler,
									title:
										typeof old?.value.title === "string"
											? old.value.title
											: desired.title.slice(0, 300),
									updatedAt: new Date().toISOString(),
								}),
				}),
			};
			if (kind === "library") {
				const v = record as Record<string, unknown>;
				if (!old?.value.notes) delete v.notes;
				if (!old?.value.boxSet) delete v.boxSet;
			}
			const response = (
				await agent.com.atproto.repo.putRecord({
					repo: did,
					collection,
					rkey,
					record,
					validate: false,
					...(repo.visibility === "public"
						? { swapRecord: old?.cid ?? null }
						: {}),
				})
			).data;
			const written = { ...response, rkey, value: record };
			await this.index(did, kind, written);
			const confirmed = (await this.repository(did, kind)).records.find(
				(r) => r.rkey === rkey,
			);
			if (
				!confirmed ||
				!equivalent(
					localContentRecord(kind, confirmed, repo.visibility),
					desired,
				)
			)
				throw new Error(
					"The repository has not confirmed this item. Retry to reconcile.",
				);
			return localContentRecord(kind, confirmed, repo.visibility);
		};
		if (kind === "review") {
			const parent = watchOperation.getStore();
			if (!parent || parent.did !== did)
				throw new Error("Content writes require the account lock.");
			return watchOperation.run(
				{ ...parent, visibility: "public", repository: undefined },
				work,
			);
		}
		return this.privacy.write(
			did,
			kind === "note" ? "notes" : "library",
			undefined,
			work,
		);
	}
	private async index(did: string, kind: ContentKind, stored: Stored) {
		if (kind === "note")
			return this.notes.indexNoteRecord(
				stored.uri,
				stored.cid,
				stored.rkey,
				did,
				noteSchema.parse(stored.value),
			);
		if (kind === "library")
			return this.library.indexLibraryItemRecord(
				stored.uri,
				stored.cid,
				stored.rkey,
				did,
				librarySchema.parse(stored.value),
			);
		const r = reviewSchema.parse(stored.value);
		const fields = {
			cid: stored.cid,
			mediaType: r.mediaType,
			mediaId: r.mediaId,
			seasonNumber: r.seasonNumber ?? 0,
			episodeNumber: r.episodeNumber ?? 0,
			title: r.title,
			markdown: r.content,
			spoiler: r.spoiler ?? false,
		};
		await this.prisma.review.upsert({
			where: { userDid_rkey: { userDid: did, rkey: stored.rkey } },
			create: {
				...fields,
				userDid: did,
				rkey: stored.rkey,
				uri: stored.uri,
				mirrorToBlog: false,
				createdAt: new Date(r.createdAt),
			},
			update: fields,
		});
	}
}
