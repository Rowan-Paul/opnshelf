import type { Mock, Mocked } from "vitest";
import { BadRequestException, HttpException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Response } from "express";

// Mock PrismaService before importing AuthController/AuthService
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
import { CaptchaService } from "../pds/captcha.service";
import { GoogleOAuthService } from "../pds/google-oauth.service";
import { TranquilAdminService } from "../pds/tranquil-admin.service";
import { UsersService } from "../users/users.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

describe("AuthController", () => {
	let controller: AuthController;

	const mockAuthService: {
		getClientMetadata: Mock;
		authorize: Mock;
		authorizePermissionChange: Mock;
		authorizeWithPds: Mock;
		callback: Mock;
		parseOAuthAppState: Mock;
		fetchProfile: Mock;
		upsertUser: Mock;
		getUser: Mock;
		hasBlueskyProfile: Mock;
		assertGrantedScopes: Mock;
		completePermissionChange: Mock;
		disableIntegration: Mock;
		revokeBySessionId: Mock;
		registerAccount: Mock;
		createCredentialSession: Mock;
		restore: Mock;
		confirmEmailWithCode: Mock;
		resendEmailConfirmation: Mock;
		markEmailVerified: Mock;
		startSsoRegistration: Mock;
		completeSsoRegistration: Mock;
	} = {
		getClientMetadata: vi.fn(),
		authorize: vi.fn(),
		authorizePermissionChange: vi.fn(),
		authorizeWithPds: vi.fn(),
		callback: vi.fn(),
		parseOAuthAppState: vi.fn().mockReturnValue({}),
		fetchProfile: vi.fn(),
		upsertUser: vi.fn(),
		getUser: vi.fn(),
		hasBlueskyProfile: vi.fn().mockResolvedValue(false),
		assertGrantedScopes: vi.fn(),
		completePermissionChange: vi.fn().mockResolvedValue(undefined),
		disableIntegration: vi.fn().mockResolvedValue(undefined),
		revokeBySessionId: vi.fn(),
		registerAccount: vi.fn(),
		createCredentialSession: vi.fn().mockResolvedValue("session-123"),
		restore: vi.fn().mockResolvedValue(undefined),
		confirmEmailWithCode: vi.fn().mockResolvedValue(true),
		resendEmailConfirmation: vi.fn().mockResolvedValue(undefined),
		markEmailVerified: vi.fn().mockResolvedValue(undefined),
		startSsoRegistration: vi.fn(),
		completeSsoRegistration: vi.fn(),
	};

	const mockIngesterService = {
		addRepo: vi.fn().mockResolvedValue(undefined),
	};

	const mockUsersService = {
		initializeProfileForNewUser: vi.fn().mockResolvedValue(undefined),
	};

	const mockTranquilAdmin = {
		mintInviteCode: vi.fn().mockResolvedValue("invite-code"),
		disableInviteCodes: vi.fn().mockResolvedValue(undefined),
	};

	const mockCaptcha = {
		verify: vi.fn().mockResolvedValue(true),
	};

	const mockGoogleOAuth = {
		configured: true,
		buildAuthUrl: vi.fn().mockReturnValue("https://accounts.google.com/o/auth"),
		exchangeCode: vi.fn().mockResolvedValue("id-token"),
	};

	const mockConfigService = {
		get: vi.fn((key: string) => {
			const config: Record<string, string> = {
				FRONTEND_URL: "http://127.0.0.1:3000",
				NODE_ENV: "test",
				PDS_HANDLE_DOMAIN: "opnshelf.xyz",
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
		mockAuthService.parseOAuthAppState.mockReturnValue({});
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
				{ provide: TranquilAdminService, useValue: mockTranquilAdmin },
				{ provide: CaptchaService, useValue: mockCaptcha },
				{ provide: GoogleOAuthService, useValue: mockGoogleOAuth },
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

			await controller.login("user.bsky.social", undefined, undefined, res);

			expect(mockAuthService.authorize).toHaveBeenCalledWith(
				"user.bsky.social",
				{
					platform: undefined,
					timezone: undefined,
				},
			);
			expect(res.redirect).toHaveBeenCalledWith(authUrl);
		});

		it("should redirect with error when handle is not provided", async () => {
			const res = createMockResponse();

			await controller.login(undefined, undefined, undefined, res);

			expect(mockAuthService.authorize).not.toHaveBeenCalled();
			expect(res.redirect).toHaveBeenCalledWith(
				"http://127.0.0.1:3000/login?error=handle_required",
			);
		});

		it("should redirect to mobile login when handle is not provided on mobile", async () => {
			const res = createMockResponse();

			await controller.login(undefined, "mobile", undefined, res);

			expect(mockAuthService.authorize).not.toHaveBeenCalled();
			expect(res.redirect).toHaveBeenCalledWith(
				"opnshelf://auth/complete?error=handle_required",
			);
		});

		it("should set platform cookie when platform=mobile", async () => {
			const authUrl = "https://bsky.social/oauth/authorize?state=abc";
			mockAuthService.authorize.mockResolvedValue(authUrl);
			const res = createMockResponse();

			await controller.login("user.bsky.social", "mobile", undefined, res);

			expect(mockAuthService.authorize).toHaveBeenCalledWith(
				"user.bsky.social",
				{
					platform: "mobile",
					timezone: undefined,
				},
			);
			expect(res.cookie).toHaveBeenCalledWith("auth_platform", "mobile", {
				httpOnly: true,
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
					maxAge: 5 * 60 * 1000,
					sameSite: "lax",
				},
			);
			expect(res.redirect).toHaveBeenCalledWith(authUrl);
		});

		it("should redirect to frontend with error on failure", async () => {
			mockAuthService.authorize.mockRejectedValue(new Error("OAuth error"));
			const res = createMockResponse();

			await controller.login("user.bsky.social", undefined, undefined, res);

			expect(res.redirect).toHaveBeenCalledWith(
				"http://127.0.0.1:3000/login?error=auth_failed",
			);
		});

		it("should redirect to mobile login on failure when platform is mobile", async () => {
			mockAuthService.authorize.mockRejectedValue(new Error("OAuth error"));
			const res = createMockResponse();

			await controller.login("user.bsky.social", "mobile", undefined, res);

			expect(res.redirect).toHaveBeenCalledWith(
				"opnshelf://auth/complete?error=auth_failed",
			);
		});
	});

	describe("signup", () => {
		it("should redirect to frontend with error on signup failure", async () => {
			mockAuthService.authorizeWithPds.mockRejectedValue(
				new Error("OAuth error"),
			);
			const res = createMockResponse();

			await controller.signup(undefined, undefined, res);

			expect(res.redirect).toHaveBeenCalledWith(
				"http://127.0.0.1:3000/login?error=auth_failed",
			);
		});

		it("should redirect to mobile login on signup failure when platform is mobile", async () => {
			mockAuthService.authorizeWithPds.mockRejectedValue(
				new Error("OAuth error"),
			);
			const res = createMockResponse();

			await controller.signup("mobile", undefined, res);

			expect(res.redirect).toHaveBeenCalledWith(
				"opnshelf://auth/complete?error=auth_failed",
			);
		});
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
				handle: "native.opnshelf.xyz",
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

	describe("permissions", () => {
		it("returns an authorization URL for an authenticated Blog connection", async () => {
			mockAuthService.getUser.mockResolvedValue({
				did: "did:plc:abc123",
				handle: "reader.example",
				reviewsPublicationUri:
					"at://did:plc:abc123/site.standard.publication/main",
				reviewsMirrorFormat: "leaflet",
				blogIntegrationEnabled: false,
				blueskyCrossPostEnabled: false,
			});
			mockAuthService.authorizePermissionChange.mockResolvedValue(
				"https://pds.example/authorize?request=blog",
			);
			const req = createMockRequest({
				user: { did: "did:plc:abc123", session: { did: "did:plc:abc123" } },
			} as unknown as import("express").Request) as unknown as import("../auth/types").AuthenticatedRequest;

			const result = await controller.permissions(req, {
				integration: "blog",
				action: "connect",
			});

			expect(result).toEqual({
				authorizationUrl: "https://pds.example/authorize?request=blog",
			});
			expect(mockAuthService.authorizePermissionChange).toHaveBeenCalledWith(
				"reader.example",
				"blog",
				{
					blogEnabled: true,
					blueskyEnabled: false,
					reviewsMirrorFormat: "leaflet",
				},
			);
		});

		it("requests the one-time AT Store bundle with mobile resume state", async () => {
			mockAuthService.getUser.mockResolvedValue({
				did: "did:plc:abc123",
				handle: "reader.example",
				reviewsMirrorFormat: "markdown",
				blogIntegrationEnabled: false,
				blueskyCrossPostEnabled: false,
			});
			mockAuthService.authorizePermissionChange.mockResolvedValue(
				"https://pds.example/authorize?request=atstore",
			);
			const req = createMockRequest({
				user: { did: "did:plc:abc123", session: { did: "did:plc:abc123" } },
			} as unknown as import("express").Request) as unknown as import("../auth/types").AuthenticatedRequest;

			await controller.permissions(req, {
				integration: "atstore",
				action: "connect",
				platform: "mobile",
			});

			expect(mockAuthService.authorizePermissionChange).toHaveBeenCalledWith(
				"reader.example",
				"atstore",
				{
					atStoreReviewEnabled: true,
					blogEnabled: false,
					blueskyEnabled: false,
					reviewsMirrorFormat: "markdown",
				},
				{ platform: "mobile" },
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
				handle: "jane.opnshelf.xyz",
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

		it("should throw BadRequestException when user not found in DB", async () => {
			mockAuthService.getUser.mockResolvedValue(null);

			const req = createMockRequest({
				user: { did: "did:plc:abc123", session: {} },
			} as unknown as import("express").Request);

			await expect(
				controller.me(
					req as unknown as import("../auth/types").AuthenticatedRequest,
				),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe("verifyEmail", () => {
		const reqFor = (did = "did:plc:abc123") =>
			createMockRequest({
				user: { did, session: {} },
			} as unknown as import("express").Request) as unknown as import("../auth/types").AuthenticatedRequest;

		it("confirms the code, revokes bootstrap credentials, and starts Core OAuth", async () => {
			mockAuthService.getUser.mockResolvedValue({
				did: "did:plc:abc123",
				handle: "jane.opnshelf.xyz",
				displayName: null,
				emailVerifiedAt: null,
			});

			const result = await controller.verifyEmail(reqFor(), { code: " abc " });

			expect(result).toEqual({
				verified: true,
				coreOAuthUrl: "https://pds.example/authorize",
			});
			// Verify reuses the guard's already-restored session (req.user.session),
			// it does NOT restore again — that double-restore is the logout bug.
			expect(mockAuthService.restore).not.toHaveBeenCalled();
			expect(mockAuthService.confirmEmailWithCode).toHaveBeenCalledWith(
				{},
				" abc ",
			);
			expect(mockAuthService.markEmailVerified).toHaveBeenCalledWith(
				"did:plc:abc123",
			);
			expect(mockAuthService.authorize).toHaveBeenCalledWith(
				"jane.opnshelf.xyz",
			);
			expect(mockAuthService.revokeBySessionId).not.toHaveBeenCalled();
		});

		it("still hands an already verified native account into Core OAuth", async () => {
			mockAuthService.getUser.mockResolvedValue({
				did: "did:plc:abc123",
				handle: "jane.opnshelf.xyz",
				displayName: null,
				emailVerifiedAt: new Date(),
			});

			await controller.verifyEmail(reqFor(), { code: "abc" });

			expect(mockAuthService.confirmEmailWithCode).toHaveBeenCalled();
			expect(mockAuthService.authorize).toHaveBeenCalledWith(
				"jane.opnshelf.xyz",
			);
		});

		it("maps an invalid code to BadRequestException and does not start OAuth", async () => {
			mockAuthService.getUser.mockResolvedValue({
				did: "did:plc:abc123",
				handle: "jane.opnshelf.xyz",
				displayName: null,
				emailVerifiedAt: null,
			});
			mockAuthService.confirmEmailWithCode.mockRejectedValueOnce({
				error: "InvalidToken",
			});

			await expect(
				controller.verifyEmail(reqFor(), { code: "nope" }),
			).rejects.toThrow(BadRequestException);
			expect(mockAuthService.markEmailVerified).not.toHaveBeenCalled();
			expect(mockAuthService.authorize).not.toHaveBeenCalled();
		});

		it("does not seed with the credential session", async () => {
			mockAuthService.getUser.mockResolvedValue({
				did: "did:plc:abc123",
				handle: "jane.opnshelf.xyz",
				displayName: null,
				emailVerifiedAt: null,
			});
			const result = await controller.verifyEmail(reqFor(), { code: "abc" });

			expect(result).toEqual({
				verified: true,
				coreOAuthUrl: "https://pds.example/authorize",
			});
			expect(mockAuthService.markEmailVerified).toHaveBeenCalled();
		});

		it("revokes the exact Bearer bootstrap after creating the Core authorization", async () => {
			mockAuthService.getUser.mockResolvedValue({
				did: "did:plc:abc123",
				handle: "jane.opnshelf.xyz",
				emailVerifiedAt: null,
			});
			const req = createMockRequest({
				headers: { authorization: "Bearer native-bootstrap" },
				user: { did: "did:plc:abc123", session: {} },
			} as unknown as import("express").Request) as unknown as import("../auth/types").AuthenticatedRequest;

			await controller.verifyEmail(req, { code: "abc" });

			expect(mockAuthService.authorize).toHaveBeenCalled();
			expect(mockAuthService.revokeBySessionId).toHaveBeenCalledWith(
				"native-bootstrap",
			);
			expect(
				mockAuthService.authorize.mock.invocationCallOrder[0],
			).toBeLessThan(
				mockAuthService.revokeBySessionId.mock.invocationCallOrder[0],
			);
		});

		it("retains the bootstrap when Core authorization cannot be created", async () => {
			mockAuthService.getUser.mockResolvedValue({
				did: "did:plc:abc123",
				handle: "jane.opnshelf.xyz",
				emailVerifiedAt: null,
			});
			mockAuthService.authorize.mockRejectedValueOnce(
				new Error("authorization unavailable"),
			);
			const req = createMockRequest({
				cookies: { session: "native-cookie-bootstrap" },
				user: { did: "did:plc:abc123", session: {} },
			} as unknown as import("express").Request) as unknown as import("../auth/types").AuthenticatedRequest;

			await expect(
				controller.verifyEmail(req, { code: "abc" }),
			).rejects.toThrow("authorization unavailable");
			expect(mockAuthService.revokeBySessionId).not.toHaveBeenCalled();
		});
	});

	describe("resendVerification", () => {
		const reqFor = (did = "did:plc:abc123") =>
			createMockRequest({
				user: { did, session: {} },
			} as unknown as import("express").Request) as unknown as import("../auth/types").AuthenticatedRequest;

		it("asks the service to resend the verification email", async () => {
			const result = await controller.resendVerification(reqFor());

			expect(result).toEqual({ message: "Verification email sent" });
			expect(mockAuthService.resendEmailConfirmation).toHaveBeenCalledWith(
				"did:plc:abc123",
			);
		});

		it("rate-limits after too many attempts", async () => {
			const did = "did:plc:ratelimit";
			for (let i = 0; i < 5; i++) {
				await controller.resendVerification(reqFor(did));
			}
			await expect(controller.resendVerification(reqFor(did))).rejects.toThrow(
				HttpException,
			);
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

	describe("register", () => {
		const validBody = {
			username: "jane",
			email: "jane@example.com",
			password: "supersecret",
			captchaToken: "tok",
		};
		const account = {
			did: "did:plc:jane",
			handle: "jane.opnshelf.xyz",
			accessJwt: "a",
			refreshJwt: "r",
			pdsUrl: "https://opnshelf.xyz",
		};

		beforeEach(() => {
			// An earlier test overrides get() via mockImplementation, which
			// clearAllMocks() does not reset — restore the full config here.
			mockConfigService.get.mockImplementation((key: string) => {
				const config: Record<string, string> = {
					FRONTEND_URL: "http://127.0.0.1:3000",
					NODE_ENV: "test",
					PDS_HANDLE_DOMAIN: "opnshelf.xyz",
				};
				return config[key];
			});
			mockCaptcha.verify.mockResolvedValue(true);
			mockTranquilAdmin.mintInviteCode.mockResolvedValue("invite-code");
			mockAuthService.registerAccount.mockResolvedValue(account);
			mockAuthService.createCredentialSession.mockResolvedValue("sess-1");
		});

		const captureStatus = async (promise: Promise<unknown>) => {
			try {
				await promise;
				return undefined;
			} catch (error) {
				return (error as HttpException).getStatus();
			}
		};

		it("creates an account through the captcha + invite gate and sets a cookie", async () => {
			const req = createMockRequest({ ip: "1.2.3.4", headers: {} });
			const res = createMockResponse();

			const result = await controller.register(validBody, req, res);

			expect(mockCaptcha.verify).toHaveBeenCalled();
			expect(mockTranquilAdmin.mintInviteCode).toHaveBeenCalledWith(1);
			expect(mockAuthService.registerAccount).toHaveBeenCalledWith(
				expect.objectContaining({
					handle: "jane.opnshelf.xyz",
					email: "jane@example.com",
					inviteCode: "invite-code",
				}),
			);
			expect(mockAuthService.createCredentialSession).toHaveBeenCalled();
			expect(res.cookie).toHaveBeenCalledWith(
				"opnshelf_session",
				"sess-1",
				expect.objectContaining({ httpOnly: true }),
			);
			expect(result).toEqual({
				did: account.did,
				handle: account.handle,
				sessionId: "sess-1",
			});
		});

		it("rejects with 403 when the captcha fails", async () => {
			mockCaptcha.verify.mockResolvedValue(false);
			const req = createMockRequest({ ip: "1.2.3.5", headers: {} });
			const res = createMockResponse();

			expect(
				await captureStatus(controller.register(validBody, req, res)),
			).toBe(403);
			expect(mockTranquilAdmin.mintInviteCode).not.toHaveBeenCalled();
		});

		it("frees the unused invite code and maps a taken handle to 409", async () => {
			mockAuthService.registerAccount.mockRejectedValue(
				Object.assign(new Error("taken"), { error: "HandleNotAvailable" }),
			);
			const req = createMockRequest({ ip: "1.2.3.6", headers: {} });
			const res = createMockResponse();

			expect(
				await captureStatus(controller.register(validBody, req, res)),
			).toBe(409);
			expect(mockTranquilAdmin.disableInviteCodes).toHaveBeenCalledWith([
				"invite-code",
			]);
		});

		it("rate-limits repeated attempts from the same IP", async () => {
			const ip = "9.9.9.9";
			const res = createMockResponse();
			for (let i = 0; i < 5; i++) {
				await controller.register(
					validBody,
					createMockRequest({ ip, headers: {} }),
					res,
				);
			}

			expect(
				await captureStatus(
					controller.register(
						validBody,
						createMockRequest({ ip, headers: {} }),
						res,
					),
				),
			).toBe(429);
		});
	});

	describe("google signup", () => {
		const account = {
			did: "did:plc:jane",
			handle: "jane.opnshelf.xyz",
			redirectUrl:
				"https://opnshelf.social/app/oauth/consent?request_uri=urn%3Arequest",
			accessJwt: "a",
			refreshJwt: "r",
		};

		beforeEach(() => {
			mockConfigService.get.mockImplementation((key: string) => {
				const config: Record<string, string> = {
					FRONTEND_URL: "http://127.0.0.1:3000",
					NODE_ENV: "test",
					PDS_HANDLE_DOMAIN: "opnshelf.xyz",
				};
				return config[key];
			});
			mockCaptcha.verify.mockResolvedValue(true);
			mockGoogleOAuth.configured = true;
			mockGoogleOAuth.exchangeCode.mockResolvedValue("id-token");
			mockTranquilAdmin.mintInviteCode.mockResolvedValue("invite-code");
			mockAuthService.startSsoRegistration.mockResolvedValue({
				token: "pending-tok",
				email: "jane@gmail.com",
				emailVerified: true,
				providerUsername: "Jane Doe",
				redirectUrl: null,
			});
			mockAuthService.completeSsoRegistration.mockResolvedValue(account);
			mockAuthService.authorizeWithPds.mockResolvedValue(
				"https://opnshelf.social/oauth/authorize?request_uri=urn%3Arequest",
			);
		});

		const captureStatus = async (promise: Promise<unknown>) => {
			try {
				await promise;
				return undefined;
			} catch (error) {
				return (error as HttpException).getStatus();
			}
		};

		it("parks the pending token and sends the user to the handle picker", async () => {
			const req = createMockRequest({ cookies: { google_state: "st" } });
			const res = createMockResponse();

			await controller.googleCallback("code", "st", undefined, req, res);

			expect(mockAuthService.startSsoRegistration).toHaveBeenCalledWith(
				"id-token",
				"urn:request",
			);

			expect(res.cookie).toHaveBeenCalledWith(
				"google_pending",
				"pending-tok",
				expect.objectContaining({ httpOnly: true }),
			);
			expect(res.redirect).toHaveBeenCalledWith(
				"http://127.0.0.1:3000/signup/google?email=jane%40gmail.com&suggested=jane-doe",
			);
		});

		it("refuses a callback whose state doesn't match the cookie", async () => {
			const req = createMockRequest({ cookies: { google_state: "st" } });
			const res = createMockResponse();

			await controller.googleCallback("code", "other", undefined, req, res);

			expect(mockGoogleOAuth.exchangeCode).not.toHaveBeenCalled();
			expect(res.redirect).toHaveBeenCalledWith(
				"http://127.0.0.1:3000/signup?error=google_failed",
			);
		});

		it("stops before creating anything when Google hasn't verified the email", async () => {
			mockAuthService.startSsoRegistration.mockResolvedValue({
				token: "pending-tok",
				email: "jane@gmail.com",
				emailVerified: false,
				providerUsername: null,
				redirectUrl: null,
			});
			const req = createMockRequest({ cookies: { google_state: "st" } });
			const res = createMockResponse();

			await controller.googleCallback("code", "st", undefined, req, res);

			expect(res.redirect).toHaveBeenCalledWith(
				"http://127.0.0.1:3000/signup?error=google_email_unverified",
			);
		});

		it("signs a returning Google user in instead of erroring", async () => {
			mockAuthService.startSsoRegistration.mockResolvedValue({
				token: null,
				email: "jane@gmail.com",
				emailVerified: true,
				providerUsername: "Jane Doe",
				redirectUrl:
					"https://opnshelf.social/app/oauth/consent?request_uri=urn%3Arequest",
			});
			const req = createMockRequest({ cookies: { google_state: "st" } });
			const res = createMockResponse();

			await controller.googleCallback("code", "st", undefined, req, res);

			expect(res.redirect).toHaveBeenCalledWith(
				"https://opnshelf.social/app/oauth/consent?request_uri=urn%3Arequest",
			);
			// It must never park a pending registration for an account that exists.
			expect(res.cookie).not.toHaveBeenCalledWith(
				"google_pending",
				expect.anything(),
				expect.anything(),
			);
		});

		it("creates the account verified and hands into Core OAuth", async () => {
			const req = createMockRequest({
				ip: "2.2.2.1",
				headers: {},
				cookies: { google_pending: "pending-tok" },
			});
			const res = createMockResponse();

			const result = await controller.googleRegister(
				{ username: "Jane", captchaToken: "tok", timezone: "Europe/Amsterdam" },
				req,
				res,
			);

			// No email is sent: the PDS reuses the provider's, which is the only
			// value its auto-verify comparison accepts.
			expect(mockAuthService.completeSsoRegistration).toHaveBeenCalledWith({
				token: "pending-tok",
				handle: "jane.opnshelf.xyz",
				inviteCode: "invite-code",
			});
			expect(mockAuthService.upsertUser).toHaveBeenCalledWith(
				expect.objectContaining({ did: account.did }),
				"Europe/Amsterdam",
				{ isNativePds: true, emailVerified: true },
			);
			expect(result).toEqual({
				did: account.did,
				handle: account.handle,
				coreOAuthUrl: account.redirectUrl,
			});
			expect(res.cookie).toHaveBeenCalledWith(
				"auth_timezone",
				"Europe/Amsterdam",
				expect.objectContaining({ httpOnly: true }),
			);
		});

		it("rejects with 400 when there is no pending Google signup", async () => {
			const req = createMockRequest({
				ip: "2.2.2.2",
				headers: {},
				cookies: {},
			});
			const res = createMockResponse();

			expect(
				await captureStatus(
					controller.googleRegister(
						{ username: "jane", captchaToken: "tok" },
						req,
						res,
					),
				),
			).toBe(400);
			expect(mockTranquilAdmin.mintInviteCode).not.toHaveBeenCalled();
		});

		it("frees the unused invite code when the handle is taken", async () => {
			mockAuthService.completeSsoRegistration.mockRejectedValue(
				Object.assign(new Error("taken"), { error: "HandleNotAvailable" }),
			);
			const req = createMockRequest({
				ip: "2.2.2.3",
				headers: {},
				cookies: { google_pending: "pending-tok" },
			});
			const res = createMockResponse();

			expect(
				await captureStatus(
					controller.googleRegister(
						{ username: "jane", captchaToken: "tok" },
						req,
						res,
					),
				),
			).toBe(409);
			expect(mockTranquilAdmin.disableInviteCodes).toHaveBeenCalledWith([
				"invite-code",
			]);
			// The pending token survives so the user can retry another username.
			expect(res.clearCookie).not.toHaveBeenCalledWith(
				"google_pending",
				expect.anything(),
			);
		});
	});
});
