import { Logger } from "@nestjs/common";
import { afterEach, expect, it, vi } from "vitest";
import { parseEnvironment } from "../config/env.schema";
import type { WatchAccountLock } from "../privacy/watch-account-lock";
import type { PrismaService } from "../prisma/prisma.service";
import type { LocalSyncRecords } from "../integrations/local-records.service";
import { TraktSyncClient, TraktSyncError } from "./trakt-sync.client";
import { TraktSyncService } from "./trakt-sync.service";

afterEach(() => vi.restoreAllMocks());

it.each([
	["exchange", "token-exchange"],
	["profile", "profile-fetch"],
	["save", "connection-save"],
] as const)("logs safe diagnostics when %s fails", async (failure, stage) => {
	const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
	const config = parseEnvironment({
		NODE_ENV: "test",
		TRAKT_API_KEY: "fixture-client",
		BACKEND_PUBLIC_URL: "https://api.example.test",
		FRONTEND_URL: "https://example.test",
		PROVIDER_STATE_SECRET: "fixture-encryption-key-not-a-real-credential",
	});
	let saved: unknown;
	const fail = () => {
		throw new TraktSyncError("private-code private-token private-user", 401);
	};
	const prisma = {
		authState: {
			create: vi.fn(async ({ data }) => {
				saved = data;
			}),
			findUnique: vi.fn(async () => saved),
			deleteMany: vi.fn(async () => ({ count: 1 })),
		},
		integrationConnection: {
			findFirst: vi.fn(async () => null),
			findUnique: vi.fn(async () => null),
			create: vi.fn(fail),
		},
	};
	const api = new TraktSyncClient(config);
	vi.spyOn(api, "exchange").mockImplementation(async () => {
		if (failure === "exchange") fail();
		return {
			access_token: "private-token",
			refresh_token: "private-refresh",
			expires_in: 3600,
			created_at: 1,
		};
	});
	vi.spyOn(api, "profile").mockImplementation(async () => {
		if (failure === "profile") fail();
		return { username: "private-user", ids: { uuid: "private-id" } };
	});
	vi.spyOn(api, "revoke").mockResolvedValue(undefined);
	const service = new TraktSyncService(
		prisma as unknown as PrismaService,
		api,
		{} as LocalSyncRecords,
		config,
		{} as WatchAccountLock,
	);
	const { url } = await service.authorize("private-did", "web");
	const state = new URL(url).searchParams.get("state") ?? "";
	expect(await service.callback(state, "private-code")).toBe(
		"https://example.test/trakt-sync?connection=failed",
	);
	expect(warn.mock.calls.map(([message]) => [JSON.parse(message)])).toEqual([
		[
			{
				message: "Trakt OAuth callback failed",
				stage,
				category: "trakt-api",
				status: 401,
			},
		],
	]);
});

it("does not repeatedly scan every link while discovering a large account", async () => {
	let keyReads = 0;
	const local = Array.from({ length: 200 }, (_, i) => ({
		key: `local:${i}`,
		kind: "watch" as const,
		mediaType: "movie" as const,
		mediaId: String(i),
		season: 0,
		episode: 0,
		title: "Fixture",
		value: "2026-01-01T00:00:00Z",
	}));
	const remote = local.map((r) => ({ ...r, key: `remote:${r.mediaId}` }));
	const entries = [
		...remote.map((r) => ({ localKey: null, remoteKey: r.key })),
		...local.map((r) => ({ localKey: r.key, remoteKey: null })),
	].map((entry) => ({
		...entry,
		get localKey() {
			keyReads++;
			return entry.localKey;
		},
	}));
	const prisma = {
		integrationEntry: {
			findMany: vi.fn(async () => entries),
			update: vi.fn(),
			createMany: vi.fn(),
		},
	};
	const service = new TraktSyncService(
		prisma as unknown as PrismaService,
		{} as TraktSyncClient,
		{} as LocalSyncRecords,
		parseEnvironment({ NODE_ENV: "test" }),
		{} as WatchAccountLock,
	);
	await service["discover"](
		{ id: "fixture" } as Parameters<(typeof service)["discover"]>[0],
		local,
		remote,
	);
	expect(prisma.integrationEntry.update).not.toHaveBeenCalled();
	expect(prisma.integrationEntry.createMany).not.toHaveBeenCalled();
	expect(keyReads).toBeLessThan(entries.length * 10);
});

