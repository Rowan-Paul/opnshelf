import { Logger } from "@nestjs/common";
import { afterEach, expect, it, vi } from "vitest";
import { parseEnvironment } from "../config/env.schema";
import type { WatchAccountLock } from "../privacy/watch-account-lock";
import type { PrismaService } from "../prisma/prisma.service";
import type { LocalSyncRecords } from "../integrations/local-records.service";
import { BingersSyncClient, BingersSyncError } from "./bingers-sync.client";
import { BingersSyncService } from "./bingers-sync.service";

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
		throw new BingersSyncError("private-code private-token private-user", 401);
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
	const api = new BingersSyncClient(config);
	vi.spyOn(api, "exchange").mockImplementation(async () => {
		if (failure === "exchange") fail();
		return {
			access_token: "private-token",
			refresh_token: "private-refresh",
			expires_in: 3600,
			token_type: "Bearer",
			scope: "library:read offline_access",
		};
	});
	vi.spyOn(api, "profile").mockImplementation(async () => {
		if (failure === "profile") fail();
		return { name: "private-user", sub: "private-id" };
	});
	vi.spyOn(api, "revoke").mockResolvedValue(undefined);
	const service = new BingersSyncService(
		prisma as unknown as PrismaService,
		api,
		{} as LocalSyncRecords,
		config,
		{} as WatchAccountLock,
	);
	const { url } = await service.authorize("private-did", "web");
	const state = new URL(url).searchParams.get("state") ?? "";
	expect(await service.callback(state, "private-code")).toBe(
		"https://example.test/integrations/bingers?provider=bingers&connection=failed",
	);
	expect(warn.mock.calls.map(([message]) => [JSON.parse(message)])).toEqual([
		[
			{
				message: "Bingers OAuth callback failed",
				stage,
				category: "bingers-api",
				status: 401,
			},
		],
	]);
});

