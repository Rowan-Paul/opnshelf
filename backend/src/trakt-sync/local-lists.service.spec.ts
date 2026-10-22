import { cidForCbor } from "@atproto/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthService } from "../auth/auth.service";
import type { ListsService } from "../lists/lists.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { ContentPrivacyCoordinator } from "../privacy/content-privacy-coordinator";
import { privacyRepositoryConfig } from "../privacy/privacy-category";
import { watchOperation } from "../privacy/watch-operation";
import { listValue, encodeList } from "./list-value";
import { LocalSyncLists } from "./local-lists.service";
import type { SyncRecord } from "./reconcile";

const did = "did:plc:fixture";
const rkey = "3m5esn73w2s2j";
const LIST = "xyz.opnshelf.list";
const ITEM = "xyz.opnshelf.list.item";
const desired: SyncRecord = {
	key: "list:22",
	kind: "list",
	mediaType: "list",
	mediaId: null,
	season: 0,
	episode: 0,
	title: "Weekend",
	visibility: "private",
	value: encodeList({
		name: "Weekend",
		description: "Films",
		items: [
			{
				mediaType: "movie",
				mediaId: "12",
				season: 0,
				episode: 0,
				notes: "First",
			},
			{ mediaType: "show", mediaId: "13", season: 0, episode: 0, notes: "" },
		],
	}),
};
function fixture(visibility: "public" | "private") {
	const records = new Map<
		string,
		{
			collection: string;
			rkey: string;
			cid: string;
			value: Record<string, unknown>;
		}
	>();
	const positions = new Map<string, number>();
	let scopes: object[] = [];
	let serial = 0;
	const calls: { method: string; body: Record<string, unknown> }[] = [];
	const session = {
		did,
		getTokenInfo: async () => ({
			scope: privacyRepositoryConfig("lists", rkey).scope,
		}),
		fetchHandler: async (path: string, init?: RequestInit) => {
			const url = new URL(path, "http://fixture.test");
			const method = url.pathname.split("/").at(-1) ?? "";
			const body: Record<string, unknown> = init?.body
				? JSON.parse(
						typeof init.body === "string"
							? init.body
							: Buffer.from(init.body as Uint8Array).toString(),
					)
				: Object.fromEntries(url.searchParams);
			calls.push({ method, body });
			const reply = (value: unknown, status = 200) =>
				new Response(JSON.stringify(value), {
					status,
					headers: { "content-type": "application/json" },
				});
			const key = `${body.collection}/${body.rkey}`;
			if (method.endsWith("getSpace"))
				return reply({
					readPolicy: {
						$type: "com.atproto.simplespace.defs#memberListPolicy",
					},
					writePolicy: {
						$type: "com.atproto.simplespace.defs#memberListPolicy",
					},
				});
			if (method.endsWith("listMembers")) return reply({ members: [] });
			if (method.endsWith("listRecords"))
				return reply({
					records: [...records.values()]
						.filter((r) => r.collection === body.collection)
						.map((r) => ({
							...r,
							uri: `at://${did}/${r.collection}/${r.rkey}`,
						})),
				});
			if (method.endsWith("getRecord")) {
				const record = records.get(key);
				return record
					? reply({
							...record,
							uri: `at://${did}/${record.collection}/${record.rkey}`,
						})
					: reply({ error: "RecordNotFound" }, 400);
			}
			if (method.endsWith("putRecord")) {
				const record = {
					collection: String(body.collection),
					rkey: String(body.rkey),
					cid: (
						await cidForCbor({ record: body.record, serial: ++serial })
					).toString(),
					value: body.record as Record<string, unknown>,
				};
				records.set(key, record);
				return reply({
					uri: `at://${did}/${record.collection}/${record.rkey}`,
					cid: record.cid,
				});
			}
			if (method.endsWith("deleteRecord")) {
				records.delete(key);
				return reply({});
			}
			throw new Error(`Unexpected fixture method: ${method}`);
		},
	};
	const prisma = {
		list: {
			findMany: vi.fn(async () =>
				[...records.values()]
					.filter((r) => r.collection === LIST)
					.map((r) => ({
						rkey: r.rkey,
						isDefault: r.value.isDefault,
						slug: r.value.slug,
					})),
			),
		},
		privacyScope: {
			findMany: vi.fn(async () => scopes),
			updateMany: vi.fn(async () => ({ count: 1 })),
		},
		listItem: {
			deleteMany: vi.fn(),
			findUnique: vi.fn(async ({ where }) =>
				records.has(`${ITEM}/${where.userDid_rkey.rkey}`)
					? { id: "fixture" }
					: null,
			),
			findMany: vi.fn(async () =>
				[...positions].map(([rkey, position]) => ({ rkey, position })),
			),
			updateMany: vi.fn(async ({ where, data }) => {
				positions.set(where.rkey, data.position);
				return { count: 1 };
			}),
		},
		$transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
	};
	const lists = {
		indexListRecord: vi.fn(),
		indexListItemRecord: vi.fn(),
		deleteListRecord: vi.fn(),
		deleteListItemRecord: vi.fn(),
	};
	const privacy = {
		scope: async () => scopes[0] ?? null,
		write: (
			_did: string,
			_category: string,
			_key: string | undefined,
			work: () => Promise<unknown>,
		) =>
			watchOperation.run(
				{
					did,
					visibility,
					repository: privacyRepositoryConfig("lists", rkey),
					signal: new AbortController().signal,
				},
				work,
			),
		prepareNewList: vi.fn(),
		activateNewList: vi.fn(async () => {
			if (visibility === "private")
				scopes = [{ listRkey: rkey, visibility, targetVisibility: null }];
		}),
	};
	const local = new LocalSyncLists(
		prisma as unknown as PrismaService,
		lists as unknown as ListsService,
		privacy as unknown as ContentPrivacyCoordinator,
		{ restore: async () => session } as unknown as Pick<AuthService, "restore">,
	);
	return { local, records, lists, calls, prisma, session };
}

