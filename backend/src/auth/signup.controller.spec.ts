import type { Mock, Mocked } from "vitest";
import { BadRequestException, HttpException } from "@nestjs/common";
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
import { CaptchaService } from "../pds/captcha.service";
import { TranquilAdminService } from "../pds/tranquil-admin.service";
import { AuthService } from "./auth.service";
import { DeviceSessionsService } from "./device-sessions.service";
import { NativeAccountService } from "./native-account.service";
import { SignupController } from "./signup.controller";
import { SignupRateLimiter } from "./signup-rate-limiter";

describe("SignupController", () => {
	let controller: SignupController;

	const mockAuthService: {
		authorize: Mock;
		upsertUser: Mock;
		getUser: Mock;
		revokeBySessionId: Mock;
		restore: Mock;
	} = {
		authorize: vi.fn(),
		upsertUser: vi.fn(),
		getUser: vi.fn(),
		revokeBySessionId: vi.fn(),
		restore: vi.fn().mockResolvedValue(undefined),
	};

	const mockNativeAccounts: {
		registerAccount: Mock;
		confirmEmailWithCode: Mock;
		resendEmailConfirmation: Mock;
		markEmailVerified: Mock;
	} = {
		registerAccount: vi.fn(),
		confirmEmailWithCode: vi.fn().mockResolvedValue(true),
		resendEmailConfirmation: vi.fn().mockResolvedValue(undefined),
		markEmailVerified: vi.fn().mockResolvedValue(undefined),
	};

	const mockSessions = {
		createCredentialSession: vi.fn().mockResolvedValue("session-123"),
	};

	const mockIngesterService = {
		addRepo: vi.fn().mockResolvedValue(undefined),
	};

	const mockTranquilAdmin = {
		mintInviteCode: vi.fn().mockResolvedValue("invite-code"),
		disableInviteCodes: vi.fn().mockResolvedValue(undefined),
	};

	const mockCaptcha = {
		verify: vi.fn().mockResolvedValue(true),
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
			url: "/auth/register",
			cookies: {},
			...overrides,
		} as unknown as import("express").Request;
	};

	beforeEach(async () => {
		vi.clearAllMocks();
		mockAuthService.authorize.mockResolvedValue(
			"https://pds.example/authorize",
		);
		mockNativeAccounts.confirmEmailWithCode.mockResolvedValue(true);
		mockNativeAccounts.resendEmailConfirmation.mockResolvedValue(undefined);
		mockNativeAccounts.markEmailVerified.mockResolvedValue(undefined);
		mockTranquilAdmin.disableInviteCodes.mockResolvedValue(undefined);

		const module: TestingModule = await Test.createTestingModule({
			controllers: [SignupController],
			providers: [
				// The real limiter: its per-IP / per-DID buckets are what the
				// rate-limit tests below exercise.
				SignupRateLimiter,
				{ provide: AuthService, useValue: mockAuthService },
				{ provide: NativeAccountService, useValue: mockNativeAccounts },
				{ provide: DeviceSessionsService, useValue: mockSessions },
				{ provide: ConfigService, useValue: mockConfigService },
				{ provide: IngesterService, useValue: mockIngesterService },
				{ provide: TranquilAdminService, useValue: mockTranquilAdmin },
				{ provide: CaptchaService, useValue: mockCaptcha },
			],
		}).compile();

		controller = module.get<SignupController>(SignupController);
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
			handle: "jane.opnshelf.social",
			accessJwt: "a",
			refreshJwt: "r",
			pdsUrl: "https://opnshelf.social",
		};

		beforeEach(() => {
			// An earlier test overrides get() via mockImplementation, which
			// clearAllMocks() does not reset — restore the full config here.
			mockConfigService.get.mockImplementation((key: string) => {
				const config: Record<string, string> = {
					FRONTEND_URL: "http://127.0.0.1:3000",
					NODE_ENV: "test",
					PDS_HANDLE_DOMAIN: "opnshelf.social",
				};
				return config[key];
			});
			mockCaptcha.verify.mockResolvedValue(true);
			mockTranquilAdmin.mintInviteCode.mockResolvedValue("invite-code");
			mockNativeAccounts.registerAccount.mockResolvedValue(account);
			mockSessions.createCredentialSession.mockResolvedValue("sess-1");
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
			expect(mockNativeAccounts.registerAccount).toHaveBeenCalledWith(
				expect.objectContaining({
					handle: "jane.opnshelf.social",
					email: "jane@example.com",
					inviteCode: "invite-code",
				}),
			);
			expect(mockSessions.createCredentialSession).toHaveBeenCalled();
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
			mockNativeAccounts.registerAccount.mockRejectedValue(
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

	describe("verifyEmail", () => {
		const reqFor = (did = "did:plc:abc123") =>
			createMockRequest({
				user: { did, session: {} },
			} as unknown as import("express").Request) as unknown as import("../auth/types").AuthenticatedRequest;

		it("confirms the code, revokes bootstrap credentials, and starts Core OAuth", async () => {
			mockAuthService.getUser.mockResolvedValue({
				did: "did:plc:abc123",
				handle: "jane.opnshelf.social",
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
			expect(mockNativeAccounts.confirmEmailWithCode).toHaveBeenCalledWith(
				{},
				" abc ",
			);
			expect(mockNativeAccounts.markEmailVerified).toHaveBeenCalledWith(
				"did:plc:abc123",
			);
			expect(mockAuthService.authorize).toHaveBeenCalledWith(
				"jane.opnshelf.social",
			);
			expect(mockAuthService.revokeBySessionId).not.toHaveBeenCalled();
		});

		it("routes a mobile verification back into the app with its code challenge", async () => {
			mockAuthService.getUser.mockResolvedValue({
				did: "did:plc:abc123",
				handle: "jane.opnshelf.social",
				displayName: null,
				emailVerifiedAt: null,
			});

			await controller.verifyEmail(reqFor(), {
				code: "abc",
				platform: "mobile",
				codeChallenge: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
			});

			expect(mockAuthService.authorize).toHaveBeenCalledWith(
				"jane.opnshelf.social",
				{
					platform: "mobile",
					codeChallenge: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
				},
			);
		});

		it("still hands an already verified native account into Core OAuth", async () => {
			mockAuthService.getUser.mockResolvedValue({
				did: "did:plc:abc123",
				handle: "jane.opnshelf.social",
				displayName: null,
				emailVerifiedAt: new Date(),
			});

			await controller.verifyEmail(reqFor(), { code: "abc" });

			expect(mockNativeAccounts.confirmEmailWithCode).toHaveBeenCalled();
			expect(mockAuthService.authorize).toHaveBeenCalledWith(
				"jane.opnshelf.social",
			);
		});

		it("maps an invalid code to BadRequestException and does not start OAuth", async () => {
			mockAuthService.getUser.mockResolvedValue({
				did: "did:plc:abc123",
				handle: "jane.opnshelf.social",
				displayName: null,
				emailVerifiedAt: null,
			});
			mockNativeAccounts.confirmEmailWithCode.mockRejectedValueOnce({
				error: "InvalidToken",
			});

			await expect(
				controller.verifyEmail(reqFor(), { code: "nope" }),
			).rejects.toThrow(BadRequestException);
			expect(mockNativeAccounts.markEmailVerified).not.toHaveBeenCalled();
			expect(mockAuthService.authorize).not.toHaveBeenCalled();
		});

		it("does not seed with the credential session", async () => {
			mockAuthService.getUser.mockResolvedValue({
				did: "did:plc:abc123",
				handle: "jane.opnshelf.social",
				displayName: null,
				emailVerifiedAt: null,
			});
			const result = await controller.verifyEmail(reqFor(), { code: "abc" });

			expect(result).toEqual({
				verified: true,
				coreOAuthUrl: "https://pds.example/authorize",
			});
			expect(mockNativeAccounts.markEmailVerified).toHaveBeenCalled();
		});

		it("revokes the exact Bearer bootstrap after creating the Core authorization", async () => {
			mockAuthService.getUser.mockResolvedValue({
				did: "did:plc:abc123",
				handle: "jane.opnshelf.social",
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
				handle: "jane.opnshelf.social",
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
			expect(mockNativeAccounts.resendEmailConfirmation).toHaveBeenCalledWith(
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
});
