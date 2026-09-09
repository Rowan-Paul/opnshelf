import type { Mock } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

// Mock PrismaService before importing the controller/AuthService
vi.mock("../prisma/prisma.service", () => ({
	PrismaService: vi.fn(),
}));

// Mock @atproto modules to prevent import errors
vi.mock("@atproto/oauth-client-node", () => ({}));
vi.mock("@atproto/api", () => ({}));
vi.mock("@atproto/tap", () => ({
	Tap: vi.fn(),
	SimpleIndexer: vi.fn(),
}));

import { AuthService } from "./auth.service";
import { DeviceSessionsService } from "./device-sessions.service";
import { DevicesController } from "./devices.controller";

describe("DevicesController", () => {
	let controller: DevicesController;

	const mockSessions: {
		listDevices: Mock;
		revokeOtherDevices: Mock;
		revokeDevice: Mock;
	} = {
		listDevices: vi.fn(),
		revokeOtherDevices: vi.fn(),
		revokeDevice: vi.fn(),
	};

	const reqFor = (overrides: Record<string, unknown> = {}) =>
		({
			headers: {},
			cookies: {},
			user: { did: "did:plc:abc123", session: {} },
			...overrides,
		}) as unknown as import("./types").AuthenticatedRequest;

	beforeEach(async () => {
		vi.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			controllers: [DevicesController],
			providers: [
				{ provide: DeviceSessionsService, useValue: mockSessions },
				// AuthGuard on the routes resolves AuthService from the module.
				{ provide: AuthService, useValue: {} },
			],
		}).compile();

		controller = module.get<DevicesController>(DevicesController);
	});

	describe("listDevices", () => {
		it("serialises dates and marks the caller's own Device", async () => {
			const lastUsedAt = new Date("2026-08-01T10:00:00.000Z");
			const createdAt = new Date("2026-07-20T10:00:00.000Z");
			mockSessions.listDevices.mockResolvedValue([
				{
					deviceId: "device-a",
					name: "iPhone 15 Pro",
					platform: "ios",
					isCurrent: true,
					lastUsedAt,
					createdAt,
				},
			]);

			const result = await controller.listDevices(
				reqFor({ headers: { authorization: "Bearer session-123" } }),
			);

			expect(mockSessions.listDevices).toHaveBeenCalledWith(
				"did:plc:abc123",
				"session-123",
			);
			expect(result).toEqual([
				{
					deviceId: "device-a",
					name: "iPhone 15 Pro",
					platform: "ios",
					isCurrent: true,
					lastUsedAt: "2026-08-01T10:00:00.000Z",
					createdAt: "2026-07-20T10:00:00.000Z",
				},
			]);
		});
	});

	describe("revokeOtherDevices", () => {
		it("keeps the requesting session and reports the count", async () => {
			mockSessions.revokeOtherDevices.mockResolvedValue(2);

			await expect(
				controller.revokeOtherDevices(
					reqFor({ cookies: { opnshelf_session: "session-123" } }),
				),
			).resolves.toEqual({ revoked: 2 });
			expect(mockSessions.revokeOtherDevices).toHaveBeenCalledWith(
				"did:plc:abc123",
				"session-123",
			);
		});
	});

	describe("revokeDevice", () => {
		it("scopes the revoke to the caller's DID", async () => {
			mockSessions.revokeDevice.mockResolvedValue(1);

			await expect(
				controller.revokeDevice(reqFor(), "device-b"),
			).resolves.toEqual({ revoked: 1 });
			expect(mockSessions.revokeDevice).toHaveBeenCalledWith(
				"did:plc:abc123",
				"device-b",
			);
		});

		it("answers an unknown or foreign device with 404, never a revoke", async () => {
			mockSessions.revokeDevice.mockResolvedValue(0);

			await expect(
				controller.revokeDevice(reqFor(), "someone-elses-device"),
			).rejects.toThrow(NotFoundException);
		});
	});
});
