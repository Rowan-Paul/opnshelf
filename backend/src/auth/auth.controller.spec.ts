import type { Mock, Mocked } from "vitest";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Response } from "express";

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

import { IngesterService } from "../ingester/ingester.service";
import { UsersService } from "../users/users.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { MobileHandoffService } from "./mobile-handoff.service";

// The OAuth callback has its own file: auth.controller.callback.spec.ts.
describe("AuthController", () => {
	let controller: AuthController;

	const mockAuthService: {
		getClientMetadata: Mock;
		authorize: Mock;
		authorizeWithPds: Mock;
		getUser: Mock;
		hasBlueskyProfile: Mock;
		revokeBySessionId: Mock;
	} = {
		getClientMetadata: vi.fn(),
		authorize: vi.fn(),
		authorizeWithPds: vi.fn(),
		getUser: vi.fn(),
		hasBlueskyProfile: vi.fn().mockResolvedValue(false),
		revokeBySessionId: vi.fn(),
	};

	const mockMobileHandoff = {
		issueMobileHandoffCode: vi.fn().mockReturnValue("handoff-code"),
	};

	const mockIngesterService = {
		addRepo: vi.fn().mockResolvedValue(undefined),
	};

	const mockUsersService = {
		initializeProfileForNewUser: vi.fn().mockResolvedValue(undefined),
	};

	const mockConfigService = {
		get: vi.fn((key: string) => {
			const config: Record<string, string> = {
				FRONTEND_URL: "http://127.0.0.1:3000",
				NODE_ENV: "test",
				PDS_HANDLE_DOMAIN: "opnshelf.social",
			};
			return config[key];
		}),
	};

	const createMockResponse = () => {
		const res = {
			redirect: vi.fn().mockReturnThis(),
			cookie: vi.fn().mockReturnThis(),
			clearCookie: vi.fn().mockReturnThis(),
			status: vi.fn().mockReturnThis(),
			json: vi.fn().mockReturnThis(),
		} as unknown as Mocked<Response>;
		return res;
	};

	const createMockRequest = (
		overrides: Partial<import("express").Request> = {},
	) => {
		return {
			url: "/auth/callback",
			cookies: {},
			...overrides,
		} as unknown as import("express").Request;
	};

	beforeEach(async () => {
		vi.clearAllMocks();
		mockAuthService.authorize.mockResolvedValue(
			"https://pds.example/authorize",
		);

		const module: TestingModule = await Test.createTestingModule({
			controllers: [AuthController],
			providers: [
				{ provide: AuthService, useValue: mockAuthService },
				{ provide: ConfigService, useValue: mockConfigService },
				{ provide: IngesterService, useValue: mockIngesterService },
				{ provide: UsersService, useValue: mockUsersService },
				{ provide: MobileHandoffService, useValue: mockMobileHandoff },
			],
		}).compile();

		controller = module.get<AuthController>(AuthController);
	});

	describe("getClientMetadata", () => {
		it("should return client metadata from auth service", () => {
			const mockMetadata = {
				client_id:
					"http://127.0.0.1:3001/.well-known/oauth-client-metadata.json",
				client_name: "Opnshelf",
			};
			mockAuthService.getClientMetadata.mockReturnValue(mockMetadata);

			const result = controller.getClientMetadata();

			expect(result).toEqual(mockMetadata);
			expect(mockAuthService.getClientMetadata).toHaveBeenCalled();
		});
	});

	describe("login", () => {
		it("should redirect to auth URL on success", async () => {
			const authUrl = "https://bsky.social/oauth/authorize?state=abc";
			mockAuthService.authorize.mockResolvedValue(authUrl);
			const res = createMockResponse();

			await controller.login(
				"user.bsky.social",
				undefined,
				undefined,
				undefined,
				res,
			);

			expect(mockAuthService.authorize).toHaveBeenCalledWith(
				"user.bsky.social",
				{
					platform: undefined,
					timezone: undefined,
					codeChallenge: undefined,
				},
			);
			expect(res.redirect).toHaveBeenCalledWith(authUrl);
		});

		it("carries a valid code_challenge into the OAuth state", async () => {
			mockAuthService.authorize.mockResolvedValue("https://pds.example/authz");
			const res = createMockResponse();

			await controller.login(
				"user.bsky.social",
				"mobile",
				undefined,
				"CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
				res,
			);

			expect(mockAuthService.authorize).toHaveBeenCalledWith(
				"user.bsky.social",
				{
					platform: "mobile",
					timezone: undefined,
					codeChallenge: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
				},
			);
		});

		it("rejects a malformed code_challenge before starting OAuth", async () => {
			const res = createMockResponse();

			await controller.login(
				"user.bsky.social",
				"mobile",
				undefined,
				"not-base64url!",
				res,
			);

			expect(mockAuthService.authorize).not.toHaveBeenCalled();
			expect(res.redirect).toHaveBeenCalledWith(
				"opnshelf://auth/complete?error=auth_failed",
			);
		});

		it("should redirect with error when handle is not provided", async () => {
			const res = createMockResponse();

			await controller.login(undefined, undefined, undefined, undefined, res);

			expect(mockAuthService.authorize).not.toHaveBeenCalled();
			expect(res.redirect).toHaveBeenCalledWith(
				"http://127.0.0.1:3000/login?error=handle_required",
			);
		});

		it("should redirect to mobile login when handle is not provided on mobile", async () => {
			const res = createMockResponse();

			await controller.login(undefined, "mobile", undefined, undefined, res);

			expect(mockAuthService.authorize).not.toHaveBeenCalled();
			expect(res.redirect).toHaveBeenCalledWith(
				"opnshelf://auth/complete?error=handle_required",
			);
		});

		it("should set platform cookie when platform=mobile", async () => {
			const authUrl = "https://bsky.social/oauth/authorize?state=abc";
			mockAuthService.authorize.mockResolvedValue(authUrl);
			const res = createMockResponse();

			await controller.login(
				"user.bsky.social",
				"mobile",
				undefined,
				undefined,
				res,
			);

			expect(mockAuthService.authorize).toHaveBeenCalledWith(
				"user.bsky.social",
				{
					platform: "mobile",
					timezone: undefined,
				},
			);
			expect(res.cookie).toHaveBeenCalledWith("auth_platform", "mobile", {
				httpOnly: true,
				secure: false,
				maxAge: 5 * 60 * 1000,
				sameSite: "lax",
			});
			expect(res.redirect).toHaveBeenCalledWith(authUrl);
		});

		it("should set timezone cookie when timezone provided", async () => {
			const authUrl = "https://bsky.social/oauth/authorize?state=abc";
			mockAuthService.authorize.mockResolvedValue(authUrl);
			const res = createMockResponse();

			await controller.login(
				"user.bsky.social",
				undefined,
				"Europe/London",
				undefined,
				res,
			);

			expect(mockAuthService.authorize).toHaveBeenCalledWith(
				"user.bsky.social",
				{
					platform: undefined,
					timezone: "Europe/London",
				},
			);
			expect(res.cookie).toHaveBeenCalledWith(
				"auth_timezone",
				"Europe/London",
				{
					httpOnly: true,
					secure: false,
					maxAge: 5 * 60 * 1000,
					sameSite: "lax",
				},
			);
			expect(res.redirect).toHaveBeenCalledWith(authUrl);
		});

		it("should redirect to frontend with error on failure", async () => {
			mockAuthService.authorize.mockRejectedValue(new Error("OAuth error"));
			const res = createMockResponse();

			await controller.login(
				"user.bsky.social",
				undefined,
				undefined,
				undefined,
				res,
			);

			expect(res.redirect).toHaveBeenCalledWith(
				"http://127.0.0.1:3000/login?error=auth_failed",
			);
		});

		it("should redirect to mobile login on failure when platform is mobile", async () => {
			mockAuthService.authorize.mockRejectedValue(new Error("OAuth error"));
			const res = createMockResponse();

			await controller.login(
				"user.bsky.social",
				"mobile",
				undefined,
				undefined,
				res,
			);

			expect(res.redirect).toHaveBeenCalledWith(
				"opnshelf://auth/complete?error=auth_failed",
			);
		});
	});

	describe("signup", () => {
		it("carries a valid code_challenge into the OAuth state", async () => {
			mockAuthService.authorizeWithPds.mockResolvedValue(
				"https://pds.example/authz",
			);
			const res = createMockResponse();

			await controller.signup(
				"mobile",
				"Europe/London",
				"CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
				res,
			);

			expect(mockAuthService.authorizeWithPds).toHaveBeenCalledWith(
				{
					platform: "mobile",
					timezone: "Europe/London",
					codeChallenge: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
				},
				"create",
			);
		});

		it("should redirect to frontend with error on signup failure", async () => {
			mockAuthService.authorizeWithPds.mockRejectedValue(
				new Error("OAuth error"),
			);
			const res = createMockResponse();

			await controller.signup(undefined, undefined, undefined, res);

			expect(res.redirect).toHaveBeenCalledWith(
				"http://127.0.0.1:3000/login?error=auth_failed",
			);
		});

		it("should redirect to mobile login on signup failure when platform is mobile", async () => {
			mockAuthService.authorizeWithPds.mockRejectedValue(
				new Error("OAuth error"),
			);
			const res = createMockResponse();

			await controller.signup("mobile", undefined, undefined, res);

			expect(res.redirect).toHaveBeenCalledWith(
				"opnshelf://auth/complete?error=auth_failed",
			);
		});
	});

	describe("me", () => {
		it("should return user data when authenticated", async () => {
			const mockUser = {
				did: "did:plc:abc123",
				handle: "user.bsky.social",
				displayName: "Test User",
				avatar: "https://example.com/avatar.jpg",
				onboardingCompletedAt: new Date("2026-01-01T00:00:00.000Z"),
				emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
				isNativePds: false,
				blueskyProfileUrl: null,
				tangledProfileUrl: null,
				showBlueskyOnProfile: true,
				showTangledOnProfile: true,
			};
			mockAuthService.getUser.mockResolvedValue(mockUser);

			const req = createMockRequest({
				user: { did: "did:plc:abc123", session: {} },
			} as unknown as import("express").Request);

			const result = await controller.me(
				req as unknown as import("../auth/types").AuthenticatedRequest,
			);

			expect(result).toEqual({
				did: "did:plc:abc123",
				handle: "user.bsky.social",
				displayName: "Test User",
				avatar: "https://example.com/avatar.jpg",
				onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
				needsOnboarding: false,
				emailVerifiedAt: "2026-01-01T00:00:00.000Z",
				needsEmailVerification: false,
				blueskyProfileUrl: null,
				tangledProfileUrl: null,
				showBlueskyOnProfile: true,
				showTangledOnProfile: true,
			});
			expect(mockAuthService.getUser).toHaveBeenCalledWith("did:plc:abc123");
			expect(mockAuthService.hasBlueskyProfile).not.toHaveBeenCalled();
		});

		it("gates a native account whose email is not yet verified", async () => {
			mockAuthService.getUser.mockResolvedValue({
				did: "did:plc:jane",
				handle: "jane.opnshelf.social",
				displayName: null,
				avatar: null,
				onboardingCompletedAt: null,
				emailVerifiedAt: null,
				isNativePds: true,
				blueskyProfileUrl: null,
				tangledProfileUrl: null,
				showBlueskyOnProfile: true,
				showTangledOnProfile: true,
			});

			const result = await controller.me(
				createMockRequest({
					user: { did: "did:plc:jane", session: {} },
				} as unknown as import("express").Request) as unknown as import("../auth/types").AuthenticatedRequest,
			);

			expect(result.needsEmailVerification).toBe(true);
		});

		it("never gates an external account even when emailVerifiedAt is null", async () => {
			mockAuthService.getUser.mockResolvedValue({
				did: "did:plc:abc123",
				handle: "user.bsky.social",
				displayName: null,
				avatar: null,
				onboardingCompletedAt: null,
				emailVerifiedAt: null,
				isNativePds: false,
				blueskyProfileUrl: null,
				tangledProfileUrl: null,
				showBlueskyOnProfile: true,
				showTangledOnProfile: true,
			});

			const result = await controller.me(
				createMockRequest({
					user: { did: "did:plc:abc123", session: {} },
				} as unknown as import("express").Request) as unknown as import("../auth/types").AuthenticatedRequest,
			);

			expect(result.needsEmailVerification).toBe(false);
		});

		it("should throw BadRequestException when no user in request", async () => {
			const req = createMockRequest();

			await expect(
				controller.me(
					req as unknown as import("../auth/types").AuthenticatedRequest,
				),
			).rejects.toThrow(BadRequestException);
		});

		it("should throw UnauthorizedException when user not found in DB", async () => {
			mockAuthService.getUser.mockResolvedValue(null);

			const req = createMockRequest({
				user: { did: "did:plc:abc123", session: {} },
			} as unknown as import("express").Request);

			await expect(
				controller.me(
					req as unknown as import("../auth/types").AuthenticatedRequest,
				),
			).rejects.toThrow(UnauthorizedException);
		});
	});

	describe("blueskyProfileStatus", () => {
		it("should return Bluesky profile status when authenticated", async () => {
			mockAuthService.hasBlueskyProfile.mockResolvedValue(true);

			const session = { did: "did:plc:abc123" };
			const req = createMockRequest({
				user: { did: "did:plc:abc123", session },
			} as unknown as import("express").Request);

			const result = await controller.blueskyProfileStatus(
				req as unknown as import("../auth/types").AuthenticatedRequest,
			);

			expect(result).toEqual({ hasBlueskyProfile: true });
			// Reuses the session the guard already restored (no re-restore).
			expect(mockAuthService.hasBlueskyProfile).toHaveBeenCalledWith(session);
		});

		it("should throw BadRequestException when no user in request", async () => {
			const req = createMockRequest();

			await expect(
				controller.blueskyProfileStatus(
					req as unknown as import("../auth/types").AuthenticatedRequest,
				),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe("logout", () => {
		it("should revoke session and clear cookie", async () => {
			const req = createMockRequest({
				cookies: { session: "session-123" },
				user: { did: "did:plc:abc123", session: {} },
			} as unknown as import("express").Request);
			const res = createMockResponse();

			await controller.logout(
				req as unknown as import("../auth/types").AuthenticatedRequest,
				res,
			);

			expect(mockAuthService.revokeBySessionId).toHaveBeenCalledWith(
				"session-123",
			);
			expect(res.clearCookie).toHaveBeenCalledWith(
				"session",
				expect.objectContaining({
					httpOnly: true,
					sameSite: "lax",
					path: "/",
				}),
			);
			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith({
				message: "Logged out successfully",
			});
		});

		it("should revoke a bearer-only session", async () => {
			const req = createMockRequest({
				headers: { authorization: "Bearer bearer-session" },
			});
			const res = createMockResponse();

			await controller.logout(
				req as unknown as import("../auth/types").AuthenticatedRequest,
				res,
			);

			expect(mockAuthService.revokeBySessionId).toHaveBeenCalledOnce();
			expect(mockAuthService.revokeBySessionId).toHaveBeenCalledWith(
				"bearer-session",
			);
			expect(res.clearCookie).toHaveBeenCalled();
		});

		it("should prefer the bearer session over the cookie", async () => {
			const req = createMockRequest({
				headers: { authorization: "Bearer bearer-session" },
				cookies: { session: "cookie-session" },
			});
			const res = createMockResponse();

			await controller.logout(
				req as unknown as import("../auth/types").AuthenticatedRequest,
				res,
			);

			expect(mockAuthService.revokeBySessionId).toHaveBeenCalledOnce();
			expect(mockAuthService.revokeBySessionId).toHaveBeenCalledWith(
				"bearer-session",
			);
		});

		it("should still clear cookie when no session exists", async () => {
			const req = createMockRequest({
				cookies: {},
				user: { did: "did:plc:abc123", session: {} },
			} as unknown as import("express").Request);
			const res = createMockResponse();

			await controller.logout(
				req as unknown as import("../auth/types").AuthenticatedRequest,
				res,
			);

			expect(mockAuthService.revokeBySessionId).not.toHaveBeenCalled();
			expect(res.clearCookie).toHaveBeenCalled();
			expect(res.status).toHaveBeenCalledWith(200);
		});

		it("should clear the cookie even when server revocation fails", async () => {
			mockAuthService.revokeBySessionId.mockRejectedValueOnce(
				new Error("database unavailable"),
			);
			const req = createMockRequest({
				cookies: { session: "session-123" },
			});
			const res = createMockResponse();

			await expect(
				controller.logout(
					req as unknown as import("../auth/types").AuthenticatedRequest,
					res,
				),
			).rejects.toThrow("database unavailable");
			expect(res.clearCookie).toHaveBeenCalled();
			expect(res.status).not.toHaveBeenCalled();
		});
	});
});
