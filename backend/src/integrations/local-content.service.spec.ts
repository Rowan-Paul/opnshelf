import { cidForCbor } from "@atproto/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthService } from "../auth/auth.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { ContentPrivacyCoordinator } from "../privacy/content-privacy-coordinator";
import type { NotesService } from "../notes/notes.service";
import type { LibraryService } from "../library/library.service";
import { privacyRepositoryConfig } from "../privacy/privacy-category";
import { watchOperation } from "../privacy/watch-operation";
import { encodeContent, type ContentKind } from "./content-value";
import { LocalSyncContent, localContentRecord } from "./local-content.service";
import type { SyncRecord } from "./reconcile";
const did = "did:plc:fixture";
const rkey = "3m5esn73w2s2j";
function desired(kind: ContentKind): SyncRecord {
	return {
		kind,
		key: `${kind}:remote`,
		mediaType: "movie",
		mediaId: "12",
		season: 0,
		episode: 0,
		title: "A film",
		visibility: "private",
		createdAt: "2020-01-01T12:00:00Z",
		value: encodeContent(
			kind === "library"
				? { format: "dvd" }
				: { content: "Personal words", spoiler: false },
		),
	};
}
function fixture(kind: ContentKind, visibility: "public" | "private") {
	const records = new Map<
		string,
		{ rkey: string; uri: string; cid: string; value: Record<string, unknown> }
	>();
	const calls: { method: string; body: Record<string, unknown> }[] = [];
	let serial = 0;
	const category = kind === "note" ? "notes" : "library";
	const config = privacyRepositoryConfig(category);
	const session = {
		did,
		getTokenInfo: async () => ({ scope: config.scope }),
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
			const reply = (data: unknown) =>
				new Response(JSON.stringify(data), {
					headers: { "content-type": "application/json" },
				});
			if (method.endsWith("getSpace"))
				return reply({ policy: { $type: "com.atproto.personalspace.policy" } });
			if (method.endsWith("listMembers")) return reply({ members: [] });
			if (method.endsWith("listRecords"))
				return reply({
					records: [...records.values()].map((r) => ({
						...r,
						collection: body.collection,
					})),
				});
			if (method.endsWith("putRecord")) {
				const record = {
					rkey: String(body.rkey),
					uri: `at://${did}/${body.collection}/${body.rkey}`,
					cid: (
						await cidForCbor({ record: body.record, serial: ++serial })
					).toString(),
					value: body.record as Record<string, unknown>,
				};
				records.set(record.rkey, record);
				return reply({ uri: record.uri, cid: record.cid });
			}
			if (method.endsWith("deleteRecord")) {
				records.delete(String(body.rkey));
				return reply({});
			}
			throw new Error(`Unexpected ${method}`);
		},
	};
	const prisma = {
		movie: {
			findMany: vi.fn(
				async (): Promise<{ movieId: string; title: string }[]> => [],
			),
		},
		show: { findMany: vi.fn(async () => []) },
		review: {
			upsert: vi.fn(),
			findUnique: vi.fn(async () => null),
			deleteMany: vi.fn(),
		},
	};
	const notes = { indexNoteRecord: vi.fn(), deleteNoteRecord: vi.fn() };
	const library = {
		indexLibraryItemRecord: vi.fn(),
		deleteLibraryItemRecord: vi.fn(),
	};
	const privacy = {
		scope: vi.fn(async () => ({ visibility, targetVisibility: null })),
		write: (
			_did: string,
			_category: string,
			_key: undefined,
			work: () => Promise<unknown>,
		) =>
			watchOperation.run(
				{
					did,
					visibility,
					repository: config,
					signal: new AbortController().signal,
				},
				work,
			),
	};
	const local = new LocalSyncContent(
		prisma as unknown as PrismaService,
		privacy as unknown as ContentPrivacyCoordinator,
		notes as unknown as NotesService,
		library as unknown as LibraryService,
		{ restore: async () => session } as unknown as Pick<AuthService, "restore">,
	);
	const run = (work: () => Promise<unknown>) =>
		watchOperation.run(
			{ did, visibility: "public", signal: new AbortController().signal },
			work,
		);
	return { local, records, calls, prisma, notes, library, run };
}

