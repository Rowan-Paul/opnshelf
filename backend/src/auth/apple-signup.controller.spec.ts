import { UnauthorizedException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
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
import { NativeSsoDto } from "./dto/native-sso.dto";
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
			// The real shape: pdsSsoPost rejects with a plain object, not an Error,
			// so String(error) would be "[object Object]" and the check would miss.
			mockNativeAccounts.startSsoRegistration.mockRejectedValue({
				status: 400,
				error: "InvalidRequest",
				message:
					"This account is already linked to an existing user. Please sign in instead.",
			});
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
	describe("native sign-in", () => {
		it("hands a new user's pending registration back to the app", async () => {
			mockNativeAccounts.startSsoRegistration.mockResolvedValue({
				token: "pending-token",
				email: "user@privaterelay.appleid.com",
				emailVerified: true,
				providerUsername: null,
				redirectUrl: null,
			});

			const result = await controller.appleNative({
				identityToken: "native-identity-token",
			});

			expect(mockNativeAccounts.startSsoRegistration).toHaveBeenCalledWith(
				"native-identity-token",
				"urn:ietf:params:oauth:request_uri:abc",
				"apple",
			);
			// A native client has no cookie jar, so the token travels in the body.
			expect(result).toEqual({
				pendingToken: "pending-token",
				email: "user@privaterelay.appleid.com",
			});
		});

		it("never exchanges a code: the OS already did", async () => {
			mockNativeAccounts.startSsoRegistration.mockResolvedValue({
				token: "pending-token",
				email: "user@privaterelay.appleid.com",
				emailVerified: true,
				providerUsername: null,
				redirectUrl: null,
			});

			await controller.appleNative({ identityToken: "native-identity-token" });

			expect(mockAppleOAuth.exchangeCode).not.toHaveBeenCalled();
		});

		it("sends a returning user to the PDS to finish authorizing", async () => {
			mockNativeAccounts.startSsoRegistration.mockResolvedValue({
				token: null,
				email: "user@privaterelay.appleid.com",
				emailVerified: true,
				providerUsername: null,
				redirectUrl: "https://pds.test/app/oauth/consent?request_uri=abc",
			});

			const result = await controller.appleNative({
				identityToken: "native-identity-token",
			});

			expect(result).toEqual({
				redirectUrl: "https://pds.test/app/oauth/consent?request_uri=abc",
			});
			expect(result.pendingToken).toBeUndefined();
		});

		it("turns an already-linked identity into a sign-in with a provider hint", async () => {
			// The real shape: pdsSsoPost rejects with a plain object, not an Error,
			// so String(error) would be "[object Object]" and the check would miss.
			mockNativeAccounts.startSsoRegistration.mockRejectedValue({
				status: 400,
				error: "InvalidRequest",
				message:
					"This account is already linked to an existing user. Please sign in instead.",
			});

			const result = await controller.appleNative({
				identityToken: "native-identity-token",
			});

			expect(
				new URL(result.redirectUrl as string).searchParams.get("sso"),
			).toBe("apple");
		});

		it("rejects a credential the PDS will not verify", async () => {
			mockNativeAccounts.startSsoRegistration.mockRejectedValue({
				status: 400,
				error: "InvalidRequest",
				message: "id_token verification failed",
			});

			await expect(
				controller.appleNative({ identityToken: "forged" }),
			).rejects.toThrow(/could not be verified/);
		});

		it("refuses an unverified email before anything is created", async () => {
			mockNativeAccounts.startSsoRegistration.mockResolvedValue({
				token: "pending-token",
				email: "user@example.com",
				emailVerified: false,
				providerUsername: null,
				redirectUrl: null,
			});

			await expect(
				controller.appleNative({ identityToken: "native-identity-token" }),
			).rejects.toThrow(/verified/);
		});

		it("accepts the pending token from the body when there is no cookie", async () => {
			mockNativeAccounts.completeSsoRegistration.mockResolvedValue({
				did: "did:plc:abc",
				handle: "rowan.opnshelf.social",
				redirectUrl: CORE_OAUTH_URL,
				accessJwt: null,
				refreshJwt: null,
			});

			const result = await controller.appleRegister(
				{
					username: "rowan",
					captchaToken: "captcha",
					timezone: "Europe/Amsterdam",
					pendingToken: "pending-from-app",
				},
				createMockRequest({ ip: "3.3.3.5" }),
				createMockResponse(),
			);

			expect(mockNativeAccounts.completeSsoRegistration).toHaveBeenCalledWith(
				expect.objectContaining({ token: "pending-from-app" }),
			);
			expect(result.handle).toBe("rowan.opnshelf.social");
		});

		it("prefers the cookie over a body token when both are present", async () => {
			mockNativeAccounts.completeSsoRegistration.mockResolvedValue({
				did: "did:plc:abc",
				handle: "rowan.opnshelf.social",
				redirectUrl: CORE_OAUTH_URL,
				accessJwt: null,
				refreshJwt: null,
			});

			await controller.appleRegister(
				{
					username: "rowan",
					captchaToken: "captcha",
					timezone: "Europe/Amsterdam",
					pendingToken: "pending-from-app",
				},
				createMockRequest({
					ip: "3.3.3.6",
					cookies: { apple_pending: "pending-from-cookie" },
				}),
				createMockResponse(),
			);

			expect(mockNativeAccounts.completeSsoRegistration).toHaveBeenCalledWith(
				expect.objectContaining({ token: "pending-from-cookie" }),
			);
		});
	});
	describe("carrying the mobile handoff through the browser leg", () => {
		const CHALLENGE = "a".repeat(43);

		it("replays platform and challenge into the atproto leg", async () => {
			const res = createMockResponse();
			controller.appleStart(res, "mobile", CHALLENGE);
			const state = mockAppleOAuth.buildAuthUrl.mock.calls[0][0] as string;

			mockNativeAccounts.startSsoRegistration.mockResolvedValue({
				token: null,
				email: "user@privaterelay.appleid.com",
				emailVerified: true,
				providerUsername: null,
				redirectUrl: "https://pds.test/app/oauth/consent?request_uri=abc",
			});

			await controller.appleCallback(
				{ code: "apple-code", state },
				createMockResponse(),
			);

			// Without this the Android app never gets a handoff code back and the
			// user is stranded on a web page.
			expect(mockAuthService.authorizeWithPds).toHaveBeenCalledWith({
				platform: "mobile",
				codeChallenge: CHALLENGE,
			});
		});

		it("carries nothing for a web flow", async () => {
			const res = createMockResponse();
			controller.appleStart(res);
			const state = mockAppleOAuth.buildAuthUrl.mock.calls[0][0] as string;

			mockNativeAccounts.startSsoRegistration.mockResolvedValue({
				token: null,
				email: "user@privaterelay.appleid.com",
				emailVerified: true,
				providerUsername: null,
				redirectUrl: "https://pds.test/app/oauth/consent?request_uri=abc",
			});

			await controller.appleCallback(
				{ code: "apple-code", state },
				createMockResponse(),
			);

			expect(mockAuthService.authorizeWithPds).toHaveBeenCalledWith(undefined);
		});

		it("ignores a malformed challenge rather than carrying it", () => {
			const res = createMockResponse();
			controller.appleStart(res, "mobile", "too-short");
			const state = mockAppleOAuth.buildAuthUrl.mock.calls[0][0] as string;
			const payload = JSON.parse(
				Buffer.from(state.split(".")[0], "base64url").toString("utf8"),
			);
			expect(payload.codeChallenge).toBeUndefined();
			expect(payload.platform).toBe("mobile");
		});
	});
	describe("without a configured state secret", () => {
		/** Build a controller whose config lacks PROVIDER_STATE_SECRET. */
		const controllerWithEnv = async (nodeEnv: string) => {
			const module = await Test.createTestingModule({
				controllers: [AppleSignupController],
				providers: [
					SignupRateLimiter,
					{ provide: AuthService, useValue: mockAuthService },
					{ provide: NativeAccountService, useValue: mockNativeAccounts },
					{
						provide: ConfigService,
						useValue: {
							get: (key: string) =>
								({
									FRONTEND_URL: "http://127.0.0.1:3000",
									NODE_ENV: nodeEnv,
									PDS_HANDLE_DOMAIN: "opnshelf.social",
								})[key],
						},
					},
					{ provide: TranquilAdminService, useValue: mockTranquilAdmin },
					{ provide: CaptchaService, useValue: mockCaptcha },
					{ provide: AppleOAuthService, useValue: mockAppleOAuth },
				],
			}).compile();
			return module.get<AppleSignupController>(AppleSignupController);
		};

		it("refuses the browser flow in production", async () => {
			const prod = await controllerWithEnv("production");
			const res = createMockResponse();
			prod.appleStart(res);

			// A per-process key would break every signup in flight on each deploy,
			// silently and only for Apple.
			expect(res.redirect).toHaveBeenCalledWith(
				"http://127.0.0.1:3000/signup?error=apple_unavailable",
			);
			expect(mockAppleOAuth.buildAuthUrl).not.toHaveBeenCalled();
		});

		it("still allows it in development", async () => {
			const dev = await controllerWithEnv("development");
			const res = createMockResponse();
			dev.appleStart(res);
			expect(mockAppleOAuth.buildAuthUrl).toHaveBeenCalledTimes(1);
		});

		it("leaves the native path working in production, which needs no state", async () => {
			const prod = await controllerWithEnv("production");
			mockNativeAccounts.startSsoRegistration.mockResolvedValue({
				token: "pending-token",
				email: "user@privaterelay.appleid.com",
				emailVerified: true,
				providerUsername: null,
				redirectUrl: null,
			});

			const result = await prod.appleNative({ identityToken: "native-token" });
			expect(result.pendingToken).toBe("pending-token");
		});
	});
	describe("the native flow's return path", () => {
		const CHALLENGE = "b".repeat(43);

		beforeEach(() => {
			mockNativeAccounts.startSsoRegistration.mockResolvedValue({
				token: "pending-token",
				email: "user@privaterelay.appleid.com",
				emailVerified: true,
				providerUsername: null,
				redirectUrl: null,
			});
		});

		it("carries platform and challenge into the OAuth request", async () => {
			await controller.appleNative({
				identityToken: "native-token",
				platform: "mobile",
				codeChallenge: CHALLENGE,
			});

			// Without these the consent callback reads the flow as web and sends
			// the user to the site, leaving a live account and no session.
			expect(mockAuthService.authorizeWithPds).toHaveBeenCalledWith({
				platform: "mobile",
				codeChallenge: CHALLENGE,
			});
		});

		it("still binds the platform when no challenge is supplied", async () => {
			await controller.appleNative({
				identityToken: "native-token",
				platform: "mobile",
			});

			expect(mockAuthService.authorizeWithPds).toHaveBeenCalledWith({
				platform: "mobile",
				codeChallenge: undefined,
			});
		});

		// The handler never sees a malformed challenge: the global ValidationPipe
		// rejects it against @Matches(BASE64URL_32_BYTES) first, as it does for
		// every other route that accepts one.
		it("rejects a malformed challenge at the request boundary", async () => {
			const errors = await validate(
				plainToInstance(NativeSsoDto, {
					identityToken: "native-token",
					platform: "mobile",
					codeChallenge: "too-short",
				}),
			);

			expect(errors.map((e) => e.property)).toContain("codeChallenge");
		});

		it("accepts a well-formed challenge at the request boundary", async () => {
			const errors = await validate(
				plainToInstance(NativeSsoDto, {
					identityToken: "native-token",
					platform: "mobile",
					codeChallenge: CHALLENGE,
				}),
			);

			expect(errors).toHaveLength(0);
		});

		it("carries nothing for a caller that is not the app", async () => {
			await controller.appleNative({ identityToken: "native-token" });
			expect(mockAuthService.authorizeWithPds).toHaveBeenCalledWith(undefined);
		});
	});
});
