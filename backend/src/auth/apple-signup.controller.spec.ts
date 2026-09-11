import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Response } from "express";
import type { Mock, Mocked } from "vitest";

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

import { AppleOAuthService } from "../pds/apple-oauth.service";
import { CaptchaService } from "../pds/captcha.service";
import { TranquilAdminService } from "../pds/tranquil-admin.service";
import { AppleSignupController } from "./apple-signup.controller";
import { AuthService } from "./auth.service";
import { NativeAccountService } from "./native-account.service";
import { signProviderState } from "./provider-state";
import { SignupRateLimiter } from "./signup-rate-limiter";

const STATE_SECRET = "test-provider-state-secret";
const CORE_OAUTH_URL =
	"https://pds.test/oauth/authorize?request_uri=urn:ietf:params:oauth:request_uri:abc";

describe("AppleSignupController", () => {
	let controller: AppleSignupController;

	const mockAuthService: { authorizeWithPds: Mock; upsertUser: Mock } = {
		authorizeWithPds: vi.fn(),
		upsertUser: vi.fn(),
	};

	const mockNativeAccounts: {
		startSsoRegistration: Mock;
		completeSsoRegistration: Mock;
	} = {
		startSsoRegistration: vi.fn(),
		completeSsoRegistration: vi.fn(),
	};

	const mockTranquilAdmin = {
		mintInviteCode: vi.fn().mockResolvedValue("invite-code"),
		disableInviteCodes: vi.fn().mockResolvedValue(undefined),
	};

	const mockCaptcha = { verify: vi.fn().mockResolvedValue(true) };

	const mockAppleOAuth = {
		configured: true,
		buildAuthUrl: vi
			.fn()
			.mockReturnValue("https://appleid.apple.com/auth/authorize"),
		exchangeCode: vi.fn().mockResolvedValue("apple-id-token"),
	};

	const mockConfigService = {
		get: vi.fn((key: string) => {
			const config: Record<string, string> = {
				FRONTEND_URL: "http://127.0.0.1:3000",
				NODE_ENV: "test",
				PDS_HANDLE_DOMAIN: "opnshelf.social",
				PROVIDER_STATE_SECRET: STATE_SECRET,
			};
			return config[key];
		}),
	};

	const createMockResponse = () =>
		({
			redirect: vi.fn().mockReturnThis(),
			cookie: vi.fn().mockReturnThis(),
			clearCookie: vi.fn().mockReturnThis(),
			status: vi.fn().mockReturnThis(),
			json: vi.fn().mockReturnThis(),
			setHeader: vi.fn().mockReturnThis(),
		}) as unknown as Mocked<Response>;

	const createMockRequest = (
		overrides: Partial<import("express").Request> = {},
	) =>
		({
			url: "/auth/apple/callback",
			headers: {},
			cookies: {},
			...overrides,
		}) as unknown as import("express").Request;

	/** A state this controller instance would accept. */
	const validState = () => signProviderState(STATE_SECRET);

	beforeEach(async () => {
		vi.clearAllMocks();
		mockAppleOAuth.configured = true;
		mockTranquilAdmin.mintInviteCode.mockResolvedValue("invite-code");
		mockTranquilAdmin.disableInviteCodes.mockResolvedValue(undefined);
		mockCaptcha.verify.mockResolvedValue(true);
		mockAuthService.authorizeWithPds.mockResolvedValue(CORE_OAUTH_URL);

		const module: TestingModule = await Test.createTestingModule({
			controllers: [AppleSignupController],
			providers: [
				SignupRateLimiter,
				{ provide: AuthService, useValue: mockAuthService },
				{ provide: NativeAccountService, useValue: mockNativeAccounts },
				{ provide: ConfigService, useValue: mockConfigService },
				{ provide: TranquilAdminService, useValue: mockTranquilAdmin },
				{ provide: CaptchaService, useValue: mockCaptcha },
				{ provide: AppleOAuthService, useValue: mockAppleOAuth },
			],
		}).compile();

		controller = module.get<AppleSignupController>(AppleSignupController);
	});

	describe("starting the flow", () => {
		it("sends the user to Apple with a signed state", () => {
			const res = createMockResponse();
			controller.appleStart(res);

			expect(mockAppleOAuth.buildAuthUrl).toHaveBeenCalledTimes(1);
			const state = mockAppleOAuth.buildAuthUrl.mock.calls[0][0] as string;
			// Signed, not a bare uuid: Apple's cross-site POST drops the cookie a
			// bare value would have to be compared against.
			expect(state.split(".")).toHaveLength(2);
			expect(res.redirect).toHaveBeenCalledWith(
				"https://appleid.apple.com/auth/authorize",
			);
		});

		it("never sets a state cookie", () => {
			const res = createMockResponse();
			controller.appleStart(res);
			expect(res.cookie).not.toHaveBeenCalled();
		});

		it("sends the user back to the signup form when Apple is not configured", () => {
			mockAppleOAuth.configured = false;
			const res = createMockResponse();
			controller.appleStart(res);
			expect(res.redirect).toHaveBeenCalledWith(
				"http://127.0.0.1:3000/signup?error=apple_unavailable",
			);
			expect(mockAppleOAuth.buildAuthUrl).not.toHaveBeenCalled();
		});
	});

	describe("the form_post callback", () => {
		it("parks the pending token and sends the user to the handle picker", async () => {
			mockNativeAccounts.startSsoRegistration.mockResolvedValue({
				token: "pending-token",
				email: "user@privaterelay.appleid.com",
				emailVerified: true,
				providerUsername: null,
				redirectUrl: null,
			});
			const res = createMockResponse();

			await controller.appleCallback(
				{ code: "apple-code", state: validState() },
				res,
			);

			expect(mockNativeAccounts.startSsoRegistration).toHaveBeenCalledWith(
				"apple-id-token",
				"urn:ietf:params:oauth:request_uri:abc",
				"apple",
			);
			expect(res.cookie).toHaveBeenCalledWith(
				"apple_pending",
				"pending-token",
				expect.objectContaining({ httpOnly: true }),
			);
			// No ?suggested=: Apple never reports a username.
			expect(res.redirect).toHaveBeenCalledWith(
				"http://127.0.0.1:3000/signup/apple",
			);
		});

		it("refuses a callback whose state we did not sign", async () => {
			const res = createMockResponse();
			await controller.appleCallback(
				{
					code: "apple-code",
					state: signProviderState("someone-elses-secret"),
				},
				res,
			);

			expect(mockAppleOAuth.exchangeCode).not.toHaveBeenCalled();
			expect(res.redirect).toHaveBeenCalledWith(
				"http://127.0.0.1:3000/signup?error=apple_failed",
			);
		});

		it("refuses a callback with no state at all", async () => {
			const res = createMockResponse();
			await controller.appleCallback({ code: "apple-code" }, res);
			expect(mockAppleOAuth.exchangeCode).not.toHaveBeenCalled();
			expect(res.redirect).toHaveBeenCalledWith(
				"http://127.0.0.1:3000/signup?error=apple_failed",
			);
		});

		it("treats a cancelled authorization as a failed signup, not a crash", async () => {
			const res = createMockResponse();
			await controller.appleCallback(
				{ error: "user_cancelled_authorize", state: validState() },
				res,
			);
			expect(res.redirect).toHaveBeenCalledWith(
				"http://127.0.0.1:3000/signup?error=apple_failed",
			);
		});

		it("signs a returning Apple user in instead of erroring", async () => {
			mockNativeAccounts.startSsoRegistration.mockResolvedValue({
				token: null,
				email: "user@privaterelay.appleid.com",
				emailVerified: true,
				providerUsername: null,
				redirectUrl: "https://pds.test/app/oauth/consent?request_uri=abc",
			});
			const res = createMockResponse();

			await controller.appleCallback(
				{ code: "apple-code", state: validState() },
				res,
			);

			expect(res.redirect).toHaveBeenCalledWith(
				"https://pds.test/app/oauth/consent?request_uri=abc",
			);
			expect(res.cookie).not.toHaveBeenCalledWith(
				"apple_pending",
				expect.anything(),
				expect.anything(),
			);
		});

		it("hands an already-linked identity to the PDS with a provider hint", async () => {
			mockNativeAccounts.startSsoRegistration.mockRejectedValue(
				new Error("This account is already linked to an existing user."),
			);
			const res = createMockResponse();

			await controller.appleCallback(
				{ code: "apple-code", state: validState() },
				res,
			);

			const target = (res.redirect as Mock).mock.calls[0][0] as string;
			expect(new URL(target).searchParams.get("sso")).toBe("apple");
		});

		it("stops before creating anything when the email is unverified", async () => {
			mockNativeAccounts.startSsoRegistration.mockResolvedValue({
				token: "pending-token",
				email: "user@example.com",
				emailVerified: false,
				providerUsername: null,
				redirectUrl: null,
			});
			const res = createMockResponse();

			await controller.appleCallback(
				{ code: "apple-code", state: validState() },
				res,
			);

			expect(res.cookie).not.toHaveBeenCalled();
			expect(res.redirect).toHaveBeenCalledWith(
				"http://127.0.0.1:3000/signup?error=apple_email_unverified",
			);
		});
	});

	describe("the pending identity", () => {
		it("reports the email parked by the callback", async () => {
			mockNativeAccounts.startSsoRegistration.mockResolvedValue({
				token: "pending-token",
				email: "user@privaterelay.appleid.com",
				emailVerified: true,
				providerUsername: null,
				redirectUrl: null,
			});
			await controller.appleCallback(
				{ code: "apple-code", state: validState() },
				createMockResponse(),
			);

			const res = createMockResponse();
			const pending = controller.applePending(
				createMockRequest({ cookies: { apple_pending: "pending-token" } }),
				res,
			);

			expect(pending).toEqual({ email: "user@privaterelay.appleid.com" });
			expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
		});

		it("rejects when there is no pending Apple signup", () => {
			expect(() =>
				controller.applePending(createMockRequest(), createMockResponse()),
			).toThrow(UnauthorizedException);
		});
	});

	describe("finishing the signup", () => {
		const dto = {
			username: "rowan",
			captchaToken: "captcha",
			timezone: "Europe/Amsterdam",
		};

		it("creates the account verified and hands into Core OAuth", async () => {
			mockNativeAccounts.completeSsoRegistration.mockResolvedValue({
				did: "did:plc:abc",
				handle: "rowan.opnshelf.social",
				redirectUrl: CORE_OAUTH_URL,
				accessJwt: null,
				refreshJwt: null,
			});
			const res = createMockResponse();

			const result = await controller.appleRegister(
				dto,
				createMockRequest({
					ip: "3.3.3.1",
					cookies: { apple_pending: "pending-token" },
				}),
				res,
			);

			expect(result).toEqual({
				did: "did:plc:abc",
				handle: "rowan.opnshelf.social",
				coreOAuthUrl: CORE_OAUTH_URL,
			});
			// Apple verified the address, so the verify-email gate must not catch it.
			expect(mockAuthService.upsertUser).toHaveBeenCalledWith(
				expect.objectContaining({ did: "did:plc:abc" }),
				"Europe/Amsterdam",
				{ isNativePds: true, emailVerified: true },
			);
			expect(res.clearCookie).toHaveBeenCalledWith("apple_pending", {
				path: "/",
			});
		});

		it("rejects when there is no pending Apple signup", async () => {
			await expect(
				controller.appleRegister(
					dto,
					createMockRequest({ ip: "3.3.3.2" }),
					createMockResponse(),
				),
			).rejects.toThrow(/expired/);
		});

		it("frees the unused invite code when the handle is taken", async () => {
			mockNativeAccounts.completeSsoRegistration.mockRejectedValue(
				new Error("Handle already taken"),
			);
			const res = createMockResponse();

			await expect(
				controller.appleRegister(
					dto,
					createMockRequest({
						ip: "3.3.3.3",
						cookies: { apple_pending: "pending-token" },
					}),
					res,
				),
			).rejects.toThrow();

			expect(mockTranquilAdmin.disableInviteCodes).toHaveBeenCalledWith([
				"invite-code",
			]);
			// The pending cookie survives: retrying a username should not mean
			// another round trip through Apple.
			expect(res.clearCookie).not.toHaveBeenCalled();
		});

		it("refuses when the captcha does not pass", async () => {
			mockCaptcha.verify.mockResolvedValue(false);
			await expect(
				controller.appleRegister(
					dto,
					createMockRequest({
						ip: "3.3.3.4",
						cookies: { apple_pending: "pending-token" },
					}),
					createMockResponse(),
				),
			).rejects.toThrow(/Captcha/);
			expect(mockNativeAccounts.completeSsoRegistration).not.toHaveBeenCalled();
		});
	});
});
