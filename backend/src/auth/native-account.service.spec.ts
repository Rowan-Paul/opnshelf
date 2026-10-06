import { mockEnvironment } from "../../test/env";
import { BackendEnv } from "../config/env.schema";
import { Test, type TestingModule } from "@nestjs/testing";

vi.mock("../prisma/prisma.service", () => ({
	PrismaService: vi.fn(),
}));

const atpAgentHarness = vi.hoisted(() => ({
	createAccount: vi.fn(),
	session: undefined as Record<string, unknown> | undefined,
}));

vi.mock("@atproto/api", () => ({
	Agent: vi.fn(),
	AtpAgent: vi.fn().mockImplementation(() => ({
		createAccount: atpAgentHarness.createAccount,
		get session() {
			return atpAgentHarness.session;
		},
	})),
}));

import { PrismaService } from "../prisma/prisma.service";
import { NativeAccountService } from "./native-account.service";
import { mapConfirmEmailError } from "./signup-support";
import { Logger } from "@nestjs/common";

describe("NativeAccountService", () => {
	let service: NativeAccountService;

	const mockPrismaService = {
		user: {
			update: vi.fn(),
		},
	};

	const baseConfig: Record<string, string> = {
		PDS_URL: "https://opnshelf.social",
	};

	const mockBackendEnv = mockEnvironment({
		get: vi.fn((key: string): string | undefined => baseConfig[key]),
	});

	beforeEach(async () => {
		vi.clearAllMocks();
		mockBackendEnv.get.mockImplementation((key: string) => baseConfig[key]);
		atpAgentHarness.session = undefined;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				NativeAccountService,
				{ provide: PrismaService, useValue: mockPrismaService },
				{ provide: BackendEnv, useValue: mockBackendEnv },
			],
		}).compile();

		service = module.get<NativeAccountService>(NativeAccountService);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe("registerAccount", () => {
		it("creates the account on our PDS and returns its credential tokens", async () => {
			atpAgentHarness.createAccount.mockImplementation(async () => {
				atpAgentHarness.session = {
					did: "did:plc:jane",
					handle: "jane.opnshelf.social",
					accessJwt: "access",
					refreshJwt: "refresh",
				};
			});

			const result = await service.registerAccount({
				handle: "jane.opnshelf.social",
				email: "jane@example.com",
				password: "supersecret",
				inviteCode: "invite-code",
			});

			expect(atpAgentHarness.createAccount).toHaveBeenCalledWith({
				handle: "jane.opnshelf.social",
				email: "jane@example.com",
				password: "supersecret",
				inviteCode: "invite-code",
			});
			expect(result).toEqual({
				did: "did:plc:jane",
				handle: "jane.opnshelf.social",
				accessJwt: "access",
				refreshJwt: "refresh",
				pdsUrl: "https://opnshelf.social",
			});
		});

		it("fails loudly when the PDS is not configured", async () => {
			mockBackendEnv.get.mockImplementation(() => undefined);

			await expect(
				service.registerAccount({
					handle: "jane.opnshelf.social",
					email: "jane@example.com",
					password: "supersecret",
					inviteCode: "invite-code",
				}),
			).rejects.toThrow("PDS_URL not configured");
		});
	});

	describe("confirmEmailWithCode", () => {
		it("confirms signup without requiring an email-read grant", async () => {
			const request = vi
				.fn()
				.mockResolvedValueOnce({
					ok: true,
					json: async () => ({
						did: "did:plc:jane",
						emailVerified: true,
						accessJwt: "signup-access",
					}),
				})
				.mockResolvedValueOnce({ ok: true });
			vi.stubGlobal("fetch", request);
			await expect(
				service.confirmEmailWithCode({ did: "did:plc:jane" }, " code "),
			).resolves.toBe(true);
			expect(request).toHaveBeenNthCalledWith(
				2,
				"https://opnshelf.social/xrpc/com.atproto.server.deleteSession",
				expect.objectContaining({
					method: "POST",
					headers: { Authorization: "Bearer signup-access" },
				}),
			);
			expect(request).toHaveBeenCalledWith(
				"https://opnshelf.social/xrpc/com.atproto.server.confirmSignup",
				expect.objectContaining({
					body: JSON.stringify({
						did: "did:plc:jane",
						verificationCode: "code",
					}),
				}),
			);
		});
		it.each([
			{ did: "did:plc:other", emailVerified: true },
			{ did: "did:plc:jane", emailVerified: false },
		])("rejects an unverified or different account", async (result) => {
			vi.stubGlobal(
				"fetch",
				vi
					.fn()
					.mockResolvedValueOnce({
						ok: true,
						json: async () => ({ ...result, accessJwt: "signup-access" }),
					})
					.mockResolvedValueOnce({ ok: true }),
			);
			await expect(
				service.confirmEmailWithCode({ did: "did:plc:jane" }, "code"),
			).rejects.toThrow("PDS did not verify this account's email");
		});
		it.each([
			["ExpiredToken", "That code has expired. Request a new one."],
			["InvalidToken", "That code is invalid."],
			["InvalidRequest", "That code is invalid."],
			["InternalError", "Could not verify that code. Please try again."],
		])("maps the PDS %s error for the caller", async (error, message) => {
			vi.stubGlobal(
				"fetch",
				vi.fn().mockResolvedValue({
					ok: false,
					json: async () => ({ error }),
				}),
			);
			const logger = new Logger();
			vi.spyOn(logger, "error").mockImplementation(() => undefined);
			const failure = await service
				.confirmEmailWithCode({ did: "did:plc:jane" }, "wrong")
				.catch((reason: unknown) => reason);
			expect(failure).toMatchObject({ error });
			expect(mapConfirmEmailError(failure, logger).message).toBe(message);
		});
		it("handles non-JSON PDS failures", async () => {
			vi.stubGlobal(
				"fetch",
				vi.fn().mockResolvedValue({
					ok: false,
					json: async () => {
						throw new SyntaxError("not JSON");
					},
				}),
			);
			await expect(
				service.confirmEmailWithCode({ did: "did:plc:jane" }, "wrong"),
			).rejects.toMatchObject({ error: "SignupVerificationFailed" });
		});
		it("fails verification when signup session revocation fails", async () => {
			vi.stubGlobal(
				"fetch",
				vi
					.fn()
					.mockResolvedValueOnce({
						ok: true,
						json: async () => ({
							did: "did:plc:jane",
							emailVerified: true,
							accessJwt: "signup-access",
						}),
					})
					.mockResolvedValueOnce({ ok: false }),
			);
			await expect(
				service.confirmEmailWithCode({ did: "did:plc:jane" }, "code"),
			).rejects.toThrow("Could not revoke the signup session");
		});
		it("rejects confirmation without a revocable signup session", async () => {
			vi.stubGlobal(
				"fetch",
				vi.fn().mockResolvedValue({
					ok: true,
					json: async () => ({ did: "did:plc:jane", emailVerified: true }),
				}),
			);
			await expect(
				service.confirmEmailWithCode({ did: "did:plc:jane" }, "code"),
			).rejects.toThrow("PDS did not return a signup session to revoke");
		});
		it("requires the authenticated account", async () => {
			await expect(
				service.confirmEmailWithCode(undefined, "code"),
			).rejects.toThrow("Session not found");
		});
	});

	describe("resendEmailConfirmation", () => {
		it("asks Tranquil to re-enqueue the signup code by DID, unauthenticated", async () => {
			const mockFetch = vi.fn().mockResolvedValue({ ok: true });
			vi.stubGlobal("fetch", mockFetch);

			await service.resendEmailConfirmation("did:plc:jane");

			expect(mockFetch).toHaveBeenCalledWith(
				"https://opnshelf.social/xrpc/com.atproto.server.resendVerification",
				expect.objectContaining({
					method: "POST",
					body: JSON.stringify({ did: "did:plc:jane" }),
				}),
			);
		});

		it("surfaces a failed resend", async () => {
			vi.stubGlobal(
				"fetch",
				vi.fn().mockResolvedValue({
					ok: false,
					status: 500,
					text: async () => "boom",
				}),
			);

			await expect(
				service.resendEmailConfirmation("did:plc:jane"),
			).rejects.toThrow("resendVerification failed (500): boom");
		});
	});

	describe("markEmailVerified", () => {
		it("stamps emailVerifiedAt on the user row", async () => {
			await service.markEmailVerified("did:plc:jane");

			expect(mockPrismaService.user.update).toHaveBeenCalledWith({
				where: { did: "did:plc:jane" },
				data: { emailVerifiedAt: expect.any(Date) },
			});
		});
	});

	describe("delegated Google SSO", () => {
		it("binds the verified id_token to the prepared OAuth request", async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					token: "pending-token",
					email: "jane@example.com",
					emailVerified: true,
					providerUsername: "Jane",
				}),
			});
			vi.stubGlobal("fetch", mockFetch);

			const result = await service.startSsoRegistration(
				"verified-id-token",
				"urn:ietf:params:oauth:request_uri:abc",
			);

			expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
				provider: "google",
				id_token: "verified-id-token",
				request_uri: "urn:ietf:params:oauth:request_uri:abc",
			});
			expect(result).toEqual({
				token: "pending-token",
				email: "jane@example.com",
				emailVerified: true,
				providerUsername: "Jane",
				redirectUrl: null,
			});
			vi.unstubAllGlobals();
		});

		it("resolves the PDS consent redirect returned after registration", async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					did: "did:plc:jane",
					handle: "jane.opnshelf.social",
					redirectUrl:
						"/app/oauth/consent?request_uri=urn%3Aietf%3Aparams%3Aoauth%3Arequest_uri%3Aabc",
				}),
			});
			vi.stubGlobal("fetch", mockFetch);

			const result = await service.completeSsoRegistration({
				token: "pending-token",
				handle: "jane.opnshelf.social",
				inviteCode: "invite-code",
			});

			expect(result.redirectUrl).toBe(
				"https://opnshelf.social/app/oauth/consent?request_uri=urn%3Aietf%3Aparams%3Aoauth%3Arequest_uri%3Aabc",
			);
			vi.unstubAllGlobals();
		});
	});

	describe("PDS SSO errors", () => {
		it("rethrows in the { error, message } shape the signup path maps", async () => {
			vi.stubGlobal(
				"fetch",
				vi.fn().mockResolvedValue({
					ok: false,
					status: 409,
					json: async () => ({
						error: "HandleNotAvailable",
						message: "taken",
					}),
				}),
			);

			await expect(
				service.completeSsoRegistration({
					token: "pending-token",
					handle: "jane.opnshelf.social",
					inviteCode: "invite-code",
				}),
			).rejects.toEqual({
				status: 409,
				error: "HandleNotAvailable",
				message: "taken",
			});
		});
	});
});