it.each([
	{ localCount: 1, remoteCount: 1, updates: 1 },
	{ localCount: 2, remoteCount: 1, updates: 0 },
	{ localCount: 1, remoteCount: 2, updates: 0 },
])(
	"preserves unambiguous recovery pairing: %j",
	async ({ localCount, remoteCount, updates }) => {
		const record = {
			kind: "watch" as const,
			mediaType: "movie" as const,
			mediaId: "12",
			season: 0,
			episode: 0,
			title: "Fixture",
			value: "2026-01-01T00:00:00Z",
		};
		const local = Array.from({ length: localCount }, (_, i) => ({
			...record,
			key: `local:${i}`,
		}));
		const remote = Array.from({ length: remoteCount }, (_, i) => ({
			...record,
			key: `remote:${i}`,
		}));
		const entries = remote.map((r) => ({
			id: r.key,
			localKey: null,
			remoteKey: r.key,
			eligible: true,
		}));
		const prisma = {
			integrationEntry: {
				findMany: vi.fn(async () => entries),
				update: vi.fn(),
				createMany: vi.fn(),
			},
		};
		const service = new TraktSyncService(
			prisma as unknown as PrismaService,
			{} as TraktSyncClient,
			{} as LocalSyncRecords,
			parseEnvironment({ NODE_ENV: "test" }),
			{} as WatchAccountLock,
		);
		await service["discover"](
			{ id: "fixture" } as Parameters<(typeof service)["discover"]>[0],
			local,
			remote,
		);
		expect(prisma.integrationEntry.update).toHaveBeenCalledTimes(updates);
		if (updates)
			expect(prisma.integrationEntry.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ localKey: "local:0", linked: true }),
				}),
			);
	},
);

it("limits remote ambiguity comparisons to the matching media", async () => {
	let mediaReads = 0;
	const local = Array.from({ length: 200 }, (_, i) => ({
		key: `local:${i}`,
		kind: "watch" as const,
		mediaType: "movie" as const,
		mediaId: String(i),
		season: 0,
		episode: 0,
		title: "Fixture",
		value: "2026-01-01T00:00:00Z",
	}));
	const remote = local.map((r) => ({
		...r,
		key: `remote:${r.mediaId}`,
		get mediaId() {
			mediaReads++;
			return r.mediaId;
		},
	}));
	const prisma = {
		integrationEntry: { findMany: vi.fn(async () => []), createMany: vi.fn() },
	};
	const service = new TraktSyncService(
		prisma as unknown as PrismaService,
		{} as TraktSyncClient,
		{} as LocalSyncRecords,
		parseEnvironment({ NODE_ENV: "test" }),
		{} as WatchAccountLock,
	);
	await service["discover"](
		{ id: "fixture", initialised: true, watches: true } as Parameters<
			(typeof service)["discover"]
		>[0],
		local,
		remote,
	);
	expect(prisma.integrationEntry.createMany).toHaveBeenCalledTimes(1);
	expect(prisma.integrationEntry.createMany.mock.calls[0][0].data).toHaveLength(
		200,
	);
	expect(
		prisma.integrationEntry.createMany.mock.calls[0][0].data.every(
			(input: { linked: boolean }) => input.linked,
		),
	).toBe(true);
	expect(mediaReads).toBeLessThan(remote.length * 15);
});

