import type { Mock } from "vitest";
import { CredentialSession } from "@atproto/api";
import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";

// Mock PrismaService before importing DeviceSessionsService
vi.mock("../prisma/prisma.service", () => ({
	PrismaService: vi.fn().mockImplementation(() => ({
		$transaction: vi.fn(),
		$queryRaw: vi.fn(),
		authSession: {
			findUnique: vi.fn(),
			upsert: vi.fn(),
			update: vi.fn(),
			deleteMany: vi.fn(),
		},
		authState: {
			findUnique: vi.fn(),
			upsert: vi.fn(),
			delete: vi.fn(),
			deleteMany: vi.fn(),
		},
		user: {
			findUnique: vi.fn(),
			update: vi.fn(),
			upsert: vi.fn(),
		},
	})),
}));

// Mock the @atproto/oauth-client-node module. The service now builds one client
// per device session, so every `new NodeOAuthClient()` returns the SAME shared
// mock — tests reference its authorize/callback/restore directly.
const sharedOAuthClient = vi.hoisted(() => ({
	authorize: vi.fn(),
	callback: vi.fn(),
	restore: vi.fn(),
}));
vi.mock("@atproto/oauth-client-node", () => ({
	NodeOAuthClient: vi.fn().mockImplementation(() => sharedOAuthClient),
	// Vitest throws on undefined named exports (Jest returned undefined);
	// oauth-client.factory imports this at module load.
	requestLocalLock: vi.fn(),
}));

const credentialSessionHarness = vi.hoisted(() => ({
	instances: [] as Array<{
		did?: string;
		resumeSession: Mock;
		persistSession: (event: string, session?: Record<string, unknown>) => void;
	}>,
}));

// Mock the @atproto/api module
vi.mock("@atproto/api", () => ({
	Agent: vi.fn().mockImplementation(() => {
		const getProfile = vi.fn();
		return {
			com: {
				atproto: {
					repo: {
						describeRepo: vi.fn(),
						getRecord: vi.fn(),
					},
				},
			},
			getProfile,
			withProxy: vi.fn().mockReturnValue({ getProfile }),
		};
	}),
	CredentialSession: vi
		.fn()
		.mockImplementation(
			(
				_serviceUrl: URL,
				_fetch: unknown,
				persistSession: (
					event: string,
					session?: Record<string, unknown>,
				) => void,
			) => {
				const instance: {
					did?: string;
					resumeSession: Mock;
					persistSession: (
						event: string,
						session?: Record<string, unknown>,
					) => void;
				} = {
					persistSession,
					resumeSession: vi.fn(async (session: Record<string, unknown>) => {
						instance.did = session.did as string;
						persistSession("update", {
							...session,
							accessJwt: "rotated-access",
							refreshJwt: "rotated-refresh",
						});
					}),
				};
				credentialSessionHarness.instances.push(instance);
				return instance;
			},
		),
}));

import { PrismaService } from "../prisma/prisma.service";
import { DeviceSessionsService } from "./device-sessions.service";
import { OAuthClientFactory } from "./oauth-client.factory";

