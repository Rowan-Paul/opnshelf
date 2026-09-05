import type { Mock } from "vitest";
import { NodeOAuthClient } from "@atproto/oauth-client-node";
import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";

// Mock PrismaService before importing OAuthClientFactory
vi.mock("../prisma/prisma.service", () => ({
	PrismaService: vi.fn().mockImplementation(() => ({
		authState: {
			findUnique: vi.fn(),
			upsert: vi.fn(),
			delete: vi.fn(),
			deleteMany: vi.fn(),
		},
	})),
}));

// Every `new NodeOAuthClient()` returns the same shared mock so the tests can
// assert on the metadata it was built with.
const sharedOAuthClient = vi.hoisted(() => ({
	authorize: vi.fn(),
	callback: vi.fn(),
	restore: vi.fn(),
}));
vi.mock("@atproto/oauth-client-node", () => ({
	NodeOAuthClient: vi.fn().mockImplementation(() => sharedOAuthClient),
	// Vitest throws on undefined named exports (Jest returned undefined);
	// oauth-client.factory imports this at module load.
	requestLocalLock: vi.fn(),
}));

import { PrismaService } from "../prisma/prisma.service";
import { OAuthClientFactory } from "./oauth-client.factory";
import { DECLARED_OAUTH_SCOPE } from "./oauth-scopes";

describe("OAuthClientFactory", () => {
	let service: OAuthClientFactory;

	const mockPrismaService = {
		authState: {
			findUnique: vi.fn(),
			upsert: vi.fn(),
			delete: vi.fn(),
			deleteMany: vi.fn(),
		},
	};

	const baseConfig: Record<string, string | number> = {
		BACKEND_PUBLIC_URL: "http://127.0.0.1:3001",
		PDS_URL: "https://opnshelf.social",
		PORT: 3001,
		NODE_ENV: "test",
	};

	const mockConfigService = {
		get: vi.fn((key: string) => baseConfig[key]),
	};

	beforeEach(async () => {
		vi.clearAllMocks();
		mockConfigService.get.mockImplementation((key: string) => baseConfig[key]);

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				OAuthClientFactory,
				{ provide: PrismaService, useValue: mockPrismaService },
				{ provide: ConfigService, useValue: mockConfigService },
			],
		}).compile();

		service = module.get<OAuthClientFactory>(OAuthClientFactory);

		// Initialize the OAuth client
		service.onModuleInit();
	});

	describe("onModuleInit", () => {
		it("should initialize the OAuth client with shared metadata", () => {
			expect(NodeOAuthClient).toHaveBeenCalledWith({
				clientMetadata: {
					client_id: `http://localhost?redirect_uri=${encodeURIComponent("http://127.0.0.1:3001/auth/callback")}&scope=${encodeURIComponent(DECLARED_OAUTH_SCOPE)}`,
					client_name: "Opnshelf",
					client_uri: "http://127.0.0.1:3001",
					redirect_uris: ["http://127.0.0.1:3001/auth/callback"],
					scope: DECLARED_OAUTH_SCOPE,
					grant_types: ["authorization_code", "refresh_token"],
					response_types: ["code"],
					application_type: "native",
					token_endpoint_auth_method: "none",
					dpop_bound_access_tokens: true,
				},
				stateStore: {
					set: expect.any(Function),
					get: expect.any(Function),
					del: expect.any(Function),
				},
				sessionStore: {
					set: expect.any(Function),
					get: expect.any(Function),
					del: expect.any(Function),
				},
				requestLock: expect.any(Function),
				allowHttp: true,
			});
		});
	});

	describe("getClientMetadata", () => {
		it("should return localhost metadata for development", () => {
			const metadata = service.getClientMetadata();

			expect(metadata).toMatchObject({
				client_id:
					"http://127.0.0.1:3001/.well-known/oauth-client-metadata.json",
				client_name: "Opnshelf",
				client_uri: "http://127.0.0.1:3001",
				redirect_uris: ["http://127.0.0.1:3001/auth/callback"],
				scope: DECLARED_OAUTH_SCOPE,
				grant_types: ["authorization_code", "refresh_token"],
				response_types: ["code"],
				application_type: "native",
				token_endpoint_auth_method: "none",
				dpop_bound_access_tokens: true,
			});
		});

		it("should return production metadata for non-localhost URLs", () => {
			(mockConfigService.get as Mock).mockImplementation((key: string) => {
				if (key === "BACKEND_PUBLIC_URL") return "https://api.opnshelf.xyz";
				if (key === "PORT") return 443;
				return undefined;
			});

			const metadata = service.getClientMetadata();

			expect(metadata).toMatchObject({
				client_id:
					"https://api.opnshelf.xyz/.well-known/oauth-client-metadata.json",
				client_name: "Opnshelf",
				client_uri: "https://api.opnshelf.xyz",
				redirect_uris: ["https://api.opnshelf.xyz/auth/callback"],
				application_type: "web",
			});
		});
	});

	describe("cleanupExpiredStates", () => {
		it("should delete expired auth states", async () => {
			mockPrismaService.authState.deleteMany.mockResolvedValue({ count: 5 });

			await service.cleanupExpiredStates();

			expect(mockPrismaService.authState.deleteMany).toHaveBeenCalledWith({
				where: {
					expiresAt: { lt: expect.any(Date) },
				},
			});
		});
	});

	describe("getBaseClient", () => {
		it("returns the login-only client built at boot", () => {
			expect(service.getBaseClient()).toBe(sharedOAuthClient);
		});

		it("refuses to hand out a client before initialization", () => {
			const uninitialized = new OAuthClientFactory(
				mockPrismaService as unknown as PrismaService,
				mockConfigService as unknown as ConfigService,
			);

			expect(() => uninitialized.getBaseClient()).toThrow(
				"OAuth client not initialized",
			);
		});
	});

	describe("state store", () => {
		const stateStoreOf = () =>
			(NodeOAuthClient as unknown as Mock).mock.calls[0][0].stateStore as {
				set: (key: string, state: unknown) => Promise<void>;
				get: (key: string) => Promise<unknown>;
				del: (key: string) => Promise<void>;
			};

		it("persists login state with a one hour TTL", async () => {
			await stateStoreOf().set("state-key", { verifier: "pkce" });

			expect(mockPrismaService.authState.upsert).toHaveBeenCalledWith({
				where: { key: "state-key" },
				update: {
					stateData: JSON.stringify({ verifier: "pkce" }),
					expiresAt: expect.any(Date),
				},
				create: {
					key: "state-key",
					stateData: JSON.stringify({ verifier: "pkce" }),
					expiresAt: expect.any(Date),
				},
			});
		});

		it("drops and hides an expired state", async () => {
			mockPrismaService.authState.findUnique.mockResolvedValue({
				key: "state-key",
				stateData: "{}",
				expiresAt: new Date(Date.now() - 1000),
			});

			await expect(stateStoreOf().get("state-key")).resolves.toBeUndefined();
			expect(mockPrismaService.authState.delete).toHaveBeenCalledWith({
				where: { key: "state-key" },
			});
		});
	});
});