describe("List PDS transfers", () => {
	it.each(["public", "private"] as const)(
		"creates and confirms ordered memberships in the %s destination",
		async (visibility) => {
			const f = fixture(visibility);
			const result = await f.local.write(did, desired, null, rkey);
			expect(result).toMatchObject({
				key: `list:${rkey}`,
				value: desired.value,
				visibility,
			});
			expect(f.records.size).toBe(3);
			expect(await f.local.snapshot(did)).toEqual([result]);
			const readsBefore = f.calls.length;
			expect(await f.local.snapshot(did, { watchlist: true })).toEqual([]);
			expect(
				f.calls.slice(readsBefore).every((c) => !c.method.includes(".space.")),
			).toBe(true);
			expect(f.lists.indexListItemRecord).toHaveBeenCalledTimes(2);
			const writes = f.calls.filter((c) => c.method.endsWith("putRecord"));
			expect(
				writes.every((c) =>
					c.method.includes(visibility === "private" ? ".space." : ".repo."),
				),
			).toBe(true);
			if (visibility === "private")
				expect(writes.every((c) => !("swapRecord" in c.body))).toBe(true);
			const resumed = await f.local.write(did, desired, null, rkey);
			expect(resumed?.key).toBe(result?.key);
			expect(f.records.size).toBe(3);
		},
	);
	it.each(["public", "private"] as const)(
		"pairs %s default Favorites without treating them as custom Lists",
		async (visibility) => {
			const f = fixture(visibility);
			const favorite = {
				...desired,
				kind: "favorites" as const,
				key: "favorites:trakt",
				title: "Favorites",
				value: encodeList({ name: "Favorites", description: "", items: [] }),
			};
			const created = await f.local.write(did, favorite, null, rkey);
			expect(created?.kind).toBe("favorites");
			const parent = f.records.get(`${LIST}/${rkey}`);
			if (!parent || !created) throw new Error("Missing Favorites fixture");
			expect(parent.value).toMatchObject({
				isDefault: true,
				slug: "favorites",
			});
			parent.value.name = "My favorites";
			parent.value.description = "Local description";
			expect(
				await f.local.snapshot(did, { lists: true, watchlist: true }),
			).toEqual([]);
			expect(await f.local.snapshot(did, { favorites: true })).toEqual([
				expect.objectContaining({ kind: "favorites", value: favorite.value }),
			]);
			await f.local.write(
				did,
				{
					...favorite,
					value: encodeList({
						name: "Favorites",
						description: "",
						items: [
							{
								mediaType: "movie",
								mediaId: "12",
								season: 0,
								episode: 0,
								notes: "",
							},
						],
					}),
				},
				created,
				rkey,
			);
			expect(f.records.get(`${LIST}/${rkey}`)?.value).toMatchObject({
				name: "My favorites",
				description: "Local description",
			});
		},
	);
	it("detects changed destination contents before mutating them", async () => {
		const f = fixture("public");
		const original = await f.local.write(did, desired, null, rkey);
		if (!original) throw new Error("Fixture failed to create a List");
		const parent = f.records.get(`${LIST}/${rkey}`);
		if (!parent) throw new Error("Missing fixture List");
		parent.value.name = "Edited elsewhere";
		const writesBefore = f.calls.filter((c) =>
			c.method.endsWith("putRecord"),
		).length;
		await expect(
			f.local.write(
				did,
				{
					...desired,
					value: encodeList({ name: "Requested", description: "", items: [] }),
				},
				original,
				rkey,
			),
		).rejects.toThrow("changed during");
		expect(f.calls.filter((c) => c.method.endsWith("putRecord"))).toHaveLength(
			writesBefore,
		);
	});
	it("preserves extension fields while editing and removes linked memberships", async () => {
		const f = fixture("private");
		const original = await f.local.write(did, desired, null, rkey);
		if (!original) throw new Error("Fixture failed to create a List");
		const parent = f.records.get(`${LIST}/${rkey}`);
		if (!parent) throw new Error("Missing fixture List");
		parent.value.custom = "preserved";
		const result = await f.local.write(
			did,
			{
				...desired,
				value: encodeList({
					name: "Weekend",
					description: "Edited",
					items: [],
				}),
			},
			original,
			rkey,
		);
		expect(f.records.get(`${LIST}/${rkey}`)?.value.custom).toBe("preserved");
		expect(
			[...f.records.values()].filter((r) => r.collection === ITEM),
		).toEqual([]);
		await f.local.write(did, null, result, rkey);
		expect(f.records.size).toBe(0);
	});
	it("does not treat a failed repository page as an empty List", async () => {
		const f = fixture("public");
		f.prisma.privacyScope.findMany.mockRejectedValue(
			new Error("repository unavailable"),
		);
		await expect(f.local.snapshot(did)).rejects.toThrow("unavailable");
		expect(f.calls).toEqual([]);
	});
});

