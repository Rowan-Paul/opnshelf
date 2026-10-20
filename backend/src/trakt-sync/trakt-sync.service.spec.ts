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
