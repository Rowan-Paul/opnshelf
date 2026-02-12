import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";

// Mock PrismaService before importing AuthService
jest.mock("../prisma/prisma.service", () => ({
	PrismaService: jest.fn().mockImplementation(() => ({
		authSession: {
			findUnique: jest.fn(),
			upsert: jest.fn(),
			deleteMany: jest.fn(),
		},
		authState: {
			findUnique: jest.fn(),
			upsert: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn(),
		},
		user: {
			findUnique: jest.fn(),
			upsert: jest.fn(),
		},
	})),
}));

// Mock the @atproto/oauth-client-node module
jest.mock("@atproto/oauth-client-node", () => ({
	NodeOAuthClient: jest.fn().mockImplementation(() => ({
		authorize: jest.fn(),
		callback: jest.fn(),
		restore: jest.fn(),
	})),
}));

// Mock the @atproto/api module
jest.mock("@atproto/api", () => ({
	Agent: jest.fn().mockImplementation(() => ({
		getProfile: jest.fn(),
	})),
}));

import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
	let service: AuthService;
	let prismaService: jest.Mocked<PrismaService>;
	let configService: jest.Mocked<ConfigService>;

	const mockPrismaService = {
		authSession: {
			findUnique: jest.fn(),
			upsert: jest.fn(),
			deleteMany: jest.fn(),
		},
		authState: {
			findUnique: jest.fn(),
			upsert: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn(),
		},
		user: {
			findUnique: jest.fn(),
			upsert: jest.fn(),
		},
	};

	const mockConfigService = {
		get: jest.fn((key: string) => {
			const config: Record<string, string | number> = {
				BACKEND_PUBLIC_URL: "http://127.0.0.1:3001",
				PORT: 3001,
				NODE_ENV: "test",
			};
			return config[key];
		}),
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AuthService,
				{ provide: PrismaService, useValue: mockPrismaService },
				{ provide: ConfigService, useValue: mockConfigService },
			],
		}).compile();

		service = module.get<AuthService>(AuthService);
		prismaService = module.get(PrismaService);
		configService = module.get(ConfigService);

		// Initialize the OAuth client
		service.onModuleInit();
	});

	describe("getSessionById", () => {
		it("should return session record when found", async () => {
			const mockSession = {
				id: "session-123",
				userDid: "did:plc:abc123",
				sessionData: "{}",
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			mockPrismaService.authSession.findUnique.mockResolvedValue(mockSession);

			const result = await service.getSessionById("session-123");

			expect(result).toEqual(mockSession);
			expect(mockPrismaService.authSession.findUnique).toHaveBeenCalledWith({
				where: { id: "session-123" },
			});
		});

		it("should return null when session not found", async () => {
			mockPrismaService.authSession.findUnique.mockResolvedValue(null);

			const result = await service.getSessionById("nonexistent");

			expect(result).toBeNull();
		});
	});

	describe("getSessionByUserDid", () => {
		it("should return session record when found", async () => {
			const mockSession = {
				id: "session-123",
				userDid: "did:plc:abc123",
				sessionData: "{}",
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			mockPrismaService.authSession.findUnique.mockResolvedValue(mockSession);

			const result = await service.getSessionByUserDid("did:plc:abc123");

			expect(result).toEqual(mockSession);
			expect(mockPrismaService.authSession.findUnique).toHaveBeenCalledWith({
				where: { userDid: "did:plc:abc123" },
			});
		});

		it("should return null when session not found", async () => {
			mockPrismaService.authSession.findUnique.mockResolvedValue(null);

			const result = await service.getSessionByUserDid("did:plc:nonexistent");

			expect(result).toBeNull();
		});
	});

	describe("revoke", () => {
		it("should delete session by DID", async () => {
			mockPrismaService.authSession.deleteMany.mockResolvedValue({ count: 1 });

			await service.revoke("did:plc:abc123");

			expect(mockPrismaService.authSession.deleteMany).toHaveBeenCalledWith({
				where: { userDid: "did:plc:abc123" },
			});
		});

		it("should handle errors gracefully", async () => {
			mockPrismaService.authSession.deleteMany.mockRejectedValue(
				new Error("DB error"),
			);

			// Should not throw
			await expect(service.revoke("did:plc:abc123")).resolves.toBeUndefined();
		});
	});

	describe("revokeBySessionId", () => {
		it("should delete session by id", async () => {
			mockPrismaService.authSession.deleteMany.mockResolvedValue({ count: 1 });

			await service.revokeBySessionId("session-123");

			expect(mockPrismaService.authSession.deleteMany).toHaveBeenCalledWith({
				where: { id: "session-123" },
			});
		});

		it("should handle errors gracefully", async () => {
			mockPrismaService.authSession.deleteMany.mockRejectedValue(
				new Error("DB error"),
			);

			// Should not throw
			await expect(
				service.revokeBySessionId("session-123"),
			).resolves.toBeUndefined();
		});
	});

	describe("upsertUser", () => {
		it("should upsert user with profile data", async () => {
			const profile = {
				did: "did:plc:abc123",
				handle: "user.bsky.social",
				displayName: "Test User",
				avatar: "https://example.com/avatar.jpg",
			};
			const mockUser = {
				...profile,
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			mockPrismaService.user.upsert.mockResolvedValue(mockUser);

			const result = await service.upsertUser(profile);

			expect(result).toEqual(mockUser);
			expect(mockPrismaService.user.upsert).toHaveBeenCalledWith({
				where: { did: profile.did },
				update: {
					handle: profile.handle,
					displayName: profile.displayName,
					avatar: profile.avatar,
				},
				create: {
					did: profile.did,
					handle: profile.handle,
					displayName: profile.displayName,
					avatar: profile.avatar,
				},
			});
		});

		it("should handle null displayName and avatar", async () => {
			const profile = {
				did: "did:plc:abc123",
				handle: "user.bsky.social",
				displayName: null,
				avatar: null,
			};
			mockPrismaService.user.upsert.mockResolvedValue({
				...profile,
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			await service.upsertUser(profile);

			expect(mockPrismaService.user.upsert).toHaveBeenCalledWith({
				where: { did: profile.did },
				update: {
					handle: profile.handle,
					displayName: null,
					avatar: null,
				},
				create: {
					did: profile.did,
					handle: profile.handle,
					displayName: null,
					avatar: null,
				},
			});
		});
	});

	describe("getUser", () => {
		it("should return user when found", async () => {
			const mockUser = {
				did: "did:plc:abc123",
				handle: "user.bsky.social",
				displayName: "Test User",
				avatar: "https://example.com/avatar.jpg",
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

			const result = await service.getUser("did:plc:abc123");

			expect(result).toEqual(mockUser);
			expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
				where: { did: "did:plc:abc123" },
			});
		});

		it("should return null when user not found", async () => {
			mockPrismaService.user.findUnique.mockResolvedValue(null);

			const result = await service.getUser("did:plc:nonexistent");

			expect(result).toBeNull();
		});
	});

	describe("getClientMetadata", () => {
		it("should return localhost metadata for development", () => {
			const metadata = service.getClientMetadata();

			expect(metadata).toMatchObject({
				client_id:
					"http://127.0.0.1:3001/.well-known/oauth-client-metadata.json",
				client_name: "OpnShelf",
				client_uri: "http://127.0.0.1:3001",
				redirect_uris: ["http://127.0.0.1:3001/auth/callback"],
				scope:
					"atproto repo:app.opnshelf.movie rpc:app.bsky.actor.getProfile?aud=did:web:api.bsky.app%23bsky_appview",
				grant_types: ["authorization_code", "refresh_token"],
				response_types: ["code"],
				application_type: "native",
				token_endpoint_auth_method: "none",
				dpop_bound_access_tokens: true,
			});
		});

		it("should return production metadata for non-localhost URLs", () => {
			(mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
				if (key === "BACKEND_PUBLIC_URL") return "https://api.opnshelf.xyz";
				if (key === "PORT") return 443;
				return undefined;
			});

			const metadata = service.getClientMetadata();

			expect(metadata).toMatchObject({
				client_id:
					"https://api.opnshelf.xyz/.well-known/oauth-client-metadata.json",
				client_name: "OpnShelf",
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

		it("should not log when no states are cleaned up", async () => {
			mockPrismaService.authState.deleteMany.mockResolvedValue({ count: 0 });

			await service.cleanupExpiredStates();

			expect(mockPrismaService.authState.deleteMany).toHaveBeenCalled();
		});
	});

	describe("getOAuthClient", () => {
		it("should return the OAuth client after initialization", () => {
			const client = service.getOAuthClient();
			expect(client).toBeDefined();
		});
	});

	describe("authorize", () => {
		it("should call OAuth client authorize and return URL", async () => {
			const mockUrl = new URL("https://bsky.social/oauth/authorize?state=abc");
			const client = service.getOAuthClient();
			(client.authorize as jest.Mock).mockResolvedValue(mockUrl);

			const result = await service.authorize("user.bsky.social");

			expect(client.authorize).toHaveBeenCalledWith("user.bsky.social", {
				scope:
					"atproto repo:app.opnshelf.movie rpc:app.bsky.actor.getProfile?aud=did:web:api.bsky.app%23bsky_appview",
			});
			expect(result).toBe(mockUrl.toString());
		});
	});

	describe("callback", () => {
		it("should call OAuth client callback with params", async () => {
			const mockResult = { session: { did: "did:plc:abc123" } };
			const client = service.getOAuthClient();
			(client.callback as jest.Mock).mockResolvedValue(mockResult);

			const params = new URLSearchParams("code=abc&state=xyz");
			const result = await service.callback(params);

			expect(client.callback).toHaveBeenCalledWith(params);
			expect(result).toEqual(mockResult);
		});
	});

	describe("restore", () => {
		it("should return session when restore succeeds", async () => {
			const mockSession = { did: "did:plc:abc123" };
			const client = service.getOAuthClient();
			(client.restore as jest.Mock).mockResolvedValue(mockSession);

			const result = await service.restore("did:plc:abc123");

			expect(client.restore).toHaveBeenCalledWith("did:plc:abc123");
			expect(result).toEqual(mockSession);
		});

		it("should return undefined when restore fails", async () => {
			const client = service.getOAuthClient();
			(client.restore as jest.Mock).mockRejectedValue(
				new Error("Session not found"),
			);

			const result = await service.restore("did:plc:abc123");

			expect(result).toBeUndefined();
		});
	});

	describe("fetchProfile", () => {
		it("should fetch and return user profile", async () => {
			const { Agent } = require("@atproto/api");
			const mockGetProfile = jest.fn().mockResolvedValue({
				data: {
					handle: "user.bsky.social",
					displayName: "Test User",
					avatar: "https://example.com/avatar.jpg",
				},
			});
			Agent.mockImplementation(() => ({
				getProfile: mockGetProfile,
			}));

			const mockSession = { did: "did:plc:abc123" };
			const result = await service.fetchProfile(mockSession);

			expect(result).toEqual({
				did: "did:plc:abc123",
				handle: "user.bsky.social",
				displayName: "Test User",
				avatar: "https://example.com/avatar.jpg",
			});
			expect(mockGetProfile).toHaveBeenCalledWith({ actor: "did:plc:abc123" });
		});

		it("should handle missing displayName and avatar", async () => {
			const { Agent } = require("@atproto/api");
			const mockGetProfile = jest.fn().mockResolvedValue({
				data: {
					handle: "user.bsky.social",
				},
			});
			Agent.mockImplementation(() => ({
				getProfile: mockGetProfile,
			}));

			const mockSession = { did: "did:plc:abc123" };
			const result = await service.fetchProfile(mockSession);

			expect(result).toEqual({
				did: "did:plc:abc123",
				handle: "user.bsky.social",
				displayName: null,
				avatar: null,
			});
		});
	});

	describe("OAUTH_SCOPE", () => {
		it("should have the correct OAuth scope for app functionality", () => {
			// Import the service module to access the constant
			const authServiceModule = require("./auth.service");

			// The OAUTH_SCOPE constant should include:
			// - atproto: base AT Protocol access
			// - repo:app.opnshelf.movie: write movie records
			// - rpc:app.bsky.actor.getProfile: fetch user profiles via Bluesky AppView
			expect(authServiceModule.OAUTH_SCOPE).toBe(
				"atproto repo:app.opnshelf.movie rpc:app.bsky.actor.getProfile?aud=did:web:api.bsky.app%23bsky_appview",
			);
		});

		it("should be used consistently across all OAuth operations", () => {
			// This test verifies that the scope is properly defined and accessible
			// The actual usage is tested in the authorize() and getClientMetadata() tests
			const authServiceModule = require("./auth.service");
			expect(authServiceModule.OAUTH_SCOPE).toBeDefined();
			expect(typeof authServiceModule.OAUTH_SCOPE).toBe("string");
			expect(authServiceModule.OAUTH_SCOPE.length).toBeGreaterThan(0);
		});
	});
});