it("orders a large List without scanning all saved positions for every comparison", async () => {
	const f = fixture("public");
	await f.local.write(did, desired, null, rkey);
	const parent = f.records.get(`${LIST}/${rkey}`);
	const template = [...f.records.entries()].find(([key]) =>
		key.startsWith(`${ITEM}/`),
	)?.[1];
	if (!parent || !template) throw new Error("Missing List fixture");
	const items: Parameters<(typeof f.local)["record"]>[2] = Array.from(
		{ length: 100 },
		(_, i) => ({
			...template,
			collection: ITEM,
			uri: `at://${did}/${ITEM}/member:${i}`,
			rkey: `member:${i}`,
			value: { ...template.value, mediaId: String(i + 1) },
		}),
	);
	let positionReads = 0;
	f.prisma.listItem.findMany.mockResolvedValue(
		items.map((item, i) => ({
			get rkey() {
				positionReads++;
				return item.rkey;
			},
			position: 100 - i,
		})),
	);
	const result = await f.local["record"](
		did,
		{ ...parent, collection: LIST, uri: `at://${did}/${LIST}/${rkey}` },
		items,
		"public",
	);
	expect(listValue(result).items.map((item) => item.mediaId)).toEqual(
		items.map((item) => item.value.mediaId).reverse(),
	);
	expect(positionReads).toBeLessThanOrEqual(items.length);
});

it("loads positions once across multiple public Lists", async () => {
	const f = fixture("public");
	await f.local.write(did, desired, null, rkey);
	await f.local.write(did, desired, null, "3m5esn73w2s2k");
	f.prisma.listItem.findMany.mockClear();
	const result = await f.local.snapshot(did);
	expect(result).toHaveLength(2);
	expect(result.every((r) => listValue(r).items.length === 2)).toBe(true);
	expect(f.prisma.listItem.findMany).toHaveBeenCalledTimes(1);
});

it("preserves unchanged PDS memberships during a metadata edit", async () => {
	const f = fixture("public");
	const original = await f.local.write(did, desired, null, rkey);
	f.calls.length = 0;
	await f.local.write(
		did,
		{
			...desired,
			value: encodeList({ ...listValue(desired), description: "Updated" }),
		},
		original,
		rkey,
	);
	expect(
		f.calls.filter(
			(c) => c.method.endsWith("putRecord") && c.body.collection === ITEM,
		),
	).toHaveLength(0);
	expect(
		f.calls.filter(
			(c) => c.method.endsWith("putRecord") && c.body.collection === LIST,
		),
	).toHaveLength(1);
});
