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
