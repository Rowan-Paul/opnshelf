import type { Mock, Mocked } from "vitest";
import type { HttpException } from "@nestjs/common";
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

import { CaptchaService } from "../pds/captcha.service";
import { GoogleOAuthService } from "../pds/google-oauth.service";
import { TranquilAdminService } from "../pds/tranquil-admin.service";
import { AuthService } from "./auth.service";
import { GoogleSignupController } from "./google-signup.controller";
import { NativeAccountService } from "./native-account.service";
import { SignupRateLimiter } from "./signup-rate-limiter";

describe("GoogleSignupController", () => {
	let controller: GoogleSignupController;

	const mockAuthService: {
		authorizeWithPds: Mock;
		upsertUser: Mock;
	} = {
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
			url: "/auth/google/callback",
			cookies: {},
			...overrides,
		} as unknown as import("express").Request;
	};

	beforeEach(async () => {
		vi.clearAllMocks();
		mockTranquilAdmin.disableInviteCodes.mockResolvedValue(undefined);

		const module: TestingModule = await Test.createTestingModule({
			controllers: [GoogleSignupController],
			providers: [
				SignupRateLimiter,
				{ provide: AuthService, useValue: mockAuthService },
				{ provide: NativeAccountService, useValue: mockNativeAccounts },
				{ provide: ConfigService, useValue: mockConfigService },
				{ provide: TranquilAdminService, useValue: mockTranquilAdmin },
				{ provide: CaptchaService, useValue: mockCaptcha },
				{ provide: GoogleOAuthService, useValue: mockGoogleOAuth },
			],
		}).compile();

		controller = module.get<GoogleSignupController>(GoogleSignupController);
	});

	describe("google signup", () => {
		const account = {
			did: "did:plc:jane",
			handle: "jane.opnshelf.social",
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
					PDS_HANDLE_DOMAIN: "opnshelf.social",
				};
				return config[key];
			});
			mockCaptcha.verify.mockResolvedValue(true);
			mockGoogleOAuth.configured = true;
			mockGoogleOAuth.exchangeCode.mockResolvedValue("id-token");
			mockTranquilAdmin.mintInviteCode.mockResolvedValue("invite-code");
			mockNativeAccounts.startSsoRegistration.mockResolvedValue({
				token: "pending-tok",
				email: "jane@gmail.com",
				emailVerified: true,
				providerUsername: "Jane Doe",
				redirectUrl: null,
			});
			mockNativeAccounts.completeSsoRegistration.mockResolvedValue(account);
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

			expect(mockNativeAccounts.startSsoRegistration).toHaveBeenCalledWith(
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
			mockNativeAccounts.startSsoRegistration.mockResolvedValue({
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
			mockNativeAccounts.startSsoRegistration.mockResolvedValue({
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
			expect(mockNativeAccounts.completeSsoRegistration).toHaveBeenCalledWith({
				token: "pending-tok",
				handle: "jane.opnshelf.social",
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
			mockNativeAccounts.completeSsoRegistration.mockRejectedValue(
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

		it("sends the user back to the signup form when Google is not configured", () => {
			mockGoogleOAuth.configured = false;
			const res = createMockResponse();

			controller.googleStart(res);

			expect(res.redirect).toHaveBeenCalledWith(
				"http://127.0.0.1:3000/signup?error=google_unavailable",
			);
			expect(res.cookie).not.toHaveBeenCalled();
		});

		it("parks a CSRF state cookie and sends the user to Google", () => {
			const res = createMockResponse();

			controller.googleStart(res);

			expect(res.cookie).toHaveBeenCalledWith(
				"google_state",
				expect.any(String),
				expect.objectContaining({ httpOnly: true, path: "/" }),
			);
			const state = (res.cookie as Mock).mock.calls[0][1] as string;
			expect(mockGoogleOAuth.buildAuthUrl).toHaveBeenCalledWith(state);
			expect(res.redirect).toHaveBeenCalledWith(
				"https://accounts.google.com/o/auth",
			);
		});
	});
});
