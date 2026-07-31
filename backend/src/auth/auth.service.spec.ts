import type { Mock, Mocked } from "vitest";
import { CredentialSession } from "@atproto/api";
import { NodeOAuthClient } from "@atproto/oauth-client-node";
import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";

// Mock PrismaService before importing AuthService
vi.mock("../prisma/prisma.service", () => ({
	PrismaService: vi.fn().mockImplementation(() => ({
		$transaction: vi.fn(),
		authSession: {
			findUnique: vi.fn(),
			upsert: vi.fn(),
			update: vi.fn(),
			deleteMany: vi.fn(),
		},
		authState: {
			findUnique: vi.fn(),
			upsert: vi.fn(),
			delete: vi.fn(),
			deleteMany: vi.fn(),
		},
		user: {
			findUnique: vi.fn(),
			update: vi.fn(),
			upsert: vi.fn(),
		},
	})),
}));

// Mock the @atproto/oauth-client-node module. The service now builds one client
// per device session, so every `new NodeOAuthClient()` returns the SAME shared
// mock — tests reference its authorize/callback/restore directly.
const sharedOAuthClient = vi.hoisted(() => ({
	authorize: vi.fn(),
	callback: vi.fn(),
	restore: vi.fn(),
}));
vi.mock("@atproto/oauth-client-node", () => ({
	NodeOAuthClient: vi.fn().mockImplementation(() => sharedOAuthClient),
	// Vitest throws on undefined named exports (Jest returned undefined);
	// auth.service imports this at module load.
	requestLocalLock: vi.fn(),
}));

const credentialSessionHarness = vi.hoisted(() => ({
	instances: [] as Array<{
		did?: string;
		resumeSession: Mock;
		persistSession: (event: string, session?: Record<string, unknown>) => void;
	}>,
}));

// Mock the @atproto/api module
vi.mock("@atproto/api", () => ({
	Agent: vi.fn().mockImplementation(() => {
		const getProfile = vi.fn();
		return {
			com: {
				atproto: {
					repo: {
						describeRepo: vi.fn(),
						getRecord: vi.fn(),
					},
				},
			},
			getProfile,
			withProxy: vi.fn().mockReturnValue({ getProfile }),
		};
	}),
	CredentialSession: vi
		.fn()
		.mockImplementation(
			(
				_serviceUrl: URL,
				_fetch: unknown,
				persistSession: (
					event: string,
					session?: Record<string, unknown>,
				) => void,
			) => {
				const instance: {
					did?: string;
					resumeSession: Mock;
					persistSession: (
						event: string,
						session?: Record<string, unknown>,
					) => void;
				} = {
					persistSession,
					resumeSession: vi.fn(async (session: Record<string, unknown>) => {
						instance.did = session.did as string;
						persistSession("update", {
							...session,
							accessJwt: "rotated-access",
							refreshJwt: "rotated-refresh",
						});
					}),
				};
				credentialSessionHarness.instances.push(instance);
				return instance;
			},
		),
}));

import { PrismaService } from "../prisma/prisma.service";
import { AuthService, DECLARED_OAUTH_SCOPE, OAUTH_SCOPE } from "./auth.service";