describe("DeviceSessionsService", () => {
	let service: DeviceSessionsService;

	const mockPrismaService = {
		$transaction: vi.fn(),
		$queryRaw: vi.fn(),
		authSession: {
			findUnique: vi.fn(),
			findFirst: vi.fn(),
			findMany: vi.fn(),
			upsert: vi.fn(),
			update: vi.fn(),
			deleteMany: vi.fn(),
		},
		authState: {
			findUnique: vi.fn(),
			upsert: vi.fn(),
			delete: vi.fn(),
			deleteMany: vi.fn(),
		},
		user: {
			findUnique: vi.fn(),
			update: vi.fn(),
			upsert: vi.fn(),
		},
	};

	const baseConfig: Record<string, string | number> = {
		BACKEND_PUBLIC_URL: "http://127.0.0.1:3001",
		PDS_URL: "https://opnshelf.social",
		PORT: 3001,
		NODE_ENV: "test",
	};

	const mockConfigService = {
		get: vi.fn((key: string) => baseConfig[key]),
	};

	beforeEach(async () => {
		vi.clearAllMocks();
		mockPrismaService.$queryRaw.mockResolvedValue([]);
		// Tests that override get() with mockImplementation leak into every later
		// test (clearAllMocks doesn't undo it), so restore the base config here.
		mockConfigService.get.mockImplementation((key: string) => baseConfig[key]);
		credentialSessionHarness.instances.length = 0;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				DeviceSessionsService,
				OAuthClientFactory,
				{ provide: PrismaService, useValue: mockPrismaService },
				{ provide: ConfigService, useValue: mockConfigService },
			],
		}).compile();

		service = module.get<DeviceSessionsService>(DeviceSessionsService);
		// Build the shared state store + login client, as Nest does at boot.
		module.get(OAuthClientFactory).onModuleInit();
	});

	describe("getSessionById", () => {
		it("should return session record when found", async () => {
			const mockSession = {
				id: "session-123",
				userDid: "did:plc:abc123",
				sessionData: "{}",
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			mockPrismaService.authSession.findUnique.mockResolvedValue(mockSession);

			const result = await service.getSessionById("session-123");

			expect(result).toEqual(mockSession);
			expect(mockPrismaService.authSession.findUnique).toHaveBeenCalledWith({
				where: { id: "session-123" },
			});
		});

		it("should return null when session not found", async () => {
			mockPrismaService.authSession.findUnique.mockResolvedValue(null);

			const result = await service.getSessionById("nonexistent");

			expect(result).toBeNull();
		});
	});

	describe("revoke", () => {
		it("atomically deletes every session for the DID and clears matching live managers", async () => {
			mockPrismaService.$queryRaw.mockResolvedValue([
				{ id: "session-123" },
				{ id: "session-456" },
			]);
			const oauthClients = Reflect.get(service, "oauthClients") as Map<
				string,
				unknown
			>;
			const credentialSessions = Reflect.get(
				service,
				"credentialSessions",
			) as Map<string, unknown>;
			oauthClients.set("session-123", {});
			oauthClients.set("unrelated", {});
			credentialSessions.set("session-456", {});
			credentialSessions.set("unrelated", {});

			await expect(service.revoke("did:plc:abc123")).resolves.toBe(2);

			expect(mockPrismaService.$queryRaw).toHaveBeenCalledOnce();
			const query = mockPrismaService.$queryRaw.mock.calls[0]?.[0] as {
				strings: string[];
				values: unknown[];
			};
			expect(query.strings.join(" ")).toContain('DELETE FROM "AuthSession"');
			expect(query.strings.join(" ")).toContain('RETURNING "id"');
			expect(query.values).toEqual(["did:plc:abc123"]);
			expect(mockPrismaService.authSession.findMany).not.toHaveBeenCalled();
			expect(mockPrismaService.authSession.deleteMany).not.toHaveBeenCalled();
			expect(oauthClients.has("session-123")).toBe(false);
			expect(credentialSessions.has("session-456")).toBe(false);
			expect(oauthClients.has("unrelated")).toBe(true);
			expect(credentialSessions.has("unrelated")).toBe(true);
		});

		it("propagates the original database error", async () => {
			const databaseError = new Error("DB error");
			mockPrismaService.$queryRaw.mockRejectedValue(databaseError);

			await expect(service.revoke("did:plc:abc123")).rejects.toBe(
				databaseError,
			);
		});
	});

	describe("revokeBySessionId", () => {
		it("deletes the session by id and clears its live managers", async () => {
			mockPrismaService.$queryRaw.mockResolvedValue([{ id: "session-123" }]);
			const oauthClients = Reflect.get(service, "oauthClients") as Map<
				string,
				unknown
			>;
			const credentialSessions = Reflect.get(
				service,
				"credentialSessions",
			) as Map<string, unknown>;
			oauthClients.set("session-123", {});
			oauthClients.set("unrelated", {});
			credentialSessions.set("session-123", {});
			credentialSessions.set("unrelated", {});

			await expect(service.revokeBySessionId("session-123")).resolves.toBe(1);

			const query = mockPrismaService.$queryRaw.mock.calls[0]?.[0] as {
				values: unknown[];
			};
			expect(query.values).toEqual(["session-123"]);
			expect(oauthClients.has("session-123")).toBe(false);
			expect(credentialSessions.has("session-123")).toBe(false);
			expect(oauthClients.has("unrelated")).toBe(true);
			expect(credentialSessions.has("unrelated")).toBe(true);
		});

		it("propagates the original database error", async () => {
			const databaseError = new Error("DB error");
			mockPrismaService.$queryRaw.mockRejectedValue(databaseError);

			await expect(service.revokeBySessionId("session-123")).rejects.toBe(
				databaseError,
			);
		});
	});

	describe("parseDeviceHeaders", () => {
		it("decodes the label, caps its length and strips control characters", () => {
			const long = "A".repeat(100);
			expect(
				service.parseDeviceHeaders({
					id: "device-a",
					name: encodeURIComponent("Rowan's iPhone\u0000\u001f"),
					platform: "IOS",
				}),
			).toEqual({
				deviceId: "device-a",
				name: "Rowan's iPhone",
				platform: "ios",
			});
			expect(
				service.parseDeviceHeaders({ id: "device-a", name: long })?.name,
			).toHaveLength(64);
		});

		it("ignores a malformed label rather than failing the request", () => {
			expect(
				service.parseDeviceHeaders({ id: "device-a", name: "%E0%A4%A" }),
			).toEqual({ deviceId: "device-a", name: null, platform: null });
		});

		it("rejects a missing or oversized id, and an unknown platform", () => {
			expect(service.parseDeviceHeaders({})).toBeNull();
			expect(service.parseDeviceHeaders({ id: "   " })).toBeNull();
			expect(service.parseDeviceHeaders({ id: "x".repeat(129) })).toBeNull();
			expect(
				service.parseDeviceHeaders({ id: "device-a", platform: "toaster" })
					?.platform,
			).toBeNull();
		});
	});

	describe("stampDevice", () => {
		it("revokes the same install's older sessions but never the current one", async () => {
			mockPrismaService.authSession.findMany.mockResolvedValue([
				{ id: "older-session" },
			]);
			mockPrismaService.$transaction.mockResolvedValue([]);

			await service.stampDevice({
				sessionId: "session-123",
				userDid: "did:plc:abc123",
				deviceId: "device-a",
				name: "Pixel 8",
				platform: "android",
			});

			expect(mockPrismaService.authSession.findMany).toHaveBeenCalledWith({
				where: {
					userDid: "did:plc:abc123",
					deviceId: "device-a",
					id: { not: "session-123" },
				},
				select: { id: true },
			});
			expect(mockPrismaService.$transaction).toHaveBeenCalledOnce();
			expect(mockPrismaService.authSession.deleteMany).toHaveBeenCalledWith({
				where: { id: { in: ["older-session"] } },
			});
			expect(mockPrismaService.authSession.update).toHaveBeenCalledWith({
				where: { id: "session-123" },
				data: {
					deviceId: "device-a",
					deviceName: "Pixel 8",
					devicePlatform: "android",
				},
			});
		});

		it("swallows failures so a valid request still succeeds", async () => {
			mockPrismaService.authSession.findMany.mockRejectedValue(
				new Error("DB error"),
			);

			await expect(
				service.stampDevice({
					sessionId: "session-123",
					userDid: "did:plc:abc123",
					deviceId: "device-a",
					name: null,
					platform: null,
				}),
			).resolves.toBeUndefined();
		});
	});

	describe("listDevices", () => {
		it("flags the caller's own device and never returns the session id", async () => {
			const lastUsedAt = new Date("2026-08-01T10:00:00.000Z");
			const createdAt = new Date("2026-07-20T10:00:00.000Z");
			mockPrismaService.authSession.findMany.mockResolvedValue([
				{
					id: "session-123",
					deviceId: "device-a",
					deviceName: "iPhone 15 Pro",
					devicePlatform: "ios",
					lastUsedAt,
					createdAt,
				},
				{
					id: "session-456",
					deviceId: "device-b",
					deviceName: null,
					devicePlatform: null,
					lastUsedAt,
					createdAt,
				},
			]);

			const devices = await service.listDevices(
				"did:plc:abc123",
				"session-123",
			);

			expect(devices).toEqual([
				{
					deviceId: "device-a",
					name: "iPhone 15 Pro",
					platform: "ios",
					isCurrent: true,
					lastUsedAt,
					createdAt,
				},
				{
					deviceId: "device-b",
					name: null,
					platform: null,
					isCurrent: false,
					lastUsedAt,
					createdAt,
				},
			]);
			expect(JSON.stringify(devices)).not.toContain("session-123");
			// Expired rows linger until the cleanup job, so they must be filtered.
			expect(
				mockPrismaService.authSession.findMany.mock.calls[0][0].where,
			).toMatchObject({
				userDid: "did:plc:abc123",
				expiresAt: { gt: expect.any(Date) },
			});
		});
	});

	describe("revokeDevice", () => {
		it("scopes the revoke to the caller's own DID", async () => {
			mockPrismaService.$queryRaw.mockResolvedValue([{ id: "session-456" }]);

			const revoked = await service.revokeDevice("did:plc:abc123", "device-b");

			expect(revoked).toBe(1);
			const query = mockPrismaService.$queryRaw.mock.calls[0]?.[0] as {
				values: unknown[];
			};
			expect(query.values).toEqual(["did:plc:abc123", "device-b"]);
		});

		it("reports nothing revoked for another user's device", async () => {
			await expect(
				service.revokeDevice("did:plc:abc123", "someone-elses-device"),
			).resolves.toBe(0);
			expect(mockPrismaService.$queryRaw).toHaveBeenCalledOnce();
		});
	});

	describe("revokeOtherDevices", () => {
		it("keeps the current session and drops the rest", async () => {
			mockPrismaService.$queryRaw.mockResolvedValue([
				{ id: "session-456" },
				{ id: "session-789" },
			]);

			const revoked = await service.revokeOtherDevices(
				"did:plc:abc123",
				"session-123",
			);

			expect(revoked).toBe(2);
			const query = mockPrismaService.$queryRaw.mock.calls[0]?.[0] as {
				values: unknown[];
			};
			expect(query.values).toEqual(["did:plc:abc123", "session-123"]);
		});
	});

	describe("cleanupExpiredSessions", () => {
		it("should delete expired auth sessions", async () => {
			mockPrismaService.authSession.deleteMany.mockResolvedValue({ count: 3 });

			await service.cleanupExpiredSessions();

			expect(mockPrismaService.authSession.deleteMany).toHaveBeenCalledWith({
				where: {
					expiresAt: { lt: expect.any(Date) },
				},
			});
		});
	});

	describe("touchSession", () => {
		it("should extend expiry when lastUsedAt is stale", async () => {
			mockPrismaService.authSession.update.mockResolvedValue({});
			const stale = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago

			await service.touchSession("session-123", stale);

			expect(mockPrismaService.authSession.update).toHaveBeenCalledWith({
				where: { id: "session-123" },
				data: {
					lastUsedAt: expect.any(Date),
					expiresAt: expect.any(Date),
				},
			});
		});

		it("should not write when lastUsedAt is recent", async () => {
			const recent = new Date(); // within the slide window

			await service.touchSession("session-123", recent);

			expect(mockPrismaService.authSession.update).not.toHaveBeenCalled();
		});

		it("does not log the session credential when the update fails", async () => {
			const sessionId = "sentinel-session-credential";
			const logger = (
				service as unknown as {
					logger: { warn: (...args: unknown[]) => void };
				}
			).logger;
			const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
			mockPrismaService.authSession.update.mockRejectedValue(
				new Error(`database update failed for ${sessionId}`),
			);

			await service.touchSession(
				sessionId,
				new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
			);

			expect(warn).toHaveBeenCalledWith("Failed to touch session");
			expect(JSON.stringify(warn.mock.calls)).not.toContain(sessionId);
		});
	});

	describe("restore", () => {
		it("should restore the freshest live session for the DID", async () => {
			const mockSession = { did: "did:plc:abc123" };
			mockPrismaService.authSession.findFirst.mockResolvedValue({
				id: "slot-1",
				userDid: "did:plc:abc123",
				kind: "oauth",
				sessionData: "{}",
			});
			sharedOAuthClient.restore.mockResolvedValue(mockSession);

			const result = await service.restore("did:plc:abc123");

			expect(mockPrismaService.authSession.findFirst).toHaveBeenCalled();
			expect(sharedOAuthClient.restore).toHaveBeenCalledWith("did:plc:abc123");
			expect(result).toEqual(mockSession);
		});

		it("should return undefined when there is no live session", async () => {
			mockPrismaService.authSession.findFirst.mockResolvedValue(null);

			const result = await service.restore("did:plc:abc123");

			expect(result).toBeUndefined();
		});

		it("should return undefined when the client restore fails", async () => {
			mockPrismaService.authSession.findFirst.mockResolvedValue({
				id: "slot-1",
				userDid: "did:plc:abc123",
				kind: "oauth",
				sessionData: "{}",
			});
			sharedOAuthClient.restore.mockRejectedValue(
				new Error("Session not found"),
			);

			const result = await service.restore("did:plc:abc123");

			expect(result).toBeUndefined();
		});
	});

	describe("restoreBySession", () => {
		it("reuses one credential session manager for repeated requests from a device", async () => {
			mockPrismaService.authSession.upsert.mockResolvedValue({});
			const record = {
				id: "credential-slot-1",
				userDid: "did:plc:abc123",
				kind: "credential",
				sessionData: JSON.stringify({
					did: "did:plc:abc123",
					handle: "alice.opnshelf.social",
					accessJwt: "stale-access",
					refreshJwt: "stale-refresh",
					active: true,
					pdsUrl: "https://opnshelf.social",
				}),
			};

			const first = await service.restoreBySession(record);
			const second = await service.restoreBySession(record);

			expect(CredentialSession).toHaveBeenCalledTimes(1);
			expect(
				credentialSessionHarness.instances[0]?.resumeSession,
			).toHaveBeenCalledTimes(1);
			expect(second).toBe(first);
		});

		it("does not log the session credential when a credential session expires", async () => {
			const sessionId = "sentinel-credential-slot";
			const did = "did:plc:abc123";
			const logger = (
				service as unknown as {
					logger: { warn: (...args: unknown[]) => void };
				}
			).logger;
			const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
			mockPrismaService.authSession.upsert.mockResolvedValue({});
			mockPrismaService.authSession.deleteMany.mockResolvedValue({ count: 1 });
			const record = {
				id: sessionId,
				userDid: did,
				kind: "credential",
				sessionData: JSON.stringify({
					did,
					handle: "alice.opnshelf.social",
					accessJwt: "stale-access",
					refreshJwt: "stale-refresh",
					active: true,
					pdsUrl: "https://opnshelf.social",
				}),
			};

			await service.restoreBySession(record);
			credentialSessionHarness.instances[0]?.persistSession("expired");

			expect(warn).toHaveBeenCalledWith(
				`Credential session expired for ${did}; revoking device session`,
			);
			expect(JSON.stringify(warn.mock.calls)).not.toContain(sessionId);
		});
	});

	describe("isKnownSession", () => {
		const credentialRecord = {
			id: "credential-slot-known",
			userDid: "did:plc:abc123",
			kind: "credential",
			sessionData: JSON.stringify({
				did: "did:plc:abc123",
				handle: "alice.opnshelf.social",
				accessJwt: "stale-access",
				refreshJwt: "stale-refresh",
				active: true,
				pdsUrl: "https://opnshelf.social",
			}),
		};

		it("is false for an id no login or restore has produced", () => {
			expect(service.isKnownSession("never-seen")).toBe(false);
		});

		it("is true for a restored credential session and false once it is revoked", async () => {
			mockPrismaService.authSession.upsert.mockResolvedValue({});
			await service.restoreBySession(credentialRecord);
			expect(service.isKnownSession(credentialRecord.id)).toBe(true);

			mockPrismaService.$queryRaw.mockResolvedValue([
				{ id: credentialRecord.id },
			]);
			await service.revokeBySessionId(credentialRecord.id);

			expect(service.isKnownSession(credentialRecord.id)).toBe(false);
		});

		it("is true while a credential restore is still in flight", () => {
			mockPrismaService.authSession.upsert.mockResolvedValue({});
			const pending = service.restoreBySession(credentialRecord);

			expect(service.isKnownSession(credentialRecord.id)).toBe(true);
			return pending;
		});
	});

	describe("evictAllExcept", () => {
		it("drops every live manager but the retained slot", () => {
			const oauthClients = Reflect.get(service, "oauthClients") as Map<
				string,
				unknown
			>;
			const credentialSessions = Reflect.get(
				service,
				"credentialSessions",
			) as Map<string, unknown>;
			oauthClients.set("retained", {});
			oauthClients.set("other-oauth", {});
			credentialSessions.set("retained", {});
			credentialSessions.set("other-credential", {});

			service.evictAllExcept("retained");

			expect([...oauthClients.keys()]).toEqual(["retained"]);
			expect([...credentialSessions.keys()]).toEqual(["retained"]);
		});
	});

	describe("getClientForSlot", () => {
		it("reuses the client built for a slot instead of building another", () => {
			const first = service.getClientForSlot("slot-a");
			const second = service.getClientForSlot("slot-a");

			expect(second).toBe(first);
			expect(service.isKnownSession("slot-a")).toBe(true);
		});
	});
});
