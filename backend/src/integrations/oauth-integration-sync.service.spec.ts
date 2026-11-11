import { expect, it, vi } from "vitest";
import { parseEnvironment } from "../config/env.schema";
import type { PrismaService } from "../prisma/prisma.service";
import type { LocalSyncRecords } from "./local-records.service";
import type { WatchAccountLock } from "../privacy/watch-account-lock";
import { TraktSyncClient } from "../trakt-sync/trakt-sync.client";
import { TraktSyncService } from "../trakt-sync/trakt-sync.service";

// Ciphertexts created with the pre-extraction Trakt key derivation and wire format.
const access =
	"AAAAAAAAAAAAAAAABHf0ARY4UuJ0W8xPhOPVC6GqKQxebQcxhJV9cC5C0xzm5r0C4g";
const refresh =
	"AAAAAAAAAAAAAAAAHsI62iHDbgaXmaHGOJV_paGqKQxebQcxhJV9cC5C0w_g46oU4uI";
const config = parseEnvironment({
	NODE_ENV: "test",
	TRAKT_API_KEY: "fixture-client",
	BACKEND_PUBLIC_URL: "https://api.example.test",
	FRONTEND_URL: "https://example.test",
	PROVIDER_STATE_SECRET: "fixture-encryption-key-not-a-real-credential",
});
it.each([false, true])(
	"preserves existing Trakt encrypted credentials and expiry semantics (refresh: %s)",
	async (expired) => {
		const prisma = {
			integrationConnection: {
				findUniqueOrThrow: vi.fn(async () => ({
					id: "fixture",
					accessToken: access,
					refreshToken: refresh,
					expiresAt: new Date(expired ? 0 : 4102444800000),
				})),
				update: vi.fn(),
			},
		};
		const api = new TraktSyncClient(config);
		vi.spyOn(api, "refresh").mockResolvedValue({
			access_token: "fixture-new",
			refresh_token: "fixture-new-refresh",
			created_at: 1700000000,
			expires_in: 3600,
		});
		const service = new TraktSyncService(
			prisma as unknown as PrismaService,
			api,
			{} as LocalSyncRecords,
			config,
			{} as WatchAccountLock,
		);
		expect(
			await service["credential"]({ id: "fixture" } as Parameters<
				(typeof service)["credential"]
			>[0]),
		).toBe(expired ? "fixture-new" : "fixture-legacy-access");
		if (expired) {
			expect(api.refresh).toHaveBeenCalledWith("fixture-legacy-refresh");
			expect(prisma.integrationConnection.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ expiresAt: new Date(1700003600000) }),
				}),
			);
		} else expect(api.refresh).not.toHaveBeenCalled();
	},
);
it("returns Trakt's legacy mobile callback and the onboarding callback from the server", async () => {
	const prisma = { authState: { create: vi.fn() } };
	const service = new TraktSyncService(
		prisma as unknown as PrismaService,
		new TraktSyncClient(config),
		{} as LocalSyncRecords,
		config,
		{} as WatchAccountLock,
	);
	expect((await service.authorize("owner", "mobile")).returnUrl).toBe(
		"opnshelf://trakt-sync",
	);
	expect(
		(await service.authorize("owner", "mobile", "onboarding")).returnUrl,
	).toBe("opnshelf://onboarding");
});

it("keeps one User's rate-limited token exchange from blocking another User's connect", async () => {
	vi.useFakeTimers();
	try {
		const states = new Map<
			string,
			{ key: string; expiresAt: Date; stateData: string }
		>();
		const prisma = {
			authState: {
				create: async ({
					data,
				}: {
					data: { key: string; expiresAt: Date; stateData: string };
				}) => {
					states.set(data.key, data);
				},
				findUnique: async ({ where }: { where: { key: string } }) =>
					states.get(where.key),
				deleteMany: async ({ where }: { where: { key: string } }) => ({
					count: Number(states.delete(where.key)),
				}),
			},
			integrationConnection: {
				findFirst: async () => null,
				findUnique: async () => null,
				create: vi.fn(),
			},
		};
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(null, { status: 429, headers: { "retry-after": "900" } }),
			)
			.mockResolvedValueOnce(
				Response.json({
					access_token: "access",
					refresh_token: "refresh",
					expires_in: 3600,
					created_at: 1700000000,
				}),
			)
			.mockResolvedValueOnce(
				Response.json({
					user: { username: "fixture", ids: { uuid: "external-account" } },
				}),
			);
		vi.stubGlobal("fetch", fetcher);
		const service = new TraktSyncService(
			prisma as never,
			new TraktSyncClient(config),
			{} as never,
			config,
			{} as never,
		);
		const first = await service.authorize("owner-a", "web");
		expect(
			await service.callback(
				new URL(first.url).searchParams.get("state") ?? "",
				"code-a",
			),
		).toContain("connection=failed");
		const second = await service.authorize("owner-b", "web");
		const result = service.callback(
			new URL(second.url).searchParams.get("state") ?? "",
			"code-b",
		);
		await vi.runAllTimersAsync();
		expect(await result).toContain("connection=connected");
		expect(fetcher).toHaveBeenCalledTimes(3);
	} finally {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	}
});