describe("Local content transfers", () => {
	it.each(["note", "library"] as const)(
		"writes %s to its private category and confirms authoritative contents",
		async (kind) => {
			const f = fixture(kind, "private");
			const result = await f.local.write(did, desired(kind), null, rkey);
			expect(result).toMatchObject({
				kind,
				key: `${kind}:${rkey}`,
				visibility: "private",
				createdAt: "2020-01-01T12:00:00Z",
			});
			expect(
				f.calls
					.filter((c) => c.method.endsWith("putRecord"))
					.every((c) => c.method.includes(".space.")),
			).toBe(true);
			expect(
				await f.local.snapshot(did, {
					notes: kind === "note",
					library: kind === "library",
				}),
			).toEqual([result]);
		},
	);
	it("imports Reviews without creating a Blog Mirror or Bluesky post", async () => {
		const f = fixture("review", "public");
		await f.run(() => f.local.write(did, desired("review"), null, rkey));
		expect(f.prisma.review.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				create: expect.objectContaining({
					mirrorToBlog: false,
					createdAt: new Date("2020-01-01T12:00:00Z"),
				}),
			}),
		);
		expect(
			f.calls.every(
				(c) =>
					!c.body.collection || c.body.collection === "xyz.opnshelf.review",
			),
		).toBe(true);
	});
	it("rejects a duplicate Note tuple before writing another PDS record", async () => {
		const f = fixture("note", "public");
		await f.local.write(did, desired("note"), null, rkey);
		const before = f.calls.filter((c) => c.method.endsWith("putRecord")).length;
		await expect(
			f.local.write(did, desired("note"), null, "3m5esn73w2s2k"),
		).rejects.toThrow("explicit source choice");
		expect(f.calls.filter((c) => c.method.endsWith("putRecord"))).toHaveLength(
			before,
		);
	});
	it("preserves local-only Library notes and Box Sets while syncing Format", async () => {
		const f = fixture("library", "public");
		const baseline = await f.local.write(did, desired("library"), null, rkey);
		const stored = f.records.get(rkey);
		if (!stored) throw new Error("Missing fixture Library Item");
		stored.value.notes = "Keep this receipt";
		stored.value.boxSet = "Trilogy";
		await f.local.write(
			did,
			{ ...desired("library"), value: encodeContent({ format: "bluray" }) },
			baseline,
			rkey,
		);
		expect(f.records.get(rkey)?.value).toMatchObject({
			format: "bluray",
			notes: "Keep this receipt",
			boxSet: "Trilogy",
		});
	});
	it("checks authoritative content instead of overwriting an intervening edit", async () => {
		const f = fixture("note", "public");
		const baseline = await f.local.write(did, desired("note"), null, rkey);
		const stored = f.records.get(rkey);
		if (!stored) throw new Error("Missing fixture Note");
		stored.value.content = "Edited elsewhere";
		await expect(
			f.local.write(did, desired("note"), baseline, rkey),
		).rejects.toThrow("changed before");
		expect(localContentRecord("note", stored, "public").value).not.toBe(
			desired("note").value,
		);
	});
});

it("resolves Library titles in one catalog pass and preserves duplicate-format warnings", async () => {
	const f = fixture("library", "public");
	let titleReads = 0;
	const movies = Array.from({ length: 100 }, (_, i) => ({
		get movieId() {
			titleReads++;
			return String(i);
		},
		title: `Movie ${i}`,
	}));
	f.prisma.movie.findMany.mockResolvedValue(movies);
	const records = Array.from({ length: 101 }, (_, i) => ({
		rkey: `item:${i}`,
		uri: `at://${did}/xyz.opnshelf.library.item/item:${i}`,
		cid: "fixture",
		value: {
			$type: "xyz.opnshelf.library.item",
			mediaType: "movie",
			mediaId: String(i % 100),
			format: i === 100 ? "bluray" : "dvd",
			createdAt: "2020-01-01T12:00:00Z",
		},
	}));
	f.local["repository"] = vi.fn(async () => ({
		records,
		visibility: "public" as const,
	}));
	const result = await f.local.snapshot(did, { library: true });
	expect(result.map((r) => r.title)).toEqual(
		records.map((r) => `Movie ${r.value.mediaId}`),
	);
	expect(result.filter((r) => r.problem).map((r) => r.rkey)).toEqual([
		"item:0",
		"item:100",
	]);
	expect(titleReads).toBeLessThanOrEqual(movies.length);
});

it("does not query the media catalog for Reviews that already have their own titles", async () => {
	const f = fixture("review", "public");
	await f.run(() => f.local.write(did, desired("review"), null, rkey));
	f.prisma.movie.findMany.mockClear();
	f.prisma.show.findMany.mockClear();
	const result = await f.local.snapshot(did, { reviews: true });
	expect(result[0].title).toBe("A film");
	expect(f.prisma.movie.findMany).not.toHaveBeenCalled();
	expect(f.prisma.show.findMany).not.toHaveBeenCalled();
});
