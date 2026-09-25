import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationsService } from "./notifications.service";

describe("NotificationsService", () => {
	const settings = {
		userDid: "did:plc:user",
		email: null,
		pendingEmail: null,
		emailVerifiedAt: null,
		emailCodeHash: null,
		emailCodeExpiresAt: null,
		emailCodeAttempts: 0,
		emailIsCustom: false,
		pushInitialized: false,
		pushNewReleases: false,
		pushWatchlistReleases: false,
		pushNewSeasons: false,
		pushStats: false,
		emailNewReleases: true,
		emailWatchlistReleases: true,
		emailNewSeasons: true,
		emailStats: true,
	};
	const prisma = {
		notificationSettings: {
			upsert: vi.fn(),
			update: vi.fn(),
		},
		pushDevice: { count: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
	};
	const email = { sendNotification: vi.fn() };
	const service = new NotificationsService(prisma as never, email as never);

	beforeEach(() => {
		vi.clearAllMocks();
		prisma.notificationSettings.upsert.mockResolvedValue(settings);
		prisma.pushDevice.count.mockResolvedValue(0);
		email.sendNotification.mockResolvedValue(undefined);
	});

	it("does not replace a verified address until the new code is confirmed", async () => {
		const existing = {
			...settings,
			email: "old@example.com",
			emailVerifiedAt: new Date(),
		};
		prisma.notificationSettings.upsert.mockResolvedValueOnce(existing);
		await service.requestEmail("did:plc:user", " New@Example.com ");
		expect(email.sendNotification).toHaveBeenCalledWith(
			expect.objectContaining({ to: "new@example.com" }),
		);
		expect(prisma.notificationSettings.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				update: expect.objectContaining({ pendingEmail: "new@example.com" }),
			}),
		);
		expect(
			prisma.notificationSettings.upsert.mock.calls[0][0].update.email,
		).toBeUndefined();
	});

	it("limits incorrect confirmation attempts", async () => {
		prisma.notificationSettings.upsert.mockResolvedValue({
			...settings,
			pendingEmail: "new@example.com",
			emailCodeHash: "0".repeat(64),
			emailCodeExpiresAt: new Date(Date.now() + 60_000),
			emailCodeAttempts: 5,
		});
		await expect(
			service.confirmEmail("did:plc:user", "123456"),
		).rejects.toBeInstanceOf(BadRequestException);
		expect(prisma.notificationSettings.update).not.toHaveBeenCalled();
	});

	it("enables push defaults only on the first device registration", async () => {
		prisma.pushDevice.upsert.mockResolvedValue({});
		await service.registerPushDevice("did:plc:user", {
			token: "ExpoPushToken[test]",
			platform: "ios",
		});
		expect(prisma.notificationSettings.update).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					pushInitialized: true,
					pushStats: true,
				}),
			}),
		);
		prisma.notificationSettings.update.mockClear();
		prisma.notificationSettings.upsert.mockResolvedValue({
			...settings,
			pushInitialized: true,
		});
		await service.registerPushDevice("did:plc:user", {
			token: "ExpoPushToken[test]",
			platform: "ios",
		});
		expect(prisma.notificationSettings.update).not.toHaveBeenCalled();
	});
});