describe("AuthService", () => {
	let service: AuthService;
	let prismaService: Mocked<PrismaService>;
	let configService: Mocked<ConfigService>;

	const mockPrismaService = {
		$transaction: vi.fn(),
		authSession: {
			findUnique: vi.fn(),
			findFirst: vi.fn(),
			upsert: vi.fn(),
			update: vi.fn(),
			deleteMany: vi.fn(),
		},
		authState: {
			findUnique: vi.fn(),
			upsert: vi.fn(),
			delete: vi.fn(),
			deleteMany: vi.fn(),
		},
		user: {
			findUnique: vi.fn(),
			update: vi.fn(),
			upsert: vi.fn(),
		},
	};

	const mockConfigService = {
		get: vi.fn((key: string) => {
			const config: Record<string, string | number> = {
				BACKEND_PUBLIC_URL: "http://127.0.0.1:3001",
				PORT: 3001,
				NODE_ENV: "test",
			};
			return config[key];
		}),
	};

	beforeEach(async () => {
		vi.clearAllMocks();
		credentialSessionHarness.instances.length = 0;

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
			mockPrismaService.user.findUnique.mockResolvedValue(null);
			mockPrismaService.user.upsert.mockResolvedValue(mockUser);

			const result = await service.upsertUser(profile);

			expect(result).toEqual({
				user: mockUser,
				isNewUser: true,
			});
			expect(mockPrismaService.user.upsert).toHaveBeenCalledWith({
				where: { did: profile.did },
				update: {
					handle: profile.handle,
				},
				create: {
					did: profile.did,
					handle: profile.handle,
					displayName: profile.displayName,
					avatar: profile.avatar,
					timezone: "UTC",
					emailVerifiedAt: null,
					isNativePds: false,
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
			mockPrismaService.user.findUnique.mockResolvedValue(null);

			await service.upsertUser(profile);

			expect(mockPrismaService.user.upsert).toHaveBeenCalledWith({
				where: { did: profile.did },
				update: {
					handle: profile.handle,
				},
				create: {
					did: profile.did,
					handle: profile.handle,
					displayName: null,
					avatar: null,
					timezone: "UTC",
					emailVerifiedAt: null,
					isNativePds: false,
				},
			});
		});

		it("preserves an existing user's saved timezone during sign-in", async () => {
			const profile = {
				did: "did:plc:abc123",
				handle: "user.bsky.social",
				displayName: null,
				avatar: null,
			};
			mockPrismaService.user.findUnique.mockResolvedValue({
				did: profile.did,
				emailVerifiedAt: new Date(),
				isNativePds: false,
				avatar: null,
			});
			mockPrismaService.user.upsert.mockResolvedValue({ ...profile });

			await service.upsertUser(profile, "Europe/Amsterdam");

			expect(mockPrismaService.user.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					update: { handle: profile.handle },
				}),
			);
		});

		it("creates a native-PDS account unverified and gated", async () => {
			const profile = {
				did: "did:plc:jane",
				handle: "jane.opnshelf.xyz",
				displayName: null,
				avatar: null,
			};
			mockPrismaService.user.findUnique.mockResolvedValue(null);
			mockPrismaService.user.upsert.mockResolvedValue({ ...profile });

			await service.upsertUser(profile, undefined, { isNativePds: true });

			expect(mockPrismaService.user.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					create: expect.objectContaining({
						isNativePds: true,
						emailVerifiedAt: null,
					}),
				}),
			);
		});

		it("backfills emailVerifiedAt on re-login for a legacy external account", async () => {
			const profile = {
				did: "did:plc:abc123",
				handle: "user.bsky.social",
				displayName: "Test User",
				avatar: null,
			};
			// Existing external row stuck at null (created before verified-on-creation).
			mockPrismaService.user.findUnique.mockResolvedValue({
				did: profile.did,
				emailVerifiedAt: null,
				isNativePds: false,
			});
			mockPrismaService.user.upsert.mockResolvedValue({ ...profile });

			await service.upsertUser(profile, undefined, { emailVerified: true });

			expect(mockPrismaService.user.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					update: expect.objectContaining({
						handle: profile.handle,
						emailVerifiedAt: expect.any(Date),
					}),
				}),
			);
		});

		it("does not un-gate an unverified native account that re-logs in via OAuth", async () => {
			const profile = {
				did: "did:plc:jane",
				handle: "jane.opnshelf.xyz",
				displayName: null,
				avatar: null,
			};
			// Native account still awaiting email verification.
			mockPrismaService.user.findUnique.mockResolvedValue({
				did: profile.did,
				emailVerifiedAt: null,
				isNativePds: true,
			});
			mockPrismaService.user.upsert.mockResolvedValue({ ...profile });

			await service.upsertUser(profile, undefined, { emailVerified: true });

			// Only the handle is touched — the verification timestamp stays null.
			expect(mockPrismaService.user.upsert).toHaveBeenCalledWith(
				expect.objectContaining({ update: { handle: profile.handle } }),
			);
		});

		it("does not clobber an existing emailVerifiedAt on re-login", async () => {
			const profile = {
				did: "did:plc:abc123",
				handle: "user.bsky.social",
				displayName: null,
				avatar: null,
			};
			mockPrismaService.user.findUnique.mockResolvedValue({
				did: profile.did,
				emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
				isNativePds: false,
			});
			mockPrismaService.user.upsert.mockResolvedValue({ ...profile });

			await service.upsertUser(profile, undefined, { emailVerified: true });

			expect(mockPrismaService.user.upsert).toHaveBeenCalledWith(
				expect.objectContaining({ update: { handle: profile.handle } }),
			);
		});

		it("should recover from handle uniqueness conflicts by reassigning stale handle owner", async () => {
			const profile = {
				did: "did:plc:new123",
				handle: "user.bsky.social",
				displayName: "New User",
				avatar: "https://example.com/avatar.jpg",
			};
			const mockUser = {
				...profile,
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			const handleConflictError = {
				code: "P2002",
				meta: {
					constraint: {
						fields: ["handle"],
					},
				},
			};

			mockPrismaService.$transaction.mockImplementation(
				async (fn: (tx: typeof mockPrismaService) => unknown) =>
					fn(mockPrismaService),
			);
			mockPrismaService.user.findUnique
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce({
					did: "did:plc:old123",
					handle: "user.bsky.social",
					displayName: null,
					avatar: null,
					timezone: "UTC",
					timeFormat: "24h",
					createdAt: new Date(),
					updatedAt: new Date(),
				});
			mockPrismaService.user.upsert
				.mockRejectedValueOnce(handleConflictError)
				.mockResolvedValueOnce(mockUser);
			mockPrismaService.user.update.mockResolvedValue({
				did: "did:plc:old123",
				handle: "legacy-did-plc-old123-1234",
				displayName: null,
				avatar: null,
				timezone: "UTC",
				timeFormat: "24h",
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			const result = await service.upsertUser(profile);

			expect(result).toEqual({
				user: mockUser,
				isNewUser: true,
			});
			expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
			expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
				where: { handle: profile.handle },
			});
			expect(mockPrismaService.user.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { did: "did:plc:old123" },
				}),
			);
			expect(mockPrismaService.user.upsert).toHaveBeenCalledTimes(2);
		});

		it("should recover when Prisma reports the conflict as a string target (Prisma 7/Postgres)", async () => {
			const profile = {
				did: "did:plc:new123",
				handle: "user.bsky.social",
				displayName: "New User",
				avatar: null,
			};
			const mockUser = {
				...profile,
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			// Real Prisma 7 / Postgres shape: target is the constraint name string.
			const handleConflictError = {
				code: "P2002",
				meta: { target: "User_handle_key" },
			};

			mockPrismaService.$transaction.mockImplementation(
				async (fn: (tx: typeof mockPrismaService) => unknown) =>
					fn(mockPrismaService),
			);
			mockPrismaService.user.findUnique
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce({
					did: "did:plc:old123",
					handle: "user.bsky.social",
					emailVerifiedAt: null,
					isNativePds: false,
					avatar: null,
				});
			mockPrismaService.user.upsert
				.mockRejectedValueOnce(handleConflictError)
				.mockResolvedValueOnce(mockUser);
			mockPrismaService.user.update.mockResolvedValue({});

			const result = await service.upsertUser(profile);

			expect(result).toEqual({ user: mockUser, isNewUser: true });
			expect(mockPrismaService.user.upsert).toHaveBeenCalledTimes(2);
		});
	});

	describe("parseOAuthAppState", () => {
		it("should parse valid state payload", () => {
			expect(
				service.parseOAuthAppState(
					'{"platform":"mobile","timezone":"Europe/London"}',
				),
			).toEqual({
				platform: "mobile",
				timezone: "Europe/London",
			});
		});

		it("should return empty state for invalid payload", () => {
			expect(service.parseOAuthAppState("not-json")).toEqual({});
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

	describe("cleanupExpiredSessions", () => {
		it("should delete expired auth sessions", async () => {
			mockPrismaService.authSession.deleteMany.mockResolvedValue({ count: 3 });

			await service.cleanupExpiredSessions();

			expect(mockPrismaService.authSession.deleteMany).toHaveBeenCalledWith({
				where: {
					expiresAt: { lt: expect.any(Date) },
				},
			});
		});
	});

	describe("touchSession", () => {
		it("should extend expiry when lastUsedAt is stale", async () => {
			mockPrismaService.authSession.update.mockResolvedValue({});
			const stale = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago

			await service.touchSession("session-123", stale);

			expect(mockPrismaService.authSession.update).toHaveBeenCalledWith({
				where: { id: "session-123" },
				data: {
					lastUsedAt: expect.any(Date),
					expiresAt: expect.any(Date),
				},
			});
		});

		it("should not write when lastUsedAt is recent", async () => {
			const recent = new Date(); // within the slide window

			await service.touchSession("session-123", recent);

			expect(mockPrismaService.authSession.update).not.toHaveBeenCalled();
		});

		it("does not log the session credential when the update fails", async () => {
			const sessionId = "sentinel-session-credential";
			const logger = (
				service as unknown as {
					logger: { warn: (...args: unknown[]) => void };
				}
			).logger;
			const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
			mockPrismaService.authSession.update.mockRejectedValue(
				new Error(`database update failed for ${sessionId}`),
			);

			await service.touchSession(
				sessionId,
				new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
			);

			expect(warn).toHaveBeenCalledWith("Failed to touch session");
			expect(JSON.stringify(warn.mock.calls)).not.toContain(sessionId);
		});
	});

	describe("authorize", () => {
		it("should call OAuth client authorize and return URL", async () => {
			const mockUrl = new URL("https://bsky.social/oauth/authorize?state=abc");
			sharedOAuthClient.authorize.mockResolvedValue(mockUrl);

			const result = await service.authorize("user.bsky.social");

			expect(sharedOAuthClient.authorize).toHaveBeenCalledWith(
				"user.bsky.social",
				{
					scope: OAUTH_SCOPE,
					state: JSON.stringify({
						requestedPreferences: {
							blogEnabled: false,
							blueskyEnabled: false,
						},
						accountHandle: "user.bsky.social",
					}),
				},
			);
			expect(result).toBe(mockUrl.toString());
		});

		it("requests the saved cumulative permissions for a returning handle", async () => {
			const mockUrl = new URL("https://pds.example/authorize?state=returning");
			mockPrismaService.user.findUnique.mockResolvedValue({
				did: "did:plc:returning",
				handle: "reader.example",
				blogIntegrationEnabled: true,
				blueskyCrossPostEnabled: true,
				reviewsMirrorFormat: "offprint",
			});
			sharedOAuthClient.authorize.mockResolvedValue(mockUrl);

			await service.authorize("@Reader.Example");

			expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
				where: { handle: "reader.example" },
				select: {
					did: true,
					handle: true,
					blogIntegrationEnabled: true,
					blueskyCrossPostEnabled: true,
					reviewsMirrorFormat: true,
				},
			});
			expect(sharedOAuthClient.authorize).toHaveBeenCalledWith(
				"@Reader.Example",
				expect.objectContaining({
					scope: expect.stringContaining("repo:site.standard.document"),
				}),
			);
			const authorizeOptions =
				sharedOAuthClient.authorize.mock.calls.at(-1)?.[1];
			expect(authorizeOptions.scope).toContain(
				"repo:app.bsky.feed.post?action=create&action=update",
			);
			expect(authorizeOptions.scope).toContain(
				"repo:app.offprint.document.article",
			);
			expect(JSON.parse(authorizeOptions.state)).toEqual({
				requestedPreferences: {
					blogEnabled: true,
					blueskyEnabled: true,
					reviewsMirrorFormat: "offprint",
				},
				accountDid: "did:plc:returning",
				accountHandle: "reader.example",
			});
		});
	});

	describe("callback", () => {
		it("should call the OAuth client and return session + a fresh session id", async () => {
			const mockResult = { session: { did: "did:plc:abc123" }, state: "xyz" };
			sharedOAuthClient.callback.mockResolvedValue(mockResult);

			const params = new URLSearchParams("code=abc&state=xyz");
			const result = await service.callback(params);

			expect(sharedOAuthClient.callback).toHaveBeenCalledWith(params);
			expect(result.session).toEqual(mockResult.session);
			expect(result.state).toBe("xyz");
			// A new opaque per-device id is minted for the cookie.
			expect(typeof result.sessionId).toBe("string");
			expect(result.sessionId.length).toBeGreaterThan(0);
		});

		it("accepts granted scopes exposed through the OAuth session token info", async () => {
			const resolvedCoreScope = [
				"atproto",
				"blob:image/jpeg",
				"blob:image/png",
				"blob:image/webp",
				...[
					"movie",
					"episode",
					"list",
					"list.item",
					"library.item",
					"follow",
					"profile",
					"note",
					"review",
					"review.like",
					"rating",
				].flatMap((name) =>
					["create", "update", "delete"].map(
						(action) => `repo:xyz.opnshelf.${name}?action=${action}`,
					),
				),
			].join(" ");
			const getTokenInfo = vi
				.fn()
				.mockResolvedValue({ scope: resolvedCoreScope });

			await expect(
				service.assertGrantedScopes({ getTokenInfo }, {}),
			).resolves.toBeUndefined();

			expect(getTokenInfo).toHaveBeenCalledWith(false);
		});

		it("accepts Core repo permissions canonicalized by the Bluesky PDS", async () => {
			const blueskyCoreScope = [
				"atproto",
				"blob:image/jpeg",
				"blob:image/png",
				"blob:image/webp",
				"repo:xyz.opnshelf.movie",
				"repo:xyz.opnshelf.episode",
				"repo:xyz.opnshelf.list",
				"repo:xyz.opnshelf.list.item",
				"repo:xyz.opnshelf.library.item",
				"repo:xyz.opnshelf.follow",
				"repo:xyz.opnshelf.profile",
				"repo:xyz.opnshelf.note",
				"repo:xyz.opnshelf.review",
				"repo:xyz.opnshelf.review.like",
				"repo:xyz.opnshelf.rating",
			].join(" ");

			await expect(
				service.assertGrantedScopes(
					{
						getTokenInfo: vi.fn().mockResolvedValue({
							scope: blueskyCoreScope,
						}),
					},
					{},
				),
			).resolves.toBeUndefined();
		});
	});

	describe("restore", () => {
		it("should restore the freshest live session for the DID", async () => {
			const mockSession = { did: "did:plc:abc123" };
			mockPrismaService.authSession.findFirst.mockResolvedValue({
				id: "slot-1",
				userDid: "did:plc:abc123",
				kind: "oauth",
				sessionData: "{}",
			});
			sharedOAuthClient.restore.mockResolvedValue(mockSession);

			const result = await service.restore("did:plc:abc123");

			expect(mockPrismaService.authSession.findFirst).toHaveBeenCalled();
			expect(sharedOAuthClient.restore).toHaveBeenCalledWith("did:plc:abc123");
			expect(result).toEqual(mockSession);
		});

		it("should return undefined when there is no live session", async () => {
			mockPrismaService.authSession.findFirst.mockResolvedValue(null);

			const result = await service.restore("did:plc:abc123");

			expect(result).toBeUndefined();
		});

		it("should return undefined when the client restore fails", async () => {
			mockPrismaService.authSession.findFirst.mockResolvedValue({
				id: "slot-1",
				userDid: "did:plc:abc123",
				kind: "oauth",
				sessionData: "{}",
			});
			sharedOAuthClient.restore.mockRejectedValue(
				new Error("Session not found"),
			);

			const result = await service.restore("did:plc:abc123");

			expect(result).toBeUndefined();
		});
	});

	describe("restoreBySession", () => {
		it("reuses one credential session manager for repeated requests from a device", async () => {
			mockPrismaService.authSession.upsert.mockResolvedValue({});
			const record = {
				id: "credential-slot-1",
				userDid: "did:plc:abc123",
				kind: "credential",
				sessionData: JSON.stringify({
					did: "did:plc:abc123",
					handle: "alice.opnshelf.social",
					accessJwt: "stale-access",
					refreshJwt: "stale-refresh",
					active: true,
					pdsUrl: "https://opnshelf.social",
				}),
			};

			const first = await service.restoreBySession(record);
			const second = await service.restoreBySession(record);

			expect(CredentialSession).toHaveBeenCalledTimes(1);
			expect(
				credentialSessionHarness.instances[0]?.resumeSession,
			).toHaveBeenCalledTimes(1);
			expect(second).toBe(first);
		});

		it("does not log the session credential when a credential session expires", async () => {
			const sessionId = "sentinel-credential-slot";
			const did = "did:plc:abc123";
			const logger = (
				service as unknown as {
					logger: { warn: (...args: unknown[]) => void };
				}
			).logger;
			const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
			mockPrismaService.authSession.upsert.mockResolvedValue({});
			mockPrismaService.authSession.deleteMany.mockResolvedValue({ count: 1 });
			const record = {
				id: sessionId,
				userDid: did,
				kind: "credential",
				sessionData: JSON.stringify({
					did,
					handle: "alice.opnshelf.social",
					accessJwt: "stale-access",
					refreshJwt: "stale-refresh",
					active: true,
					pdsUrl: "https://opnshelf.social",
				}),
			};

			await service.restoreBySession(record);
			credentialSessionHarness.instances[0]?.persistSession("expired");

			expect(warn).toHaveBeenCalledWith(
				`Credential session expired for ${did}; revoking device session`,
			);
			expect(JSON.stringify(warn.mock.calls)).not.toContain(sessionId);
		});
	});

	describe("hasBlueskyProfile", () => {
		it("should return true when the repo has an app.bsky.actor.profile/self record", async () => {
			const { Agent } = (await import("@atproto/api")) as unknown as {
				Agent: Mock;
			};
			const mockGetRecord = vi.fn().mockResolvedValue({
				data: { uri: "at://did:plc:abc123/app.bsky.actor.profile/self" },
			});

			Agent.mockImplementation(() => ({
				com: {
					atproto: {
						repo: { describeRepo: vi.fn(), getRecord: mockGetRecord },
					},
				},
				getProfile: vi.fn(),
			}));

			await expect(
				service.hasBlueskyProfile({ did: "did:plc:abc123" }),
			).resolves.toBe(true);
			expect(mockGetRecord).toHaveBeenCalledWith({
				repo: "did:plc:abc123",
				collection: "app.bsky.actor.profile",
				rkey: "self",
			});
		});

		it("should return false when the profile record does not exist", async () => {
			const { Agent } = (await import("@atproto/api")) as unknown as {
				Agent: Mock;
			};
			const mockGetRecord = vi
				.fn()
				.mockRejectedValue(new Error("RecordNotFound"));

			Agent.mockImplementation(() => ({
				com: {
					atproto: {
						repo: { describeRepo: vi.fn(), getRecord: mockGetRecord },
					},
				},
				getProfile: vi.fn(),
			}));

			await expect(
				service.hasBlueskyProfile({ did: "did:plc:abc123" }),
			).resolves.toBe(false);
		});

		it("should return false when there is no session", async () => {
			await expect(service.hasBlueskyProfile(undefined)).resolves.toBe(false);
		});
	});

	describe("fetchProfile", () => {
		it("should fetch the canonical handle from the repo and profile extras from appview", async () => {
			const { Agent } = (await import("@atproto/api")) as unknown as {
				Agent: Mock;
			};
			const mockDescribeRepo = vi.fn().mockResolvedValue({
				data: {
					handle: "user.custom-domain.test",
				},
			});
			const mockGetProfile = vi.fn().mockResolvedValue({
				data: {
					handle: "handle.invalid",
					displayName: "Test User",
					avatar: "https://example.com/avatar.jpg",
				},
			});
			const mockWithProxy = vi
				.fn()
				.mockReturnValue({ getProfile: mockGetProfile });
			Agent.mockImplementation(() => ({
				com: {
					atproto: {
						repo: {
							describeRepo: mockDescribeRepo,
						},
					},
				},
				getProfile: mockGetProfile,
				withProxy: mockWithProxy,
			}));

			const mockSession = { did: "did:plc:abc123" };
			const result = await service.fetchProfile(mockSession);

			expect(result).toEqual({
				did: "did:plc:abc123",
				handle: "user.custom-domain.test",
				displayName: "Test User",
				avatar: "https://example.com/avatar.jpg",
			});
			expect(mockDescribeRepo).toHaveBeenCalledWith({ repo: "did:plc:abc123" });
			expect(mockWithProxy).toHaveBeenCalledWith(
				"bsky_appview",
				"did:web:api.bsky.app",
			);
			expect(mockGetProfile).toHaveBeenCalledWith({ actor: "did:plc:abc123" });
		});

		it("should handle missing displayName and avatar", async () => {
			const { Agent } = (await import("@atproto/api")) as unknown as {
				Agent: Mock;
			};
			const mockDescribeRepo = vi.fn().mockResolvedValue({
				data: {
					handle: "user.bsky.social",
				},
			});
			const mockGetProfile = vi.fn().mockResolvedValue({
				data: {
					handle: "handle.invalid",
				},
			});
			Agent.mockImplementation(() => ({
				com: {
					atproto: {
						repo: {
							describeRepo: mockDescribeRepo,
						},
					},
				},
				getProfile: mockGetProfile,
				withProxy: vi.fn().mockReturnValue({ getProfile: mockGetProfile }),
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

		it("should still return the repo handle if the appview profile fetch fails", async () => {
			const { Agent } = (await import("@atproto/api")) as unknown as {
				Agent: Mock;
			};
			const mockDescribeRepo = vi.fn().mockResolvedValue({
				data: {
					handle: "user.custom-domain.test",
				},
			});
			const mockGetProfile = vi
				.fn()
				.mockRejectedValue(new Error("profile fetch failed"));
			Agent.mockImplementation(() => ({
				com: {
					atproto: {
						repo: {
							describeRepo: mockDescribeRepo,
						},
					},
				},
				getProfile: mockGetProfile,
				withProxy: vi.fn().mockReturnValue({ getProfile: mockGetProfile }),
			}));

			const mockSession = { did: "did:plc:abc123" };
			const result = await service.fetchProfile(mockSession);

			expect(result).toEqual({
				did: "did:plc:abc123",
				handle: "user.custom-domain.test",
				displayName: null,
				avatar: null,
			});
		});
	});

	describe("OAUTH_SCOPE", () => {
		it("should have the correct OAuth scope for app functionality", () => {
			// The OAUTH_SCOPE constant should include:
			// - atproto: base AT Protocol access
			// - repo:xyz.opnshelf.movie: write movie records
			// - repo:xyz.opnshelf.episode: write episode records
			// - repo:xyz.opnshelf.list: write list records
			// - repo:xyz.opnshelf.list.item: write list item records
			// - repo:xyz.opnshelf.library.item: write owned-copy (Library) records
			// - repo:xyz.opnshelf.follow: write follow records
			// - repo:xyz.opnshelf.profile: write profile records
			// - repo:xyz.opnshelf.note: write note records
			// - blob:*/*: upload profile images
			// - rpc:app.bsky.actor.getProfile: fetch user profiles via Bluesky AppView
			expect(OAUTH_SCOPE).toContain("blob:image/jpeg");
			expect(OAUTH_SCOPE).not.toContain("site.standard.document");
			expect(OAUTH_SCOPE).not.toContain("app.bsky.feed.post");
		});
	});
});
