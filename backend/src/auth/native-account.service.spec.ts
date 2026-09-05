import { ConfigService } from "@nestjs/config";
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

	const mockConfigService = {
		get: vi.fn((key: string): string | undefined => baseConfig[key]),
	};

	beforeEach(async () => {
		vi.clearAllMocks();
		mockConfigService.get.mockImplementation((key: string) => baseConfig[key]);
		atpAgentHarness.session = undefined;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				NativeAccountService,
				{ provide: PrismaService, useValue: mockPrismaService },
				{ provide: ConfigService, useValue: mockConfigService },
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
			mockConfigService.get.mockImplementation(() => undefined);

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