it.each([false, true])(
	"uses indexed processing snapshots (refresh: %s)",
	async (refresh) => {
		let keyReads = 0;
		const local = Array.from({ length: 200 }, (_, i) => ({
			get key() {
				keyReads++;
				return `local:${i}`;
			},
			kind: "watch" as const,
			mediaType: "movie" as const,
			mediaId: String(i),
			season: 0,
			episode: 0,
			title: "Fixture",
			value: "2026-01-01T00:00:00Z",
		}));
		const remote = local.map((r) => ({ ...r, key: `remote:${r.mediaId}` }));
		const entries = local.map((r, i) => ({
			id: String(i),
			kind: "watch",
			localKey: r.key,
			remoteKey: remote[i].key,
			localBase: r,
			remoteBase: remote[i],
			eligible: true,
			linked: true,
		}));
		const snapshot = vi
			.fn()
			.mockResolvedValueOnce(refresh ? [] : local)
			.mockResolvedValue(local);
		const prisma = {
			integrationEntry: { findMany: vi.fn(async () => entries) },
			integrationConnection: { update: vi.fn() },
		};
		const service = new TraktSyncService(
			prisma as unknown as PrismaService,
			{ snapshot: vi.fn(async () => remote) } as unknown as TraktSyncClient,
			{ snapshot } as unknown as LocalSyncRecords,
			parseEnvironment({ NODE_ENV: "test" }),
			{} as WatchAccountLock,
		);
		service["credential"] = vi.fn(async () => "fixture");
		service["discover"] = vi.fn(async () => undefined);
		service["publicWatchOperation"] = async (_c, operation) =>
			operation(new AbortController().signal, async (write) => write());
		const transfer = vi.fn();
		service["transfer"] = transfer;
		keyReads = 0;
		await service["process"](
			{
				id: "fixture",
				direction: "inbound",
				watches: true,
				initialised: true,
				remoteSnapshot: remote,
				remoteReadAt: refresh ? null : new Date(),
			} as unknown as Parameters<(typeof service)["process"]>[0],
			async () => undefined,
		);
		expect(transfer).not.toHaveBeenCalled();
		expect(snapshot).toHaveBeenCalledTimes(refresh ? 2 : 1);
		expect(keyReads).toBeLessThan(local.length * 10);
	},
);

it.each([false, true])(
	"only surfaces excluded history after a future edit (changed: %s)",
	async (changed) => {
		const original = {
			key: "local:old",
			kind: "watch" as const,
			mediaType: "episode" as const,
			mediaId: "12",
			season: 2,
			episode: 2,
			title: "Fixture",
			value: "2026-10-17T21:36:00Z",
		};
		const local = [
			{ ...original, value: changed ? "2026-10-17T21:38:00Z" : original.value },
		];
		const entries = [
			{
				id: "old",
				kind: "watch",
				localKey: original.key,
				localBase: original,
				remoteBase: null,
				eligible: false,
				linked: false,
				issue: "Confirm whether these Watches are the same viewing.",
				pending: null,
			},
		];
		const update = vi.fn();
		const prisma = {
			integrationEntry: { findMany: vi.fn(async () => entries), update },
			integrationConnection: { update: vi.fn() },
		};
		const service = new TraktSyncService(
			prisma as unknown as PrismaService,
			{} as TraktSyncClient,
			{ snapshot: vi.fn(async () => local) } as unknown as LocalSyncRecords,
			parseEnvironment({ NODE_ENV: "test" }),
			{} as WatchAccountLock,
		);
		service["credential"] = vi.fn(async () => "fixture");
		service["discover"] = vi.fn(async () => undefined);
		service["publicWatchOperation"] = async (_c, operation) =>
			operation(new AbortController().signal, async (write) => write());
		const transfer = vi.fn();
		service["transfer"] = transfer;
		await service["process"](
			{
				id: "fixture",
				direction: "inbound",
				watches: true,
				initialised: true,
				historyScope: "future",
				remoteSnapshot: [],
				remoteReadAt: new Date(),
			} as unknown as Parameters<(typeof service)["process"]>[0],
			async () => undefined,
		);
		expect(transfer).not.toHaveBeenCalled();
		if (changed)
			expect(update).toHaveBeenCalledWith({
				select: { id: true },
				where: { id: "old" },
				data: { eligible: true },
			});
		else expect(update).not.toHaveBeenCalled();
	},
);

