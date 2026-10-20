import { Logger } from "@nestjs/common";
import { afterEach, expect, it, vi } from "vitest";
import { parseEnvironment } from "../config/env.schema";
import type { WatchAccountLock } from "../privacy/watch-account-lock";
import type { PrismaService } from "../prisma/prisma.service";
import type { LocalSyncRecords } from "./local-records.service";
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
		traktSyncConnection: {
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
		traktSyncEntry: {
			findMany: vi.fn(async () => entries),
			update: vi.fn(),
			create: vi.fn(),
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
	expect(prisma.traktSyncEntry.update).not.toHaveBeenCalled();
	expect(prisma.traktSyncEntry.create).not.toHaveBeenCalled();
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
			traktSyncEntry: {
				findMany: vi.fn(async () => entries),
				update: vi.fn(),
				create: vi.fn(),
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
		expect(prisma.traktSyncEntry.update).toHaveBeenCalledTimes(updates);
		if (updates)
			expect(prisma.traktSyncEntry.update).toHaveBeenCalledWith(
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
		traktSyncEntry: { findMany: vi.fn(async () => []), create: vi.fn() },
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
	expect(prisma.traktSyncEntry.create).toHaveBeenCalledTimes(200);
	expect(
		prisma.traktSyncEntry.create.mock.calls.every(
			([input]) => input.data.linked,
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
			traktSyncEntry: { findMany: vi.fn(async () => entries) },
			traktSyncConnection: { update: vi.fn() },
		};
		const service = new TraktSyncService(
			prisma as unknown as PrismaService,
			{ snapshot: vi.fn(async () => remote) } as unknown as TraktSyncClient,
			{ snapshot } as unknown as LocalSyncRecords,
			parseEnvironment({ NODE_ENV: "test" }),
			{} as WatchAccountLock,
		);
		service["token"] = vi.fn(async () => "fixture");
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
			traktSyncEntry: { findMany: vi.fn(async () => entries), update },
			traktSyncConnection: { update: vi.fn() },
		};
		const service = new TraktSyncService(
			prisma as unknown as PrismaService,
			{} as TraktSyncClient,
			{ snapshot: vi.fn(async () => local) } as unknown as LocalSyncRecords,
			parseEnvironment({ NODE_ENV: "test" }),
			{} as WatchAccountLock,
		);
		service["token"] = vi.fn(async () => "fixture");
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
			traktSyncEntry: { findMany, groupBy },
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
	for (const query of [findMany.mock.calls[0], groupBy.mock.calls[0]])
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
				traktSyncEntry: {
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
