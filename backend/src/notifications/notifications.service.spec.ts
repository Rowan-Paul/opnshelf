import { BadRequestException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
		pushDevice: {
			count: vi.fn(),
			findMany: vi.fn(),
			findUnique: vi.fn(),
			upsert: vi.fn(),
			deleteMany: vi.fn(),
		},
	};
	const email = { sendNotification: vi.fn() };
	const service = new NotificationsService(prisma as never, email as never);

	beforeEach(() => {
		vi.clearAllMocks();
		prisma.notificationSettings.upsert.mockResolvedValue(settings);
		prisma.pushDevice.count.mockResolvedValue(0);
		prisma.pushDevice.findUnique.mockResolvedValue(null);
		email.sendNotification.mockResolvedValue(undefined);
	});

	afterEach(() => vi.unstubAllGlobals());
	it("reports rejected push delivery and removes expired device registrations", async () => {
		prisma.pushDevice.findMany.mockResolvedValue([
			{ token: "ExpoPushToken[test]" },
		]);
		const fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				data: { status: "error", details: { error: "DeviceNotRegistered" } },
			}),
		});
		vi.stubGlobal("fetch", fetch);
		await expect(service.sendTest("did:plc:user", "push")).rejects.toThrow(
			"One or more devices",
		);
		expect(prisma.pushDevice.deleteMany).toHaveBeenCalledWith({
			where: { token: "ExpoPushToken[test]" },
		});
		const payload = JSON.parse(fetch.mock.calls[0][1].body);
		expect(payload).toMatchObject({
			channelId: "releases",
			data: { path: "/settings/notifications" },
		});
	});

	it("sends test email only to the authenticated user's verified address", async () => {
		await expect(service.sendTest("did:plc:user", "email")).rejects.toThrow(
			"Confirm",
		);
		expect(email.sendNotification).not.toHaveBeenCalled();
		prisma.notificationSettings.upsert.mockResolvedValue({
			...settings,
			email: "verified@example.com",
			emailVerifiedAt: new Date(),
		});
		await service.sendTest("did:plc:user", "email");
		expect(email.sendNotification).toHaveBeenCalledWith(
			expect.objectContaining({ to: "verified@example.com" }),
		);
	});

	it("does not claim a test push was sent without a registered device", async () => {
		prisma.pushDevice.findMany.mockResolvedValue([]);
		await expect(service.sendTest("did:plc:user", "push")).rejects.toThrow(
			"Enable mobile",
		);
		expect(prisma.pushDevice.findMany).toHaveBeenCalledWith({
			where: { userDid: "did:plc:user" },
		});
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
		prisma.pushDevice.findUnique.mockResolvedValue({ userDid: "did:plc:user" });
		await service.registerPushDevice("did:plc:user", {
			token: "ExpoPushToken[test]",
			platform: "ios",
		});
		expect(prisma.notificationSettings.update).not.toHaveBeenCalled();
	});

	it("makes a new device due without resetting existing push preferences", async () => {
		prisma.notificationSettings.upsert.mockResolvedValue({
			...settings,
			pushInitialized: true,
		});
		await service.registerPushDevice("did:plc:user", {
			token: "ExpoPushToken[new]",
			platform: "android",
		});
		expect(prisma.notificationSettings.update).toHaveBeenCalledWith({
			where: { userDid: "did:plc:user" },
			data: { nextQueueAt: expect.any(Date) },
		});
	});
});