it("excludes historical issues from both the review list and its count", async () => {
	const findMany = vi.fn(async () => []);
	const groupBy = vi.fn(async () => []);
	const service = new TraktSyncService(
		{
			integrationEntry: { findMany, groupBy, count: vi.fn(async () => 0) },
			integrationConnection: {
				findFirst: vi.fn(async () => ({
					id: "fixture",
					nextRunAt: new Date(),
				})),
			},
			backgroundJob: { findFirst: vi.fn(async () => null) },
		} as unknown as PrismaService,
		{} as TraktSyncClient,
		{ snapshot: vi.fn(async () => []) } as unknown as LocalSyncRecords,
		parseEnvironment({ NODE_ENV: "test" }),
		{} as WatchAccountLock,
	);
	const connection = {
		id: "fixture",
		remoteSnapshot: [],
		nextRunAt: new Date(),
	} as unknown as NonNullable<Awaited<ReturnType<(typeof service)["current"]>>>;
	service["current"] = vi.fn(
		() =>
			Promise.resolve(connection) as ReturnType<(typeof service)["current"]>,
	);
	service["requireConnection"] = vi.fn(async () => connection);
	await service.issues("fixture", {});
	await service.status("fixture");
	for (const query of [groupBy.mock.calls[0]])
		expect(query).toEqual([
			expect.objectContaining({
				where: expect.objectContaining({
					OR: [{ eligible: true }, { linked: true }],
				}),
			}),
		]);
});

it.each(["link", "opnshelf", "trakt", "match", "retry"] as const)(
	"rejects %s from a stale screen for excluded history",
	async (action) => {
		const service = new TraktSyncService(
			{
				integrationEntry: {
					findFirst: vi.fn(async () => ({ eligible: false, linked: false })),
				},
			} as unknown as PrismaService,
			{} as TraktSyncClient,
			{} as LocalSyncRecords,
			parseEnvironment({ NODE_ENV: "test" }),
			{} as WatchAccountLock,
		);
		service["requireConnection"] = vi.fn(
			async () =>
				({ id: "fixture" }) as Awaited<
					ReturnType<(typeof service)["requireConnection"]>
				>,
		);
		service["locked"] = async (_connection, operation) =>
			operation(async () => undefined);
		await expect(service.resolve("fixture", "old", { action })).rejects.toThrow(
			"outside your sync scope",
		);
	},
);

it("builds candidate comparisons only for the requested sync issue page", async () => {
	let comparisons = 0;
	const watch = {
		key: "local",
		kind: "watch",
		mediaType: "movie",
		get mediaId() {
			comparisons++;
			return "1";
		},
		season: 0,
		episode: 0,
		title: "Fixture",
		value: null,
	};
	const entries = Array.from({ length: 200 }, (_, i) => ({
		id: `issue:${i}`,
		kind: "watch",
		remoteKey: "remote",
		linked: false,
		issue: "Choose a match",
		ignored: false,
	}));
	const service = new TraktSyncService(
		{
			integrationEntry: {
				count: vi.fn(async () => entries.length),
				findMany: vi.fn(async (input) =>
					input.select
						? entries
						: entries.slice(input.skip, input.skip + input.take),
				),
			},
		} as unknown as PrismaService,
		{} as TraktSyncClient,
		{ snapshot: vi.fn(async () => [watch]) } as unknown as LocalSyncRecords,
		parseEnvironment({ NODE_ENV: "test" }),
		{} as WatchAccountLock,
	);
	const connection = {
		id: "fixture",
		remoteSnapshot: [{ ...watch, key: "remote" }],
	} as unknown as NonNullable<Awaited<ReturnType<(typeof service)["current"]>>>;
	service["requireConnection"] = vi.fn(async () => connection);
	comparisons = 0;
	const result = await service.issues("fixture", { page: 2, pageSize: 1 });
	expect(result).toMatchObject({ page: 2, total: 200, hasNextPage: true });
	expect(result.items.map((item) => item.id)).toEqual(["issue:1"]);
	expect(result.items[0].candidates).toHaveLength(1);
	expect(comparisons).toBeLessThan(10);
});

