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
