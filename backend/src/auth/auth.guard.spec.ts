import type { Mocked } from "vitest";
import { type ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

// Mock PrismaService before importing AuthService/AuthGuard
vi.mock("../prisma/prisma.service", () => ({
	PrismaService: vi.fn(),
}));

// Mock @atproto modules to prevent import errors
vi.mock("@atproto/oauth-client-node", () => ({}));
vi.mock("@atproto/api", () => ({}));

import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";

describe("AuthGuard", () => {
	let guard: AuthGuard;
	let authService: Mocked<AuthService>;

	const mockAuthService = {
		getSessionById: vi.fn(),
		restoreBySession: vi.fn(),
		touchSession: vi.fn(),
		parseDeviceHeaders: vi.fn(),
		stampDevice: vi.fn(),
	};

	// A session whose absolute lifetime is comfortably in the future.
	const futureExpiry = () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

	const createMockExecutionContext = (
		cookies: Record<string, string> = {},
		headers: Record<string, string> = {},
	) => {
		const mockRequest = {
			cookies,
			headers,
		};

		return {
			switchToHttp: () => ({
				getRequest: () => mockRequest,
			}),
		} as unknown as ExecutionContext;
	};

	beforeEach(async () => {
		vi.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AuthGuard,
				{ provide: AuthService, useValue: mockAuthService },
			],
		}).compile();

		guard = module.get<AuthGuard>(AuthGuard);
		authService = module.get(AuthService);
	});

	describe("canActivate", () => {
		it("should throw UnauthorizedException when no session cookie", async () => {
			const context = createMockExecutionContext({});

			await expect(guard.canActivate(context)).rejects.toThrow(
				new UnauthorizedException("Not authenticated"),
			);
		});

		it("should throw UnauthorizedException when session not found in DB", async () => {
			mockAuthService.getSessionById.mockResolvedValue(null);
			const context = createMockExecutionContext({
				session: "invalid-session",
			});

			await expect(guard.canActivate(context)).rejects.toThrow(
				new UnauthorizedException("Session not found or expired"),
			);
			expect(mockAuthService.getSessionById).toHaveBeenCalledWith(
				"invalid-session",
			);
		});

		it("should throw UnauthorizedException when session is expired", async () => {
			const expiredRecord = {
				id: "session-123",
				userDid: "did:plc:abc123",
				sessionData: "{}",
				expiresAt: new Date(Date.now() - 1000), // already past
				lastUsedAt: new Date(Date.now() - 1000),
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			mockAuthService.getSessionById.mockResolvedValue(expiredRecord);

			const context = createMockExecutionContext({ session: "session-123" });

			await expect(guard.canActivate(context)).rejects.toThrow(
				new UnauthorizedException("Session not found or expired"),
			);
			// Expired sessions must never reach restore().
			expect(mockAuthService.restoreBySession).not.toHaveBeenCalled();
		});

		it("should reject an expired session presented via Bearer token", async () => {
			const expiredRecord = {
				id: "session-123",
				userDid: "did:plc:abc123",
				sessionData: "{}",
				expiresAt: new Date(Date.now() - 1000),
				lastUsedAt: new Date(Date.now() - 1000),
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			mockAuthService.getSessionById.mockResolvedValue(expiredRecord);

			const mockRequest = {
				cookies: {},
				headers: { authorization: "Bearer session-123" },
			};
			const context = {
				switchToHttp: () => ({ getRequest: () => mockRequest }),
			} as unknown as ExecutionContext;

			await expect(guard.canActivate(context)).rejects.toThrow(
				new UnauthorizedException("Session not found or expired"),
			);
			expect(mockAuthService.restoreBySession).not.toHaveBeenCalled();
		});

		it("should throw UnauthorizedException when restore returns null", async () => {
			const mockSessionRecord = {
				id: "session-123",
				userDid: "did:plc:abc123",
				sessionData: "{}",
				expiresAt: futureExpiry(),
				lastUsedAt: new Date(),
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			mockAuthService.getSessionById.mockResolvedValue(mockSessionRecord);
			mockAuthService.restoreBySession.mockResolvedValue(undefined);

			const context = createMockExecutionContext({ session: "session-123" });

			await expect(guard.canActivate(context)).rejects.toThrow(
				new UnauthorizedException("Session not found or expired"),
			);
			expect(mockAuthService.restoreBySession).toHaveBeenCalledWith(
				mockSessionRecord,
			);
		});

		it("should attach user to request and return true when valid session", async () => {
			const mockSessionRecord = {
				id: "session-123",
				userDid: "did:plc:abc123",
				sessionData: "{}",
				expiresAt: futureExpiry(),
				lastUsedAt: new Date(),
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			const mockSession = { did: "did:plc:abc123" };

			mockAuthService.getSessionById.mockResolvedValue(mockSessionRecord);
			mockAuthService.restoreBySession.mockResolvedValue(mockSession);

			const mockRequest = { cookies: { session: "session-123" }, headers: {} };
			const context = {
				switchToHttp: () => ({
					getRequest: () => mockRequest,
				}),
			} as unknown as ExecutionContext;

			const result = await guard.canActivate(context);

			expect(result).toBe(true);
			expect((mockRequest as any).user).toEqual({
				did: "did:plc:abc123",
				session: mockSession,
			});
		});

		describe("device stamping (ADR-0015)", () => {
			const record = (overrides: Record<string, unknown> = {}) => ({
				id: "session-123",
				userDid: "did:plc:abc123",
				sessionData: "{}",
				deviceId: "device-a",
				deviceName: "iPhone 15 Pro",
				devicePlatform: "ios",
				expiresAt: futureExpiry(),
				lastUsedAt: new Date(),
				createdAt: new Date(),
				updatedAt: new Date(),
				...overrides,
			});

			beforeEach(() => {
				mockAuthService.restoreBySession.mockResolvedValue({
					did: "did:plc:abc123",
				});
			});

			it("stamps when the claimed device differs from the stored one", async () => {
				mockAuthService.getSessionById.mockResolvedValue(
					record({ deviceId: "old-device", deviceName: null }),
				);
				mockAuthService.parseDeviceHeaders.mockReturnValue({
					deviceId: "device-a",
					name: "iPhone 15 Pro",
					platform: "ios",
				});

				await guard.canActivate(
					createMockExecutionContext({ session: "session-123" }),
				);

				expect(mockAuthService.stampDevice).toHaveBeenCalledWith({
					sessionId: "session-123",
					userDid: "did:plc:abc123",
					deviceId: "device-a",
					name: "iPhone 15 Pro",
					platform: "ios",
				});
			});

			it("does not write when the stored device already matches", async () => {
				mockAuthService.getSessionById.mockResolvedValue(record());
				mockAuthService.parseDeviceHeaders.mockReturnValue({
					deviceId: "device-a",
					name: "iPhone 15 Pro",
					platform: "ios",
				});

				await guard.canActivate(
					createMockExecutionContext({ session: "session-123" }),
				);

				expect(mockAuthService.stampDevice).not.toHaveBeenCalled();
			});

			it("leaves the session alone when no device headers are sent", async () => {
				mockAuthService.getSessionById.mockResolvedValue(record());
				mockAuthService.parseDeviceHeaders.mockReturnValue(null);

				const result = await guard.canActivate(
					createMockExecutionContext({ session: "session-123" }),
				);

				expect(result).toBe(true);
				expect(mockAuthService.stampDevice).not.toHaveBeenCalled();
			});
		});

		it("should rethrow UnauthorizedException from inner try block", async () => {
			const mockSessionRecord = {
				id: "session-123",
				userDid: "did:plc:abc123",
				sessionData: "{}",
				expiresAt: futureExpiry(),
				lastUsedAt: new Date(),
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			mockAuthService.getSessionById.mockResolvedValue(mockSessionRecord);
			mockAuthService.restoreBySession.mockResolvedValue(null);

			const context = createMockExecutionContext({ session: "session-123" });

			await expect(guard.canActivate(context)).rejects.toThrow(
				UnauthorizedException,
			);
		});

		it("propagates infrastructure failures instead of invalidating a valid session", async () => {
			const mockSessionRecord = {
				id: "session-123",
				userDid: "did:plc:abc123",
				sessionData: "{}",
				expiresAt: futureExpiry(),
				lastUsedAt: new Date(),
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			mockAuthService.getSessionById.mockResolvedValue(mockSessionRecord);
			mockAuthService.restoreBySession.mockRejectedValue(
				new Error("Database error"),
			);

			const context = createMockExecutionContext({ session: "session-123" });

			await expect(guard.canActivate(context)).rejects.toThrow(
				new Error("Database error"),
			);
		});

		it("should handle undefined cookies object", async () => {
			const mockRequest = { headers: {} };
			const context = {
				switchToHttp: () => ({
					getRequest: () => mockRequest,
				}),
			} as unknown as ExecutionContext;

			await expect(guard.canActivate(context)).rejects.toThrow(
				new UnauthorizedException("Not authenticated"),
			);
		});

		it("should authenticate with Bearer token", async () => {
			const mockSessionRecord = {
				id: "session-123",
				userDid: "did:plc:abc123",
				sessionData: "{}",
				expiresAt: futureExpiry(),
				lastUsedAt: new Date(),
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			const mockSession = { did: "did:plc:abc123" };

			mockAuthService.getSessionById.mockResolvedValue(mockSessionRecord);
			mockAuthService.restoreBySession.mockResolvedValue(mockSession);

			const mockRequest = {
				cookies: {},
				headers: { authorization: "Bearer session-123" },
			};
			const context = {
				switchToHttp: () => ({
					getRequest: () => mockRequest,
				}),
			} as unknown as ExecutionContext;

			const result = await guard.canActivate(context);

			expect(result).toBe(true);
			expect(mockAuthService.getSessionById).toHaveBeenCalledWith(
				"session-123",
			);
		});

		it("should prefer a case-insensitive Bearer token over the cookie", async () => {
			const mockSessionRecord = {
				id: "bearer-session",
				userDid: "did:plc:abc123",
				sessionData: "{}",
				expiresAt: futureExpiry(),
				lastUsedAt: new Date(),
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			mockAuthService.getSessionById.mockResolvedValue(mockSessionRecord);
			mockAuthService.restoreBySession.mockResolvedValue({
				did: "did:plc:abc123",
			});
			const context = createMockExecutionContext(
				{ session: "cookie-session" },
				{ authorization: "bEaReR bearer-session" },
			);

			await expect(guard.canActivate(context)).resolves.toBe(true);
			expect(mockAuthService.getSessionById).toHaveBeenCalledWith(
				"bearer-session",
			);
		});

		it("should fall back to the cookie for malformed Bearer authorization", async () => {
			mockAuthService.getSessionById.mockResolvedValue(null);
			const context = createMockExecutionContext(
				{ session: "cookie-session" },
				{ authorization: "Bearer one two" },
			);

			await expect(guard.canActivate(context)).rejects.toThrow(
				new UnauthorizedException("Session not found or expired"),
			);
			expect(mockAuthService.getSessionById).toHaveBeenCalledWith(
				"cookie-session",
			);
		});
	});
});