it("parses saved title mappings once when paging unmatched Trakt records", async () => {
	let reads = 0;
	let titleComparisons = 0;
	const remote = Array.from({ length: 100 }, (_, i) => ({
		key: `remote:${i}`,
		kind: "watch",
		mediaType: "movie",
		mediaId: null,
		remoteId: i,
		season: 0,
		episode: 0,
		title: "Fixture",
		value: null,
	}));
	const entries = remote.map((r, i) => ({
		id: `issue:${i}`,
		kind: "watch",
		remoteKey: r.key,
		linked: false,
		issue: "Choose a match",
		ignored: false,
		get remoteBase() {
			reads++;
			return {
				...r,
				mediaId: String(i),
				get remoteId() {
					titleComparisons++;
					return i;
				},
			};
		},
	}));
	const service = new TraktSyncService(
		{
			integrationEntry: {
				count: vi.fn(async () => entries.length),
				findMany: vi.fn(async (input) =>
					input.select
						? entries
						: entries.slice(input.skip, input.skip + input.take),
				),
			},
		} as unknown as PrismaService,
		{} as TraktSyncClient,
		{ snapshot: vi.fn(async () => []) } as unknown as LocalSyncRecords,
		parseEnvironment({ NODE_ENV: "test" }),
		{} as WatchAccountLock,
	);
	service["requireConnection"] = vi.fn(
		async () =>
			({
				id: "fixture",
				remoteSnapshot: remote,
			}) as unknown as NonNullable<
				Awaited<ReturnType<(typeof service)["current"]>>
			>,
	);
	const result = await service.issues("fixture", { page: 2, pageSize: 1 });
	expect(result.items[0].trakt?.mediaId).toBe("1");
	expect(reads).toBeLessThanOrEqual(entries.length);
	expect(titleComparisons).toBeLessThanOrEqual(entries.length * 2);
});

it("does not read local repositories when the issue queue is empty", async () => {
	const snapshot = vi.fn(async () => []);
	const service = new TraktSyncService(
		{
			integrationEntry: {
				count: vi.fn(async () => 0),
				findMany: vi.fn(async () => []),
			},
		} as unknown as PrismaService,
		{} as TraktSyncClient,
		{ snapshot } as unknown as LocalSyncRecords,
		parseEnvironment({ NODE_ENV: "test" }),
		{} as WatchAccountLock,
	);
	service["requireConnection"] = vi.fn(
		async () =>
			({ id: "fixture", remoteSnapshot: [] }) as unknown as NonNullable<
				Awaited<ReturnType<(typeof service)["current"]>>
			>,
	);
	expect(
		await service.issues("fixture", { page: 3, pageSize: 1 }),
	).toMatchObject({
		items: [],
		total: 0,
		page: 1,
		totalPages: 0,
	});
	expect(snapshot).not.toHaveBeenCalled();
});

