import type { Mock } from "vitest";
import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";

// Mock PrismaService before importing AuthService
vi.mock("../prisma/prisma.service", () => ({
	PrismaService: vi.fn().mockImplementation(() => ({
		$transaction: vi.fn(),
		$queryRaw: vi.fn(),
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
import { AuthService } from "./auth.service";
import { DeviceSessionsService } from "./device-sessions.service";
import { OAuthClientFactory } from "./oauth-client.factory";
import { OAUTH_SCOPE } from "./oauth-scopes";

describe("AuthService", () => {
	let service: AuthService;

	const mockPrismaService = {
		$transaction: vi.fn(),
		$queryRaw: vi.fn(),
		authSession: {
			findUnique: vi.fn(),
			findFirst: vi.fn(),
			findMany: vi.fn(),
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
		mockPrismaService.$queryRaw.mockResolvedValue([]);
		// Tests that override get() with mockImplementation leak into every later
		// test (clearAllMocks doesn't undo it), so restore the base config here.
		mockConfigService.get.mockImplementation((key: string) => baseConfig[key]);
		credentialSessionHarness.instances.length = 0;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AuthService,
				OAuthClientFactory,
				DeviceSessionsService,
				{ provide: PrismaService, useValue: mockPrismaService },
				{ provide: ConfigService, useValue: mockConfigService },
			],
		}).compile();

		service = module.get<AuthService>(AuthService);

		// Initialize the OAuth client, as Nest does at boot.
		module.get(OAuthClientFactory).onModuleInit();
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

	describe("authorizeWithPds", () => {
		it("asks for the signup form when given prompt=create", async () => {
			sharedOAuthClient.authorize.mockResolvedValue(
				new URL("https://pds.example/authorize"),
			);

			await service.authorizeWithPds(undefined, "create");

			expect(sharedOAuthClient.authorize.mock.calls.at(-1)?.[1].prompt).toBe(
				"create",
			);
		});

		it("omits prompt entirely for sign-in, so the PDS shows its login page", async () => {
			sharedOAuthClient.authorize.mockResolvedValue(
				new URL("https://pds.example/authorize"),
			);

			await service.authorizeWithPds(undefined, undefined);

			expect(
				sharedOAuthClient.authorize.mock.calls.at(-1)?.[1],
			).not.toHaveProperty("prompt");
		});

		it("adds an SSO provider hint to the PDS authorize URL", async () => {
			sharedOAuthClient.authorize.mockResolvedValue(
				new URL("https://pds.example/authorize?request_uri=urn%3Arequest"),
			);

			const url = await service.authorizeWithPds(
				undefined,
				undefined,
				"google",
			);

			expect(new URL(url).searchParams.get("sso")).toBe("google");
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
				"repo?collection=xyz.opnshelf.episode&collection=xyz.opnshelf.follow&collection=xyz.opnshelf.library.item&collection=xyz.opnshelf.list&collection=xyz.opnshelf.list.item&collection=xyz.opnshelf.movie&collection=xyz.opnshelf.note&collection=xyz.opnshelf.profile&collection=xyz.opnshelf.rating&collection=xyz.opnshelf.review&collection=xyz.opnshelf.review.like",
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

	describe("isKnownSession", () => {
		it("is true for the slot minted by an OAuth callback", async () => {
			sharedOAuthClient.callback.mockResolvedValue({
				session: { did: "did:plc:abc123" },
				state: "xyz",
			});

			const { sessionId } = await service.callback(
				new URLSearchParams("code=abc&state=xyz"),
			);

			expect(service.isKnownSession(sessionId)).toBe(true);
		});
	});

	describe("completePermissionChange", () => {
		it("saves the account-wide preferences and drops every other session", async () => {
			const tx = {
				user: { update: vi.fn() },
				authSession: { deleteMany: vi.fn() },
			};
			mockPrismaService.$transaction.mockImplementation(
				async (fn: (tx: unknown) => Promise<void>) => fn(tx),
			);
			const oauthClients = Reflect.get(
				Reflect.get(service, "sessions") as object,
				"oauthClients",
			) as Map<string, unknown>;
			oauthClients.set("retained", {});
			oauthClients.set("superseded", {});

			await service.completePermissionChange("did:plc:abc123", "retained", {
				blogEnabled: true,
				blueskyEnabled: false,
			});

			expect(tx.user.update).toHaveBeenCalledWith({
				where: { did: "did:plc:abc123" },
				data: { blogIntegrationEnabled: true, blueskyCrossPostEnabled: false },
			});
			expect(tx.authSession.deleteMany).toHaveBeenCalledWith({
				where: { userDid: "did:plc:abc123", id: { not: "retained" } },
			});
			expect([...oauthClients.keys()]).toEqual(["retained"]);
		});
	});

	describe("disableIntegration", () => {
		it("clears the saved preference for blog and Bluesky only", async () => {
			await service.disableIntegration("did:plc:abc123", "blog");
			await service.disableIntegration("did:plc:abc123", "bluesky");
			await service.disableIntegration("did:plc:abc123", "atstore");

			expect(mockPrismaService.user.update).toHaveBeenCalledTimes(2);
			expect(mockPrismaService.user.update).toHaveBeenCalledWith({
				where: { did: "did:plc:abc123" },
				data: { blogIntegrationEnabled: false },
			});
			expect(mockPrismaService.user.update).toHaveBeenCalledWith({
				where: { did: "did:plc:abc123" },
				data: { blueskyCrossPostEnabled: false },
			});
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
			const mockGetProfile = vi.fn();
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
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					handle: "handle.invalid",
					displayName: "Test User",
					avatar: "https://example.com/avatar.jpg",
				}),
			});
			vi.stubGlobal("fetch", mockFetch);

			const mockSession = { did: "did:plc:abc123" };
			const result = await service.fetchProfile(mockSession);

			expect(result).toEqual({
				did: "did:plc:abc123",
				handle: "user.custom-domain.test",
				displayName: "Test User",
				avatar: "https://example.com/avatar.jpg",
			});
			expect(mockDescribeRepo).toHaveBeenCalledWith({ repo: "did:plc:abc123" });
			// The profile read must go to the public AppView over plain fetch. Going
			// through the user's OAuth session lets a 401 from the AppView delete the
			// session row that login just created.
			expect(String(mockFetch.mock.calls[0][0])).toBe(
				"https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=did%3Aplc%3Aabc123",
			);
			expect(mockWithProxy).not.toHaveBeenCalled();
			expect(mockGetProfile).not.toHaveBeenCalled();
			vi.unstubAllGlobals();
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
			const mockGetProfile = vi.fn();
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
			vi.stubGlobal(
				"fetch",
				vi.fn().mockResolvedValue({
					ok: true,
					json: async () => ({ handle: "handle.invalid" }),
				}),
			);

			const mockSession = { did: "did:plc:abc123" };
			const result = await service.fetchProfile(mockSession);

			expect(result).toEqual({
				did: "did:plc:abc123",
				handle: "user.bsky.social",
				displayName: null,
				avatar: null,
			});
			vi.unstubAllGlobals();
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
			const mockGetProfile = vi.fn();
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
			vi.stubGlobal(
				"fetch",
				vi.fn().mockResolvedValue({ ok: false, status: 401 }),
			);

			const mockSession = { did: "did:plc:abc123" };
			const result = await service.fetchProfile(mockSession);

			expect(result).toEqual({
				did: "did:plc:abc123",
				handle: "user.custom-domain.test",
				displayName: null,
				avatar: null,
			});
			vi.unstubAllGlobals();
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
