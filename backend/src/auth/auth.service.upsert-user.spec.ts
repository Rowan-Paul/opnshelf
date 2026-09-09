import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";

// Mock PrismaService before importing AuthService
vi.mock("../prisma/prisma.service", () => ({
	PrismaService: vi.fn(),
}));

// Mock @atproto modules to prevent import errors
vi.mock("@atproto/oauth-client-node", () => ({}));
vi.mock("@atproto/api", () => ({}));

import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";
import { DeviceSessionsService } from "./device-sessions.service";
import { OAuthClientFactory } from "./oauth-client.factory";

/**
 * upsertUser is the one place a sign-in writes the User row, and its
 * heal-on-relogin and handle-collision rules are dense enough to earn their
 * own file. The rest of AuthService is covered in auth.service.spec.ts.
 */
describe("AuthService.upsertUser", () => {
	let service: AuthService;

	const mockPrismaService = {
		$transaction: vi.fn(),
		user: {
			findUnique: vi.fn(),
			update: vi.fn(),
			upsert: vi.fn(),
		},
	};

	const mockConfigService = {
		get: vi.fn(),
	};

	beforeEach(async () => {
		vi.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AuthService,
				{ provide: PrismaService, useValue: mockPrismaService },
				{ provide: ConfigService, useValue: mockConfigService },
				{ provide: OAuthClientFactory, useValue: {} },
				{ provide: DeviceSessionsService, useValue: {} },
			],
		}).compile();

		service = module.get<AuthService>(AuthService);
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
				handle: "jane.opnshelf.social",
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
				handle: "jane.opnshelf.social",
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

		it("should recover when the Postgres adapter nests the constraint fields", async () => {
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
			const handleConflictError = {
				code: "P2002",
				meta: {
					driverAdapterError: {
						cause: {
							kind: "UniqueConstraintViolation",
							constraint: { fields: ["handle"] },
						},
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
					handle: profile.handle,
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
			expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
			expect(mockPrismaService.user.update).toHaveBeenCalledWith(
				expect.objectContaining({ where: { did: "did:plc:old123" } }),
			);
			expect(mockPrismaService.user.upsert).toHaveBeenCalledTimes(2);
		});
	});
});
