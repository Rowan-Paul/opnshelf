import type { Mock, Mocked } from "vitest";
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

/**
 * The OAuth callback is the densest route in AuthController: it mints the
 * session, applies permission changes, seeds new accounts and picks the
 * redirect, so its tests live apart from the rest of auth.controller.spec.ts.
 */
describe("AuthController callback", () => {
	let controller: AuthController;

	const mockAuthService: {
		authorize: Mock;
		callback: Mock;
		parseOAuthAppState: Mock;
		fetchProfile: Mock;
		upsertUser: Mock;
		getUser: Mock;
		assertGrantedScopes: Mock;
		completePermissionChange: Mock;
		disableIntegration: Mock;
		revokeBySessionId: Mock;
	} = {
		authorize: vi.fn(),
		callback: vi.fn(),
		parseOAuthAppState: vi.fn().mockReturnValue({}),
		fetchProfile: vi.fn(),
		upsertUser: vi.fn(),
		getUser: vi.fn(),
		assertGrantedScopes: vi.fn(),
		completePermissionChange: vi.fn().mockResolvedValue(undefined),
		disableIntegration: vi.fn().mockResolvedValue(undefined),
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
		mockConfigService.get.mockImplementation((key: string) => {
			const config: Record<string, string> = {
				FRONTEND_URL: "http://127.0.0.1:3000",
				NODE_ENV: "test",
				PDS_HANDLE_DOMAIN: "opnshelf.social",
			};
			return config[key];
		});
		mockAuthService.parseOAuthAppState.mockReturnValue({});
		// clearAllMocks keeps implementations, so a stubbed user from one test
		// would otherwise leak into the next callback's isNativePds lookup.
		mockAuthService.getUser.mockResolvedValue(undefined);
		mockAuthService.authorize.mockResolvedValue(
			"https://pds.example/authorize",
		);
		mockMobileHandoff.issueMobileHandoffCode.mockReturnValue("handoff-code");

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

	describe("callback", () => {
		it("should set cookie and redirect to /auth/complete on success", async () => {
			const mockSession = { did: "did:plc:abc123" };
			const mockProfile = {
				did: "did:plc:abc123",
				handle: "user.bsky.social",
				displayName: "Test User",
				avatar: "https://example.com/avatar.jpg",
			};
			mockAuthService.callback.mockResolvedValue({
				session: mockSession,
				sessionId: "session-123",
			});
			mockAuthService.fetchProfile.mockResolvedValue(mockProfile);
			mockAuthService.upsertUser.mockResolvedValue(mockProfile);

			const req = createMockRequest({
				url: "/auth/callback?code=abc&state=xyz",
			});
			const res = createMockResponse();

			await controller.callback(req, res);

			expect(mockAuthService.callback).toHaveBeenCalled();
			expect(mockAuthService.fetchProfile).toHaveBeenCalledWith(mockSession);
			expect(mockAuthService.upsertUser).toHaveBeenCalledWith(
				mockProfile,
				undefined,
				{ emailVerified: true, isNativePds: false },
			);
			expect(res.cookie).toHaveBeenCalledWith(
				"opnshelf_session",
				"session-123",
				expect.objectContaining({
					httpOnly: true,
					sameSite: "lax",
					path: "/",
				}),
			);
			expect(res.redirect).toHaveBeenCalledWith(
				"http://127.0.0.1:3000/auth/complete",
			);
		});

		it("initializes the seeded profile and default lists for new users", async () => {
			const mockSession = { did: "did:plc:new123" };
			const mockProfile = {
				did: "did:plc:new123",
				handle: "new-user.bsky.social",
				displayName: "New User",
				avatar: "https://example.com/avatar.jpg",
			};
			mockAuthService.callback.mockResolvedValue({
				session: mockSession,
				sessionId: "session-123",
			});
			mockAuthService.fetchProfile.mockResolvedValue(mockProfile);
			mockAuthService.upsertUser.mockResolvedValue({
				user: mockProfile,
				isNewUser: true,
			});

			const req = createMockRequest({
				url: "/auth/callback?code=abc&state=xyz",
			});
			const res = createMockResponse();

			await controller.callback(req, res);

			expect(mockUsersService.initializeProfileForNewUser).toHaveBeenCalledWith(
				"did:plc:new123",
				mockSession,
				{
					handle: "new-user.bsky.social",
					displayName: "New User",
					avatarUrl: "https://example.com/avatar.jpg",
				},
			);
		});

		it("should register user DID with Tab on successful callback", async () => {
			const mockSession = { did: "did:plc:abc123" };
			const mockProfile = {
				did: "did:plc:abc123",
				handle: "user.bsky.social",
				displayName: "Test User",
				avatar: "https://example.com/avatar.jpg",
			};
			mockAuthService.callback.mockResolvedValue({
				session: mockSession,
				sessionId: "session-123",
			});
			mockAuthService.fetchProfile.mockResolvedValue(mockProfile);
			mockAuthService.upsertUser.mockResolvedValue(mockProfile);

			const req = createMockRequest({
				url: "/auth/callback?code=abc&state=xyz",
			});
			const res = createMockResponse();

			await controller.callback(req, res);

			expect(mockAuthService.upsertUser).toHaveBeenCalledWith(
				mockProfile,
				undefined,
				{ emailVerified: true, isNativePds: false },
			);
			expect(mockIngesterService.addRepo).toHaveBeenCalledWith(
				"did:plc:abc123",
				{ markBackfillStart: true },
			);
		});

		it("should still redirect on success even if Tab registration fails", async () => {
			const mockSession = { did: "did:plc:abc123" };
			const mockProfile = {
				did: "did:plc:abc123",
				handle: "user.bsky.social",
				displayName: "Test User",
				avatar: "https://example.com/avatar.jpg",
			};
			mockAuthService.callback.mockResolvedValue({
				session: mockSession,
				sessionId: "session-123",
			});
			mockAuthService.fetchProfile.mockResolvedValue(mockProfile);
			mockAuthService.upsertUser.mockResolvedValue(mockProfile);
			mockIngesterService.addRepo.mockRejectedValue(new Error("Tab error"));

			const req = createMockRequest({
				url: "/auth/callback?code=abc&state=xyz",
			});
			const res = createMockResponse();

			await controller.callback(req, res);

			expect(mockAuthService.upsertUser).toHaveBeenCalledWith(
				mockProfile,
				undefined,
				{ emailVerified: true, isNativePds: false },
			);
			expect(res.redirect).toHaveBeenCalledWith(
				"http://127.0.0.1:3000/auth/complete",
			);
		});

		it("should redirect to mobile deep link when platform cookie is set", async () => {
			const mockSession = { did: "did:plc:abc123" };
			const mockProfile = {
				did: "did:plc:abc123",
				handle: "user.bsky.social",
				displayName: "Test User",
				avatar: "https://example.com/avatar.jpg",
			};
			mockAuthService.callback.mockResolvedValue({
				session: mockSession,
				sessionId: "session-123",
			});
			mockAuthService.fetchProfile.mockResolvedValue(mockProfile);
			mockAuthService.upsertUser.mockResolvedValue(mockProfile);

			const req = createMockRequest({
				url: "/auth/callback?code=abc&state=xyz",
				cookies: { auth_platform: "mobile" },
			});
			const res = createMockResponse();

			await controller.callback(req, res);

			expect(mockAuthService.upsertUser).toHaveBeenCalledWith(
				mockProfile,
				undefined,
				{ emailVerified: true, isNativePds: false },
			);
			expect(res.clearCookie).toHaveBeenCalledWith("auth_platform");
			expect(res.redirect).toHaveBeenCalledWith(
				"opnshelf://auth/complete?session=session-123",
			);
		});

		it("should redirect to mobile deep link when state contains mobile platform", async () => {
			const mockSession = { did: "did:plc:abc123" };
			const mockProfile = {
				did: "did:plc:abc123",
				handle: "user.bsky.social",
				displayName: "Test User",
				avatar: "https://example.com/avatar.jpg",
			};
			mockAuthService.callback.mockResolvedValue({
				session: mockSession,
				state: '{"platform":"mobile"}',
				sessionId: "session-123",
			});
			mockAuthService.parseOAuthAppState.mockReturnValue({
				platform: "mobile",
			});
			mockAuthService.fetchProfile.mockResolvedValue(mockProfile);
			mockAuthService.upsertUser.mockResolvedValue(mockProfile);

			const req = createMockRequest({
				url: "/auth/callback?code=abc&state=xyz",
				cookies: {},
			});
			const res = createMockResponse();

			await controller.callback(req, res);

			expect(mockAuthService.parseOAuthAppState).toHaveBeenCalledWith(
				'{"platform":"mobile"}',
			);
			expect(res.redirect).toHaveBeenCalledWith(
				"opnshelf://auth/complete?session=session-123",
			);
		});

		it("resumes an AT Store permission grant in the mobile composer", async () => {
			const mockSession = { did: "did:plc:abc123" };
			mockAuthService.callback.mockResolvedValue({
				session: mockSession,
				state: "permission-state",
				sessionId: "session-123",
			});
			mockAuthService.parseOAuthAppState.mockReturnValue({
				platform: "mobile",
				permissionChange: "atstore",
				requestedPreferences: { atStoreReviewEnabled: true },
			});
			mockAuthService.fetchProfile.mockResolvedValue({
				did: "did:plc:abc123",
				handle: "reader.example",
				displayName: "Reader",
				avatar: null,
			});
			mockAuthService.upsertUser.mockResolvedValue({ isNewUser: false });

			const res = createMockResponse();
			await controller.callback(createMockRequest(), res);

			expect(res.redirect).toHaveBeenCalledWith(
				"opnshelf://auth/complete?session=session-123&permission=atstore",
			);
		});

		it("hands the app a single-use code, never the session id, when the state carries a challenge", async () => {
			mockAuthService.callback.mockResolvedValue({
				session: { did: "did:plc:abc123" },
				state: "mobile-state",
				sessionId: "session-123",
			});
			mockAuthService.parseOAuthAppState.mockReturnValue({
				platform: "mobile",
				codeChallenge: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
			});
			mockAuthService.fetchProfile.mockResolvedValue({
				did: "did:plc:abc123",
				handle: "user.bsky.social",
				displayName: "Test User",
				avatar: null,
			});
			mockAuthService.upsertUser.mockResolvedValue({ isNewUser: false });
			const res = createMockResponse();

			await controller.callback(createMockRequest(), res);

			expect(mockMobileHandoff.issueMobileHandoffCode).toHaveBeenCalledWith(
				"session-123",
				"CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
			);
			expect(res.redirect).toHaveBeenCalledWith(
				"opnshelf://auth/complete?code=handoff-code",
			);
			const redirectUrl = (res.redirect as Mock).mock.calls[0][0] as string;
			expect(redirectUrl).not.toContain("session-123");
		});

		it("keeps the permission marker alongside the handoff code", async () => {
			mockAuthService.callback.mockResolvedValue({
				session: { did: "did:plc:abc123" },
				state: "mobile-state",
				sessionId: "session-123",
			});
			mockAuthService.parseOAuthAppState.mockReturnValue({
				platform: "mobile",
				permissionChange: "atstore",
				requestedPreferences: { atStoreReviewEnabled: true },
				codeChallenge: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
			});
			mockAuthService.fetchProfile.mockResolvedValue({
				did: "did:plc:abc123",
				handle: "user.bsky.social",
				displayName: "Test User",
				avatar: null,
			});
			mockAuthService.upsertUser.mockResolvedValue({ isNewUser: false });
			const res = createMockResponse();

			await controller.callback(createMockRequest(), res);

			expect(res.redirect).toHaveBeenCalledWith(
				"opnshelf://auth/complete?code=handoff-code&permission=atstore",
			);
		});

		it("should redirect with error on callback failure", async () => {
			mockAuthService.callback.mockRejectedValue(new Error("OAuth error"));

			const req = createMockRequest({
				url: "/auth/callback?code=abc&state=xyz",
			});
			const res = createMockResponse();

			await controller.callback(req, res);

			expect(res.redirect).toHaveBeenCalledWith(
				"http://127.0.0.1:3000/login?error=callback_failed",
			);
		});

		it("should redirect to mobile deep link on callback failure when error state is mobile", async () => {
			const error = new Error("OAuth error") as Error & { state?: string };
			error.state = '{"platform":"mobile"}';
			mockAuthService.callback.mockRejectedValue(error);
			mockAuthService.parseOAuthAppState.mockReturnValue({
				platform: "mobile",
			});

			const req = createMockRequest({
				url: "/auth/callback?code=abc&state=xyz",
			});
			const res = createMockResponse();

			await controller.callback(req, res);

			expect(res.redirect).toHaveBeenCalledWith(
				"opnshelf://auth/complete?error=callback_failed",
			);
		});

		it("should redirect to mobile login on callback failure when mobile cookie is set", async () => {
			mockAuthService.callback.mockRejectedValue(new Error("OAuth error"));

			const req = createMockRequest({
				url: "/auth/callback?code=abc&state=xyz",
				cookies: { auth_platform: "mobile" },
			});
			const res = createMockResponse();

			await controller.callback(req, res);

			expect(res.redirect).toHaveBeenCalledWith(
				"opnshelf://auth/complete?error=callback_failed",
			);
		});

		it("keeps an integration disabled when connecting it is declined", async () => {
			const error = Object.assign(new Error("Permission declined"), {
				state: "permission-state",
				params: new URLSearchParams("error=access_denied"),
			});
			mockAuthService.callback.mockRejectedValue(error);
			mockAuthService.parseOAuthAppState.mockReturnValue({
				accountDid: "did:plc:abc123",
				permissionChange: "blog",
				requestedPreferences: {
					blogEnabled: true,
					blueskyEnabled: false,
				},
			});
			const res = createMockResponse();

			await controller.callback(createMockRequest(), res);

			expect(mockAuthService.disableIntegration).toHaveBeenCalledWith(
				"did:plc:abc123",
				"blog",
			);
			expect(res.redirect).toHaveBeenCalledWith(
				"http://127.0.0.1:3000/login?error=permission_declined",
			);
		});

		it("keeps an integration enabled when disconnecting it is declined", async () => {
			const error = Object.assign(new Error("Permission declined"), {
				state: "permission-state",
				params: new URLSearchParams("error=access_denied"),
			});
			mockAuthService.callback.mockRejectedValue(error);
			mockAuthService.parseOAuthAppState.mockReturnValue({
				accountDid: "did:plc:abc123",
				permissionChange: "blog",
				requestedPreferences: {
					blogEnabled: false,
					blueskyEnabled: true,
				},
			});

			await controller.callback(createMockRequest(), createMockResponse());

			expect(mockAuthService.disableIntegration).not.toHaveBeenCalled();
		});

		it("rejects a callback missing any required Core permission before profile work", async () => {
			const mockSession = { did: "did:plc:partial", scope: "atproto" };
			mockAuthService.callback.mockResolvedValue({
				session: mockSession,
				state: '{"requestedPreferences":{}}',
				sessionId: "partial-session",
			});
			mockAuthService.parseOAuthAppState.mockReturnValue({
				requestedPreferences: {},
			});
			mockAuthService.assertGrantedScopes.mockImplementationOnce(() => {
				throw new Error("missing Core permission");
			});
			const res = createMockResponse();

			await controller.callback(
				createMockRequest({ url: "/auth/callback?code=partial&state=xyz" }),
				res,
			);

			expect(mockAuthService.revokeBySessionId).toHaveBeenCalledWith(
				"partial-session",
			);
			expect(mockAuthService.fetchProfile).not.toHaveBeenCalled();
			expect(mockAuthService.upsertUser).not.toHaveBeenCalled();
			expect(res.redirect).toHaveBeenCalledWith(
				"http://127.0.0.1:3000/login?error=callback_failed",
			);
		});

		it("preserves native account identity on its first scoped callback", async () => {
			const mockSession = { did: "did:plc:native" };
			const mockProfile = {
				did: "did:plc:native",
				handle: "native.opnshelf.social",
				displayName: null,
				avatar: null,
			};
			mockAuthService.callback.mockResolvedValue({
				session: mockSession,
				sessionId: "native-oauth-session",
			});
			mockAuthService.fetchProfile.mockResolvedValue(mockProfile);
			mockAuthService.getUser.mockResolvedValue({
				did: "did:plc:native",
				isNativePds: true,
				emailVerifiedAt: new Date(),
				profileUri: null,
			});
			mockAuthService.upsertUser.mockResolvedValue({ isNewUser: false });

			await controller.callback(
				createMockRequest({ url: "/auth/callback?code=native&state=xyz" }),
				createMockResponse(),
			);

			expect(mockAuthService.upsertUser).toHaveBeenCalledWith(
				mockProfile,
				undefined,
				{ emailVerified: true, isNativePds: true },
			);
			expect(mockUsersService.initializeProfileForNewUser).toHaveBeenCalled();
		});
	});

	describe("getCookieDomain (via callback)", () => {
		it("should not set domain in development", async () => {
			const mockSession = { did: "did:plc:abc123" };
			const mockProfile = {
				did: "did:plc:abc123",
				handle: "user.bsky.social",
				displayName: null,
				avatar: null,
			};
			mockAuthService.callback.mockResolvedValue({
				session: mockSession,
				sessionId: "session-123",
			});
			mockAuthService.fetchProfile.mockResolvedValue(mockProfile);
			mockAuthService.upsertUser.mockResolvedValue(mockProfile);

			const req = createMockRequest({ url: "/auth/callback?code=abc" });
			const res = createMockResponse();

			await controller.callback(req, res);

			expect(mockAuthService.upsertUser).toHaveBeenCalledWith(
				mockProfile,
				undefined,
				{ emailVerified: true, isNativePds: false },
			);
			// The session cookie is host-only in every environment.
			expect(res.cookie).toHaveBeenCalledWith(
				"opnshelf_session",
				"session-123",
				expect.not.objectContaining({ domain: expect.any(String) }),
			);
		});

		it("should keep the session cookie host-only in production", async () => {
			// Override to production config
			mockConfigService.get.mockImplementation((key: string) => {
				const config: Record<string, string> = {
					FRONTEND_URL: "https://opnshelf.xyz",
					NODE_ENV: "production",
				};
				return config[key];
			});

			const mockSession = { did: "did:plc:abc123" };
			const mockProfile = {
				did: "did:plc:abc123",
				handle: "user.bsky.social",
				displayName: null,
				avatar: null,
			};
			mockAuthService.callback.mockResolvedValue({
				session: mockSession,
				sessionId: "session-123",
			});
			mockAuthService.fetchProfile.mockResolvedValue(mockProfile);
			mockAuthService.upsertUser.mockResolvedValue(mockProfile);

			const req = createMockRequest({ url: "/auth/callback?code=abc" });
			const res = createMockResponse();

			await controller.callback(req, res);

			expect(mockAuthService.upsertUser).toHaveBeenCalledWith(
				mockProfile,
				undefined,
				{ emailVerified: true, isNativePds: false },
			);
			expect(res.cookie).toHaveBeenCalledWith(
				"opnshelf_session",
				"session-123",
				expect.objectContaining({
					secure: true,
				}),
			);
			expect(res.cookie).toHaveBeenCalledWith(
				"opnshelf_session",
				"session-123",
				expect.not.objectContaining({ domain: expect.any(String) }),
			);
		});
	});
});