it("keeps OAuth state encrypted, single-use and platform-specific", async () => {
	const config = parseEnvironment({
		NODE_ENV: "test",
		BACKEND_PUBLIC_URL: "https://api.example.test",
		FRONTEND_URL: "https://example.test",
		PROVIDER_STATE_SECRET: "fixture-encryption-key-not-a-real-credential",
	});
	let saved: { key: string; stateData: string; expiresAt: Date } | undefined;
	let claimed = false;
	const prisma = {
		authState: {
			create: vi.fn(async ({ data }) => {
				saved = data;
			}),
			findUnique: vi.fn(async () => saved),
			deleteMany: vi.fn(async () => {
				if (claimed) return { count: 0 };
				claimed = true;
				return { count: 1 };
			}),
		},
		integrationConnection: {
			findFirst: vi.fn(async () => null),
			findUnique: vi.fn(async () => null),
			create: vi.fn(async (_args: { data: { accessToken: string } }) => ({
				id: "fixture",
			})),
		},
	};
	const api = new BingersSyncClient(config);
	vi.spyOn(api, "exchange").mockResolvedValue({
		access_token: "fixture-access",
		refresh_token: "fixture-refresh",
		token_type: "Bearer",
		scope: "library:read offline_access",
		expires_in: 3600,
	});
	vi.spyOn(api, "profile").mockResolvedValue({
		sub: "fixture-user",
		name: "Fixture",
	});
	const service = new BingersSyncService(
		prisma as unknown as PrismaService,
		api,
		{} as LocalSyncRecords,
		config,
		{} as WatchAccountLock,
	);
	const url = new URL(
		(await service.authorize("fixture-did", "mobile", "onboarding")).url,
	);
	expect(url.searchParams.get("scope")).not.toContain("library:write");
	expect(url.searchParams.get("code_challenge_method")).toBe("S256");
	expect(saved?.stateData).not.toContain("fixture-did");
	const state = url.searchParams.get("state") ?? "";
	expect(await service.callback(state, "fixture-code")).toBe(
		"opnshelf://onboarding?provider=bingers&connection=connected",
	);
	const data = prisma.integrationConnection.create.mock.calls[0]?.[0].data;
	expect(data).toMatchObject({
		provider: "bingers",
		accountId: "fixture-user",
		direction: "inbound",
	});
	expect(data?.accessToken).not.toBe("fixture-access");
	vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
	expect(await service.callback(state, "fixture-code")).toContain(
		"connection=failed",
	);
	expect(api.exchange).toHaveBeenCalledTimes(1);
});
it("rejects outbound settings and explicit remote writes before touching data", async () => {
	const config = parseEnvironment({ NODE_ENV: "test" });
	const service = new BingersSyncService(
		{} as PrismaService,
		{} as BingersSyncClient,
		{} as LocalSyncRecords,
		config,
		{} as WatchAccountLock,
	);
	await expect(
		service.configure("fixture", {
			direction: "both",
			watches: true,
			ratings: true,
			historyScope: "all",
			publicationConsent: true,
		}),
	).rejects.toThrow("incoming");
	await expect(
		service.resolveIssue("fixture", "entry", { action: "opnshelf" }),
	).rejects.toThrow("not supported");
});
it("does not pair unsupported aggregate history with an existing local Watch", async () => {
	const record = {
		kind: "watch" as const,
		mediaType: "movie" as const,
		mediaId: "42",
		season: 0,
		episode: 0,
		title: "Fixture",
		value: "2026-01-01T00:00:00Z",
	};
	const prisma = {
		integrationEntry: {
			findMany: vi.fn(async () => []),
			createMany: vi.fn(),
			update: vi.fn(),
		},
	};
	const service = new BingersSyncService(
		prisma as unknown as PrismaService,
		{} as BingersSyncClient,
		{} as LocalSyncRecords,
		parseEnvironment({ NODE_ENV: "test" }),
		{} as WatchAccountLock,
	);
	await service["discover"](
		{ id: "fixture", watches: true, historyScope: "all" } as Parameters<
			(typeof service)["discover"]
		>[0],
		[{ ...record, key: "local" }],
		[{ ...record, key: "remote", problem: "aggregate" }],
	);
	const entries = prisma.integrationEntry.createMany.mock.calls.flatMap(
		([arg]) => arg.data,
	);
	expect(entries.find((e) => e.remoteKey === "remote")).toMatchObject({
		localKey: undefined,
		linked: false,
		issue: "aggregate",
	});
});

it("preserves a linked Watch when the remote becomes an unsupported aggregate", async () => {
	const record = {
		key: "local",
		kind: "watch" as const,
		mediaType: "movie" as const,
		mediaId: "42",
		season: 0,
		episode: 0,
		title: "Fixture",
		value: "2026-01-01T00:00:00Z",
	};
	const before = { ...record, key: "remote" };
	const aggregate = {
		...before,
		value: "2026-02-01T00:00:00Z",
		problem: "aggregate history",
	};
	const entry = {
		id: "entry",
		kind: "watch",
		localKey: "local",
		remoteKey: "remote",
		localBase: record,
		remoteBase: before,
		eligible: true,
		linked: true,
	};
	const prisma = {
		integrationEntry: { findMany: vi.fn(async () => [entry]), update: vi.fn() },
		integrationConnection: { update: vi.fn() },
	};
	const service = new BingersSyncService(
		prisma as unknown as PrismaService,
		{} as BingersSyncClient,
		{ snapshot: vi.fn(async () => [record]) } as unknown as LocalSyncRecords,
		parseEnvironment({ NODE_ENV: "test" }),
		{} as WatchAccountLock,
	);
	service["credential"] = vi.fn(async () => ({
		connectionId: "fixture",
		token: "fixture",
	}));
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
			remoteSnapshot: [aggregate],
			remoteReadAt: new Date(),
		} as unknown as Parameters<(typeof service)["process"]>[0],
		async () => undefined,
	);
	expect(transfer).not.toHaveBeenCalled();
	expect(prisma.integrationEntry.update).toHaveBeenCalledWith(
		expect.objectContaining({
			data: expect.objectContaining({ issue: "aggregate history" }),
		}),
	);
});