it("reads only the enabled content repositories needed for the visible issue page", async () => {
	const snapshot = vi.fn(async () => []);
	const service = new TraktSyncService(
		{
			integrationEntry: {
				count: vi.fn(async () => 2),
				findMany: vi.fn(async (input) =>
					[
						{ id: "watch", kind: "watch", issue: "Choose a match" },
						{ id: "note", kind: "note", issue: "Choose a version" },
					].slice(input.skip, input.skip + input.take),
				),
			},
		} as unknown as PrismaService,
		{} as TraktSyncClient,
		{ snapshot } as unknown as LocalSyncRecords,
		parseEnvironment({ NODE_ENV: "test" }),
		{} as WatchAccountLock,
	);
	service["requireConnection"] = vi.fn(
		async () =>
			({
				id: "fixture",
				remoteSnapshot: [],
				lists: true,
				watchlist: true,
				favorites: true,
				notes: true,
				library: true,
				reviews: true,
			}) as unknown as NonNullable<
				Awaited<ReturnType<(typeof service)["current"]>>
			>,
	);
	await service.issues("fixture", { page: 1, pageSize: 1 });
	expect(snapshot.mock.calls[0]).toEqual([
		"fixture",
		expect.objectContaining({
			lists: false,
			watchlist: false,
			favorites: false,
			notes: false,
			library: false,
			reviews: false,
		}),
		new Set(["watch"]),
	]);
	await service.issues("fixture", { page: 2, pageSize: 1 });
	expect(snapshot.mock.calls[1]).toEqual([
		"fixture",
		expect.objectContaining({
			lists: false,
			watchlist: false,
			favorites: false,
			notes: true,
			library: false,
			reviews: false,
		}),
		new Set(["note"]),
	]);
});

it.each([
	{
		name: "movie Watches",
		source: { kind: "watch", mediaType: "movie", remoteId: 7 },
		saved: { kind: "watch", mediaType: "movie", remoteId: 7 },
		expected: "99",
	},
	{
		name: "different record types",
		source: { kind: "watch", mediaType: "movie", remoteId: 7 },
		saved: { kind: "rating", mediaType: "movie", remoteId: 7 },
		expected: null,
	},
	{
		name: "movie and show IDs",
		source: { kind: "watch", mediaType: "movie", remoteId: 7 },
		saved: { kind: "watch", mediaType: "episode", remoteParentId: 7 },
		expected: null,
	},
	{
		name: "episodes of the same show",
		source: {
			kind: "watch",
			mediaType: "episode",
			remoteId: 8,
			remoteParentId: 7,
		},
		saved: {
			kind: "watch",
			mediaType: "episode",
			remoteId: 9,
			remoteParentId: 7,
		},
		expected: "99",
	},
	{
		name: "shows without parent IDs",
		source: { kind: "watch", mediaType: "episode" },
		saved: { kind: "watch", mediaType: "episode" },
		expected: null,
	},
	{
		name: "Reviews of the same movie",
		source: {
			kind: "review",
			mediaType: "movie",
			remoteId: 8,
			remoteParentId: 7,
		},
		saved: {
			kind: "review",
			mediaType: "movie",
			remoteId: 9,
			remoteParentId: 7,
		},
		expected: "99",
	},
	{
		name: "Reviews without parent IDs",
		source: { kind: "review", mediaType: "movie", remoteId: 7 },
		saved: { kind: "review", mediaType: "movie", remoteId: 7 },
		expected: null,
	},
])(
	"preserves saved title mapping rules for $name",
	async ({ source, saved, expected }) => {
		const base = {
			key: "remote",
			season: 0,
			episode: 0,
			title: "Fixture",
			value:
				source.kind === "review"
					? JSON.stringify({ content: "Fixture review" })
					: null,
		};
		const service = new TraktSyncService(
			{
				integrationEntry: {
					count: vi.fn(async () => 2),
					findMany: vi.fn(async (input) =>
						[
							{
								id: "first",
								kind: source.kind,
								remoteKey: "remote",
								remoteBase: { ...base, ...saved, mediaId: "99" },
							},
							{
								id: "second",
								kind: source.kind,
								remoteBase: { ...base, ...saved, mediaId: "100" },
							},
						].slice(
							input.select ? 0 : input.skip,
							input.select ? undefined : input.skip + input.take,
						),
					),
				},
			} as unknown as PrismaService,
			{} as TraktSyncClient,
			{ snapshot: vi.fn(async () => []) } as unknown as LocalSyncRecords,
			parseEnvironment({ NODE_ENV: "test" }),
			{} as WatchAccountLock,
		);
		service["requireConnection"] = vi.fn(
			async () =>
				({
					id: "fixture",
					remoteSnapshot: [{ ...base, ...source, mediaId: null }],
				}) as unknown as NonNullable<
					Awaited<ReturnType<(typeof service)["current"]>>
				>,
		);
		const result = await service.issues("fixture", { pageSize: 1 });
		expect(result.items[0].trakt?.mediaId).toBe(expected);
	},
);

