import { Inject, Injectable } from "@nestjs/common";
import { TID } from "@atproto/common";
import { AUTH_SERVICE } from "../auth/auth.tokens";
import type { AuthService } from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { ListsService } from "../lists/lists.service";
import { main as listSchema } from "../lexicons/xyz/opnshelf/list";
import { main as itemSchema } from "../lexicons/xyz/opnshelf/list/item";
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
	encodeList,
	listValue,
	memberKey,
	validateList,
	type ListMember,
} from "./list-value";
import { equivalent, fingerprint, type SyncRecord } from "./reconcile";

type Stored = Awaited<ReturnType<WatchMigrationPds["list"]>>["records"][number];
const LIST = "xyz.opnshelf.list";
const ITEM = "xyz.opnshelf.list.item";

@Injectable()
export class LocalSyncLists {
	constructor(
		private readonly prisma: PrismaService,
		private readonly lists: ListsService,
		private readonly privacy: ContentPrivacyCoordinator,
		@Inject(AUTH_SERVICE) private readonly auth: Pick<AuthService, "restore">,
	) {}
	private async session(did: string) {
		const session = await this.auth.restore(did);
		if (!session) throw new Error("Sign in again to sync Lists.");
		return requireWatchSession(session);
	}
	private async all(
		pds: WatchMigrationPds,
		collection: PrivacyCollection,
		privateRepo: boolean,
	) {
		const result: Stored[] = [];
		const cursors = new Set<string>();
		let cursor: string | undefined;
		do {
			const page = await pds.list(collection, privateRepo, cursor);
			result.push(...page.records);
			cursor = page.cursor;
			if (cursor && cursors.has(cursor))
				throw new Error(
					"List repository pagination repeated. No removals were applied.",
				);
			if (cursor) cursors.add(cursor);
		} while (cursor);
		if (new Set(result.map((r) => r.rkey)).size !== result.length)
			throw new Error(
				"List repository changed during pagination. Retry before applying removals.",
			);
		return result;
	}
	private async repository(did: string, rkey: string, privateRepo: boolean) {
		const session = await this.session(did);
		const pds = new WatchMigrationPds(
			did,
			session,
			watchOperation.getStore()?.signal,
			privacyRepositoryConfig("lists", rkey),
		);
		if (privateRepo) await pds.assertExistingPrivate();
		const parents = await this.all(pds, LIST, privateRepo);
		const items = await this.all(pds, ITEM, privateRepo);
		// Recheck parent metadata after paging memberships. A failed read never means deletion.
		const after = await this.all(pds, LIST, privateRepo);
		const afterItems = await this.all(pds, ITEM, privateRepo);
		if (
			JSON.stringify(items.map((r) => [r.rkey, r.cid])) !==
			JSON.stringify(afterItems.map((r) => [r.rkey, r.cid]))
		)
			throw new Error(
				"List memberships changed during the read. No removals were applied.",
			);
		if (
			JSON.stringify(parents.map((r) => [r.rkey, r.cid])) !==
			JSON.stringify(after.map((r) => [r.rkey, r.cid]))
		)
			throw new Error("Lists changed during the read. Sync will retry.");
		return { parents, items };
	}
	private async record(
		did: string,
		parent: Stored,
		items: Stored[],
		visibility: "public" | "private",
	): Promise<SyncRecord> {
		const list = listSchema.parse(parent.value);
		const positions = await this.prisma.listItem.findMany({
			where: { userDid: did, list: { rkey: parent.rkey } },
			select: { rkey: true, position: true },
		});
		const ordered = items
			.filter((r) => r.value.listRkey === parent.rkey)
			.sort((a, b) => {
				const pos = (r: Stored) =>
					positions.find((p) => p.rkey === r.rkey)?.position ??
					Number.MAX_SAFE_INTEGER;
				return pos(a) - pos(b) || a.rkey.localeCompare(b.rkey);
			});
		const members = ordered.map((r): ListMember => {
			const item = itemSchema.parse(r.value);
			return {
				mediaType: item.mediaType,
				mediaId: item.mediaId,
				season: item.seasonNumber ?? 0,
				episode: item.episodeNumber ?? 0,
				notes: item.notes ?? "",
			};
		});
		const kind =
			list.isDefault && (list.slug === "watchlist" || list.slug === "favorites")
				? list.slug
				: "list";
		return {
			key: `${kind}:${parent.rkey}`,
			rkey: parent.rkey,
			cid: parent.cid,
			kind,
			mediaType: "list",
			mediaId: null,
			title: list.name,
			season: 0,
			episode: 0,
			visibility,
			value: encodeList({
				name:
					kind === "watchlist"
						? "Watchlist"
						: kind === "favorites"
							? "Favorites"
							: list.name,
				description: kind !== "list" ? "" : (list.description ?? ""),
				items: members,
			}),
		};
	}
	async snapshot(
		did: string,
		options: { lists?: boolean; watchlist?: boolean; favorites?: boolean } = {
			lists: true,
			watchlist: true,
			favorites: true,
		},
	): Promise<SyncRecord[]> {
		const scopes = await this.prisma.privacyScope.findMany({
			where: { userDid: did, category: "lists", status: { not: "deleted" } },
		});
		if (scopes.some((s) => s.targetVisibility))
			throw new Error(
				"List sync is waiting for a List privacy change to finish.",
			);
		const selected = (parent: Stored) =>
			parent.value.isDefault
				? (parent.value.slug === "watchlist" && options.watchlist) ||
					(parent.value.slug === "favorites" && options.favorites)
				: options.lists;
		const indexed = await this.prisma.list.findMany({
			where: { userDid: did },
			select: { rkey: true, isDefault: true, slug: true },
		});
		const publicRepo = await this.repository(did, "public", false);
		const result: SyncRecord[] = [];
		for (const parent of publicRepo.parents) {
			if (
				scopes.some(
					(s) => s.listRkey === parent.rkey && s.visibility === "private",
				)
			)
				continue;
			if (!selected(parent)) continue;
			result.push(await this.record(did, parent, publicRepo.items, "public"));
		}
		for (const scope of scopes) {
			if (scope.visibility !== "private" || !scope.listRkey) continue;
			const projection = indexed.find((list) => list.rkey === scope.listRkey);
			if (!projection)
				throw new Error(
					"A private List is waiting for indexing. Retry after Privacy finishes refreshing.",
				);
			if (
				projection.isDefault
					? !(
							(projection.slug === "watchlist" && options.watchlist) ||
							(projection.slug === "favorites" && options.favorites)
						)
					: !options.lists
			)
				continue;
			const repo = await this.repository(did, scope.listRkey, true);
			for (const parent of repo.parents) {
				if (parent.rkey !== scope.listRkey)
					throw new Error(
						"Private List repository contains an unexpected List.",
					);
				if (!selected(parent)) continue;
				result.push(await this.record(did, parent, repo.items, "private"));
			}
		}
		return result;
	}
	async confirmDeleted(did: string, previous: SyncRecord) {
		if (
			(
				await this.snapshot(did, {
					lists: previous.kind === "list",
					watchlist: previous.kind === "watchlist",
					favorites: previous.kind === "favorites",
				})
			).some((r) => r.key === previous.key)
		)
			throw new Error(
				"The PDS still has this List. Waiting for indexing to catch up.",
			);
	}
	async write(
		did: string,
		desired: SyncRecord | null,
		previous: SyncRecord | null,
		rkey: string,
	): Promise<SyncRecord | null> {
		const scope = await this.privacy.scope(did, "lists", rkey);
		const exists = Boolean(previous) || Boolean(scope);
		return this.privacy.write(
			did,
			"lists",
			exists ? rkey : undefined,
			async () => {
				const session = await this.session(did);
				if (!exists) await this.privacy.prepareNewList(did, rkey);
				const context = watchOperation.getStore();
				if (!context)
					throw new Error("List writes require the privacy coordinator.");
				const privateRepo = context.visibility === "private";
				const agent = createWatchAgent(session, true);
				const pds = new WatchMigrationPds(
					did,
					session,
					context.signal,
					privacyRepositoryConfig("lists", rkey),
				);
				const remove = async (record: Stored) => {
					if (privateRepo)
						await pds.deletePrivate(
							{ collection: record.collection, rkey: record.rkey },
							record.cid,
						);
					else
						await agent.com.atproto.repo.deleteRecord({
							repo: did,
							collection: record.collection,
							rkey: record.rkey,
							swapRecord: record.cid,
						});
				};
				const put = async (
					collection: PrivacyCollection,
					recordKey: string,
					record: Record<string, unknown>,
					old?: Stored,
				) => {
					if (privateRepo) {
						const current = await pds.readPrivate({
							collection,
							rkey: recordKey,
						});
						if ((current?.cid ?? null) !== (old?.cid ?? null))
							throw new Error(
								"This private List record changed before transfer. Choose which version to keep.",
							);
					}
					return agent.com.atproto.repo.putRecord({
						repo: did,
						collection,
						rkey: recordKey,
						record,
						...(privateRepo ? {} : { swapRecord: old?.cid ?? null }),
						validate: false,
					});
				};

				// Create a private Space before the first authoritative read.
				if (privateRepo && !exists) {
					const pds = new WatchMigrationPds(
						did,
						session,
						context.signal,
						privacyRepositoryConfig("lists", rkey),
					);
					await pds.assertPrivate();
					await this.privacy.activateNewList(did, rkey);
				}
				const repo = await this.repository(did, rkey, privateRepo);
				const parent = repo.parents.find((r) => r.rkey === rkey);
				const current = parent
					? await this.record(did, parent, repo.items, context.visibility)
					: null;
				if (desired && current && parent && equivalent(current, desired)) {
					await this.index(did, parent, repo.items);
					return current;
				}
				if (fingerprint(current) !== fingerprint(previous))
					throw new Error(
						"This List changed during a transfer. Choose which version to keep before retrying.",
					);
				if (!desired) {
					if (!parent) return null;
					if (listSchema.parse(parent.value).isDefault)
						throw new Error(
							"Default Lists cannot be deleted. Remove memberships instead.",
						);
					for (const item of repo.items.filter(
						(r) => r.value.listRkey === rkey,
					))
						await remove(item);
					await remove(parent);
					await this.lists.deleteListRecord(did, rkey);
					await this.prisma.privacyScope.updateMany({
						where: { userDid: did, key: `lists:${rkey}` },
						data: { status: "deleted" },
					});
					return null;
				}
				const value = listValue(desired);
				validateList(value);
				if (value.items.some((i) => i.notes.length > 1000))
					throw new Error(
						"A List note exceeds Opnshelf's limit. No text was truncated.",
					);
				const record = {
					...(parent?.value ?? {}),
					...listSchema.build({
						name:
							desired.kind !== "list" && parent
								? listSchema.parse(parent.value).name
								: value.name,
						description:
							desired.kind !== "list" && parent
								? listSchema.parse(parent.value).description
								: value.description || undefined,
						slug: parent
							? listSchema.parse(parent.value).slug
							: desired.kind !== "list"
								? desired.kind
								: `trakt-${rkey}`,
						isDefault:
							desired.kind !== "list" ||
							(parent ? listSchema.parse(parent.value).isDefault : false),
						createdAt: parent
							? listSchema.parse(parent.value).createdAt
							: new Date().toISOString(),
					}),
				};
				if (desired.kind === "list" && !value.description)
					delete record.description;
				const response = await put(LIST, rkey, record, parent);
				await this.privacy.activateNewList(did, rkey);
				await this.lists.indexListRecord(
					response.data.uri,
					response.data.cid,
					rkey,
					did,
					listSchema.parse(record),
				);
				const existing = repo.items.filter((r) => r.value.listRkey === rkey);
				const key = (r: Stored) => {
					const i = itemSchema.parse(r.value);
					return memberKey({
						mediaType: i.mediaType,
						mediaId: i.mediaId,
						season: i.seasonNumber ?? 0,
						episode: i.episodeNumber ?? 0,
						notes: i.notes ?? "",
					});
				};
				for (const item of existing) {
					if (value.items.some((v) => memberKey(v) === key(item))) continue;
					await remove(item);
					await this.lists.deleteListItemRecord(did, item.rkey);
				}
				const ordered: string[] = [];
				for (const member of value.items) {
					if (!member.mediaId)
						throw new Error("Resolve this List membership before retrying.");
					const old = existing.find((i) => key(i) === memberKey(member));
					const itemRkey = old?.rkey ?? TID.nextStr();
					const item = {
						...(old?.value ?? {}),
						...itemSchema.build({
							listRkey: rkey,
							mediaType: member.mediaType,
							mediaId: member.mediaId,
							seasonNumber: member.season || undefined,
							episodeNumber: member.episode || undefined,
							notes: member.notes || undefined,
							createdAt: old
								? itemSchema.parse(old.value).createdAt
								: new Date().toISOString(),
						}),
					};
					if (!member.notes) delete item.notes;
					const added = await put(ITEM, itemRkey, item, old);
					await this.indexItem(did, {
						collection: ITEM,
						rkey: itemRkey,
						uri: added.data.uri,
						cid: added.data.cid,
						value: item,
					});
					ordered.push(itemRkey);
				}
				await this.prisma.$transaction(
					ordered.map((itemRkey, position) =>
						this.prisma.listItem.updateMany({
							where: { userDid: did, rkey: itemRkey },
							data: { position },
						}),
					),
				);
				const confirmed = await this.repository(did, rkey, privateRepo);
				const confirmedParent = confirmed.parents.find((p) => p.rkey === rkey);
				if (!confirmedParent)
					throw new Error("The PDS has not confirmed this List yet.");
				const result = await this.record(
					did,
					confirmedParent,
					confirmed.items,
					context.visibility,
				);
				if (!equivalent(result, desired))
					throw new Error(
						"This List changed during transfer. Choose which version to keep.",
					);
				return result;
			},
		);
	}
	private async indexItem(did: string, item: Stored) {
		await this.lists.indexListItemRecord(
			item.uri,
			item.cid,
			item.rkey,
			did,
			itemSchema.parse(item.value),
		);
		if (
			!(await this.prisma.listItem.findUnique({
				where: { userDid_rkey: { userDid: did, rkey: item.rkey } },
				select: { id: true },
			}))
		)
			throw new Error(
				"This List membership is on the PDS but could not be indexed. Retry when its media is available.",
			);
	}
	private async index(did: string, parent: Stored, items: Stored[]) {
		await this.privacy.activateNewList(did, parent.rkey);
		await this.lists.indexListRecord(
			parent.uri,
			parent.cid,
			parent.rkey,
			did,
			listSchema.parse(parent.value),
		);
		const members = items.filter((i) => i.value.listRkey === parent.rkey);
		await this.prisma.listItem.deleteMany({
			where: {
				userDid: did,
				list: { rkey: parent.rkey },
				rkey: { notIn: members.map((i) => i.rkey) },
			},
		});
		for (const item of members) await this.indexItem(did, item);
	}
}