it("inserts a large initial comparison in bounded batches instead of one round trip per Watch", async () => {
	const remote = Array.from({ length: 1201 }, (_, i) => ({
		key: `remote:${i}`,
		kind: "watch" as const,
		mediaType: "movie" as const,
		mediaId: String(i + 1),
		season: 0,
		episode: 0,
		title: "Fixture",
		value: null,
	}));
	let linkReads = 0;
	const entries = remote.map((r) => ({
		get linked() {
			linkReads++;
			return true;
		},
		localKey: `old:${r.key}`,
		remoteKey: `old:${r.key}`,
		remoteBase: r,
	}));
	const createMany = vi.fn(async (_input: { data: unknown[] }) => ({
		count: 0,
	}));
	const service = new TraktSyncService(
		{
			integrationEntry: { findMany: vi.fn(async () => entries), createMany },
		} as unknown as PrismaService,
		{} as TraktSyncClient,
		{} as LocalSyncRecords,
		parseEnvironment({ NODE_ENV: "test" }),
		{} as WatchAccountLock,
	);
	await service["discover"](
		{ id: "fixture", watches: true, initialised: true } as Parameters<
			(typeof service)["discover"]
		>[0],
		[],
		remote,
	);
	expect(createMany.mock.calls.map(([input]) => input.data.length)).toEqual([
		500, 500, 201,
	]);
	expect(linkReads).toBeLessThan(entries.length * 5);
});

it.each([
	{ page: 1, expectedMediaId: "1", mappingReads: 0 },
	{ page: 2, expectedMediaId: "2", mappingReads: 1 },
])(
	"loads cross-page mappings only when the visible issue needs one (page $page)",
	async ({ page, expectedMediaId, mappingReads }) => {
		const known = {
			key: "remote:known",
			kind: "watch" as const,
			mediaType: "movie" as const,
			mediaId: "1",
			remoteId: 1,
			season: 0,
			episode: 0,
			title: "Known",
			value: null,
		};
		const unmatched = {
			...known,
			key: "remote:unmatched",
			mediaId: null,
			remoteId: 2,
			title: "Unmatched",
		};
		const entries = [
			{ id: "known", kind: "watch", remoteKey: known.key, remoteBase: known },
			{
				id: "unmatched",
				kind: "watch",
				remoteKey: unmatched.key,
				remoteBase: unmatched,
			},
			{
				id: "mapping-on-another-page",
				kind: "watch",
				remoteKey: "remote:other",
				remoteBase: { ...unmatched, key: "remote:other", mediaId: "2" },
			},
		];
		const findMany = vi.fn(async (query) =>
			query.select
				? entries
				: entries.slice(query.skip, query.skip + query.take),
		);
		const service = new TraktSyncService(
			{
				integrationEntry: {
					count: vi.fn(async () => entries.length),
					findMany,
				},
			} as unknown as PrismaService,
			{} as TraktSyncClient,
			{ snapshot: vi.fn(async () => []) } as unknown as LocalSyncRecords,
			parseEnvironment({ NODE_ENV: "test" }),
			{} as WatchAccountLock,
		);
		service["requireConnection"] = vi.fn(
			async () =>
				({
					id: "fixture",
					remoteSnapshot: [known, unmatched],
				}) as unknown as Awaited<
					ReturnType<(typeof service)["requireConnection"]>
				>,
		);
		const result = await service.issues("fixture", { page, pageSize: 1 });
		expect(result.items[0].trakt?.mediaId).toBe(expectedMediaId);
		expect(findMany.mock.calls.filter(([query]) => query.select)).toHaveLength(
			mappingReads,
		);
	},
);
