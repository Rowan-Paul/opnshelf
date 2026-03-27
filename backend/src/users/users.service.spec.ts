import {
	BadGatewayException,
	BadRequestException,
	NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
	FetchTraktPublicHistoryResponseDto,
	ImportHistoryResponseDto,
	NormalizedImportItemDto,
	StartTraktImportResponseDto,
	TraktImportJobDto,
} from "./dto/import-history.dto";
import type { ListsService } from "../lists/lists.service";
import type { MoviesService } from "../movies/movies.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { ShowsService } from "../shows/shows.service";

jest.mock("./profile.service", () => ({
	ProfileService: class MockProfileService {},
}));

import type { ImportHistoryService } from "./import-history.service";
import type { ProfileService } from "./profile.service";
import type { UserDeletionService } from "./user-deletion.service";
import { UsersService } from "./users.service";

type MockImportHistoryService = {
	fetchTraktPublicHistory: jest.MockedFunction<
		(
			username: string,
			maxItems?: number,
		) => Promise<FetchTraktPublicHistoryResponseDto>
	>;
	startTraktImport: jest.MockedFunction<
		(userDid: string, username: string) => Promise<StartTraktImportResponseDto>
	>;
	getCurrentTraktImport: jest.MockedFunction<
		(userDid: string) => Promise<TraktImportJobDto | null>
	>;
	importNormalizedItems: jest.MockedFunction<
		(
			userDid: string,
			session: { did: string },
			items: NormalizedImportItemDto[],
		) => Promise<ImportHistoryResponseDto>
	>;
};

describe("UsersService", () => {
	let service: UsersService;
	let importHistoryService: MockImportHistoryService;

	const prisma = {
		user: {
			findUnique: jest.fn(),
			findMany: jest.fn(),
			update: jest.fn(),
		},
		follow: {
			findMany: jest.fn(),
			createMany: jest.fn(),
		},
		trackedMovie: {
			findFirst: jest.fn(),
		},
		trackedEpisode: {
			findFirst: jest.fn(),
		},
	} as unknown as PrismaService;

	const moviesService = {
		markWatched: jest.fn(),
		indexTrackedMovie: jest.fn(),
	} as unknown as MoviesService;

	const showsService = {
		markEpisodeWatched: jest.fn(),
		indexTrackedEpisode: jest.fn(),
	} as unknown as ShowsService;

	const configService = {
		get: jest.fn((key: string) => {
			if (key === "TRAKT_API_KEY") return "trakt-key";
			return undefined;
		}),
	} as unknown as ConfigService;

	const userDeletionService = {
		deleteUserSync: jest.fn(),
		createDeletionJob: jest.fn(),
		getCurrentDeletionJob: jest.fn(),
	} as unknown as UserDeletionService;

	const profileService = {
		updateProfile: jest.fn(),
		seedProfileForNewUser: jest.fn(),
		deleteAvatar: jest.fn(),
		deleteProfileRecordIndex: jest.fn(),
		streamAvatar: jest.fn(),
	} as unknown as ProfileService;

	const listsService = {
		hasAllDefaultLists: jest.fn(),
		provisionDefaultLists: jest.fn(),
	} as unknown as ListsService;

	beforeEach(() => {
		jest.clearAllMocks();
		importHistoryService = {
			fetchTraktPublicHistory: jest.fn(),
			startTraktImport: jest.fn(),
			getCurrentTraktImport: jest.fn(),
			importNormalizedItems: jest.fn(),
		};
		(listsService.hasAllDefaultLists as jest.Mock).mockResolvedValue(true);
		service = new UsersService(
			prisma,
			importHistoryService as unknown as ImportHistoryService,
			userDeletionService,
			profileService,
			listsService,
		);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("completes onboarding for an existing user", async () => {
		prisma.user.findUnique = jest
			.fn()
			.mockResolvedValue({ did: "did:plc:123" });
		prisma.user.update = jest.fn().mockResolvedValue({
			onboardingCompletedAt: new Date("2026-03-03T12:00:00.000Z"),
		});

		await expect(service.completeOnboarding("did:plc:123")).resolves.toEqual({
			onboardingCompletedAt: "2026-03-03T12:00:00.000Z",
			needsOnboarding: false,
		});
	});

	it("throws when completing onboarding for missing user", async () => {
		prisma.user.findUnique = jest.fn().mockResolvedValue(null);

		await expect(service.completeOnboarding("did:plc:missing")).rejects.toThrow(
			NotFoundException,
		);
	});

	it("updates user profile display name", async () => {
		prisma.user.findUnique = jest
			.fn()
			.mockResolvedValue({ did: "did:plc:123" });
		(profileService.updateProfile as jest.Mock).mockResolvedValue({
			displayName: "Updated User",
			avatar: "https://example.com/avatar.jpg",
		});
		const session = { did: "did:plc:123" };

		await expect(
			service.updateUserProfile("did:plc:123", session, {
				displayName: "Updated User",
			}),
		).resolves.toEqual({
			displayName: "Updated User",
			avatar: "https://example.com/avatar.jpg",
		});
		expect(profileService.updateProfile).toHaveBeenCalledWith(
			"did:plc:123",
			session,
			{
				displayName: "Updated User",
			},
		);
		expect(listsService.hasAllDefaultLists).toHaveBeenCalledWith("did:plc:123");
		expect(listsService.provisionDefaultLists).not.toHaveBeenCalled();
	});

	it("throws when updating profile for missing user", async () => {
		prisma.user.findUnique = jest.fn().mockResolvedValue(null);

		await expect(
			service.updateUserProfile(
				"did:plc:missing",
				{ did: "did:plc:missing" },
				{ displayName: "Nope" },
			),
		).rejects.toThrow(NotFoundException);
	});

	it("uploads a user avatar through the profile service", async () => {
		prisma.user.findUnique = jest
			.fn()
			.mockResolvedValue({ did: "did:plc:123" });
		(profileService.updateProfile as jest.Mock).mockResolvedValue({
			displayName: "Updated User",
			avatar: "https://example.com/avatar.jpg",
		});
		const session = { did: "did:plc:123" };
		const file = {
			buffer: Buffer.from("avatar"),
			mimetype: "image/png",
			size: 6,
		};

		await expect(
			service.uploadUserAvatar("did:plc:123", session, file),
		).resolves.toEqual({
			displayName: "Updated User",
			avatar: "https://example.com/avatar.jpg",
		});
		expect(profileService.updateProfile).toHaveBeenCalledWith(
			"did:plc:123",
			session,
			{
				avatar: file,
			},
		);
		expect(listsService.provisionDefaultLists).not.toHaveBeenCalled();
	});

	it("deletes a user avatar through the profile service", async () => {
		prisma.user.findUnique = jest
			.fn()
			.mockResolvedValue({ did: "did:plc:123" });
		(profileService.deleteAvatar as jest.Mock).mockResolvedValue({
			displayName: "Updated User",
			avatar: null,
		});
		const session = { did: "did:plc:123" };

		await expect(
			service.deleteUserAvatar("did:plc:123", session),
		).resolves.toEqual({
			displayName: "Updated User",
			avatar: null,
		});
		expect(profileService.deleteAvatar).toHaveBeenCalledWith(
			"did:plc:123",
			session,
		);
		expect(listsService.provisionDefaultLists).not.toHaveBeenCalled();
	});

	it("provisions default lists after the first profile save", async () => {
		prisma.user.findUnique = jest
			.fn()
			.mockResolvedValueOnce({ did: "did:plc:first" })
			.mockResolvedValueOnce({ profileRkey: null });
		(listsService.hasAllDefaultLists as jest.Mock).mockResolvedValue(false);
		(profileService.updateProfile as jest.Mock).mockResolvedValue({
			displayName: "First User",
			avatar: null,
		});
		(listsService.provisionDefaultLists as jest.Mock).mockResolvedValue([]);

		await expect(
			service.updateUserProfile("did:plc:first", { did: "did:plc:first" }, {}),
		).resolves.toEqual({
			displayName: "First User",
			avatar: null,
		});

		expect(listsService.provisionDefaultLists).toHaveBeenCalledWith(
			"did:plc:first",
			{ did: "did:plc:first" },
		);
		expect(profileService.deleteProfileRecordIndex).not.toHaveBeenCalled();
	});

	it("rolls back the local profile index if default list provisioning fails on first save", async () => {
		prisma.user.findUnique = jest
			.fn()
			.mockResolvedValueOnce({ did: "did:plc:first" })
			.mockResolvedValueOnce({ profileRkey: null });
		(listsService.hasAllDefaultLists as jest.Mock).mockResolvedValue(false);
		(profileService.updateProfile as jest.Mock).mockResolvedValue({
			displayName: "First User",
			avatar: null,
		});
		(listsService.provisionDefaultLists as jest.Mock).mockRejectedValue(
			new Error("pds list failure"),
		);

		await expect(
			service.updateUserProfile("did:plc:first", { did: "did:plc:first" }, {}),
		).rejects.toThrow("pds list failure");

		expect(profileService.deleteProfileRecordIndex).toHaveBeenCalledWith(
			"did:plc:first",
		);
	});

	it("initializes the seeded profile and default lists for a new user", async () => {
		prisma.user.findUnique = jest.fn().mockResolvedValue({ profileRkey: null });
		(listsService.hasAllDefaultLists as jest.Mock).mockResolvedValue(false);
		(profileService.seedProfileForNewUser as jest.Mock).mockResolvedValue(
			undefined,
		);
		(listsService.provisionDefaultLists as jest.Mock).mockResolvedValue([]);

		await expect(
			service.initializeProfileForNewUser(
				"did:plc:new123",
				{ did: "did:plc:new123" },
				{
					handle: "new-user.bsky.social",
					displayName: "New User",
					avatarUrl: "https://example.com/avatar.jpg",
				},
			),
		).resolves.toBeUndefined();

		expect(profileService.seedProfileForNewUser).toHaveBeenCalledWith(
			"did:plc:new123",
			{ did: "did:plc:new123" },
			{
				handle: "new-user.bsky.social",
				displayName: "New User",
				avatarUrl: "https://example.com/avatar.jpg",
			},
		);
		expect(listsService.provisionDefaultLists).toHaveBeenCalledWith(
			"did:plc:new123",
			{ did: "did:plc:new123" },
		);
	});

	it("returns a public profile by normalized handle", async () => {
		prisma.user.findUnique = jest.fn().mockResolvedValue({
			did: "did:plc:123",
			handle: "alice.bsky.social",
			displayName: "Alice",
			avatar: "https://example.com/alice.jpg",
			_count: {
				followers: 4,
				following: 7,
			},
		});

		await expect(
			service.getPublicProfileByHandle(" @Alice.Bsky.Social "),
		).resolves.toEqual({
			did: "did:plc:123",
			handle: "alice.bsky.social",
			displayName: "Alice",
			avatar: "https://example.com/alice.jpg",
			followersCount: 4,
			followingCount: 7,
		});
		expect(prisma.user.findUnique).toHaveBeenCalledWith({
			where: { handle: "alice.bsky.social" },
			select: {
				did: true,
				handle: true,
				displayName: true,
				avatar: true,
				_count: {
					select: {
						followers: true,
						following: true,
					},
				},
			},
		});
	});

	it("returns public profile counts from follow aggregates", async () => {
		prisma.user.findUnique = jest.fn().mockResolvedValue({
			did: "did:plc:123",
			handle: "alice.bsky.social",
			displayName: "Alice",
			avatar: "https://example.com/alice.jpg",
			_count: {
				followers: 11,
				following: 3,
			},
		});

		await expect(
			service.getPublicProfileByHandle("alice.bsky.social"),
		).resolves.toMatchObject({
			followersCount: 11,
			followingCount: 3,
		});
	});

	it("delegates synchronous account deletion", async () => {
		(userDeletionService.deleteUserSync as jest.Mock).mockResolvedValue(
			undefined,
		);

		await expect(
			service.deleteUserSync("did:plc:123"),
		).resolves.toBeUndefined();
		expect(userDeletionService.deleteUserSync).toHaveBeenCalledWith(
			"did:plc:123",
		);
	});

	it("delegates async deletion job creation", async () => {
		const mockJob = { id: "job-1", status: "queued" };
		(userDeletionService.createDeletionJob as jest.Mock).mockResolvedValue(
			mockJob,
		);

		await expect(
			service.createDeletionJob("did:plc:123", true),
		).resolves.toEqual(mockJob);
		expect(userDeletionService.createDeletionJob).toHaveBeenCalledWith(
			"did:plc:123",
			true,
		);
	});

	it("imports Bluesky follows with pagination and creates only missing local follows", async () => {
		prisma.user.findUnique = jest
			.fn()
			.mockResolvedValueOnce({ did: "did:plc:self" });
		prisma.user.findMany = jest
			.fn()
			.mockResolvedValue([
				{ did: "did:plc:friend-1" },
				{ did: "did:plc:friend-2" },
			]);
		prisma.follow.findMany = jest
			.fn()
			.mockResolvedValue([{ followingDid: "did:plc:friend-2" }]);
		prisma.follow.createMany = jest.fn().mockResolvedValue({ count: 1 });

		global.fetch = jest
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				statusText: "OK",
				json: async () => ({
					cursor: "cursor-2",
					follows: [{ did: "did:plc:friend-1" }, { did: "did:plc:friend-2" }],
				}),
			})
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				statusText: "OK",
				json: async () => ({
					follows: [{ did: "did:plc:self" }, { did: "did:plc:off-app" }],
				}),
			}) as unknown as typeof fetch;

		await expect(service.importBlueskyFollows("did:plc:self")).resolves.toEqual(
			{
				scannedCount: 4,
				matchedCount: 2,
				createdCount: 1,
				alreadyFollowingCount: 1,
			},
		);

		expect(prisma.user.findMany).toHaveBeenCalledWith({
			where: {
				did: {
					in: ["did:plc:friend-1", "did:plc:friend-2", "did:plc:off-app"],
				},
			},
			select: { did: true },
		});
		expect(prisma.follow.createMany).toHaveBeenCalledWith({
			data: [
				{
					followerDid: "did:plc:self",
					followingDid: "did:plc:friend-1",
				},
			],
			skipDuplicates: true,
		});
	});

	it("returns zero counts when no Bluesky follows match OpnShelf users", async () => {
		prisma.user.findUnique = jest
			.fn()
			.mockResolvedValueOnce({ did: "did:plc:self" });
		prisma.user.findMany = jest.fn().mockResolvedValue([]);
		prisma.follow.findMany = jest.fn().mockResolvedValue([]);
		prisma.follow.createMany = jest.fn();

		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 200,
			statusText: "OK",
			json: async () => ({
				follows: [{ did: "did:plc:off-app" }],
			}),
		}) as unknown as typeof fetch;

		await expect(service.importBlueskyFollows("did:plc:self")).resolves.toEqual(
			{
				scannedCount: 1,
				matchedCount: 0,
				createdCount: 0,
				alreadyFollowingCount: 0,
			},
		);
		expect(prisma.follow.createMany).not.toHaveBeenCalled();
	});

	it("maps Bluesky fetch failures to a gateway error", async () => {
		prisma.user.findUnique = jest
			.fn()
			.mockResolvedValueOnce({ did: "did:plc:self" });

		global.fetch = jest.fn().mockResolvedValue({
			ok: false,
			status: 503,
			statusText: "Service Unavailable",
		}) as unknown as typeof fetch;

		await expect(service.importBlueskyFollows("did:plc:self")).rejects.toThrow(
			BadGatewayException,
		);
	});

	it("throws when public profile handle is missing", async () => {
		prisma.user.findUnique = jest.fn().mockResolvedValue(null);

		await expect(
			service.getPublicProfileByHandle("nobody.bsky.social"),
		).rejects.toThrow(NotFoundException);
	});

	it("delegates Trakt history fetching to the import history service", async () => {
		importHistoryService.fetchTraktPublicHistory.mockResolvedValue({
			profile: {
				username: "alice",
				slug: "alice",
				name: "Alice Example",
				isPrivate: false,
				isVip: true,
				avatarUrl: "https://example.com/avatar-medium.jpg",
			},
			importableCount: 2,
			previewItems: [],
			items: [],
			skipped: [],
			sourceCount: 2,
		});

		await expect(
			service.fetchTraktPublicHistory("alice", 100),
		).resolves.toEqual({
			profile: {
				username: "alice",
				slug: "alice",
				name: "Alice Example",
				isPrivate: false,
				isVip: true,
				avatarUrl: "https://example.com/avatar-medium.jpg",
			},
			importableCount: 2,
			previewItems: [],
			items: [],
			skipped: [],
			sourceCount: 2,
		});
		expect(importHistoryService.fetchTraktPublicHistory).toHaveBeenCalledWith(
			"alice",
			100,
		);
	});

	it("delegates Trakt history fetching without a max item limit", async () => {
		importHistoryService.fetchTraktPublicHistory.mockResolvedValue({
			profile: {
				username: "rpf_2001",
				slug: "rpf_2001",
				name: undefined,
				isPrivate: false,
				isVip: false,
				avatarUrl: undefined,
			},
			importableCount: 100,
			previewItems: [],
			items: [],
			skipped: [],
			sourceCount: 100,
		});

		await expect(
			service.fetchTraktPublicHistory("rpf_2001"),
		).resolves.toMatchObject({
			importableCount: 100,
			sourceCount: 100,
		});
		expect(importHistoryService.fetchTraktPublicHistory).toHaveBeenCalledWith(
			"rpf_2001",
			undefined,
		);
	});

	it("starts a background Trakt import for an existing user", async () => {
		prisma.user.findUnique = jest
			.fn()
			.mockResolvedValue({ did: "did:plc:abc" });
		importHistoryService.startTraktImport.mockResolvedValue({
			profile: {
				username: "alice",
				slug: "alice",
				name: "Alice Example",
				isPrivate: false,
				isVip: false,
				avatarUrl: "https://example.com/avatar.jpg",
			},
			previewItems: [],
			sourcePreviewCount: 25,
			job: {
				id: "job-1",
				traktUsername: "alice",
				status: "queued",
				currentPage: 1,
				sourceCount: 0,
				normalizedCount: 0,
				importedCount: 0,
				skippedCount: 0,
				failedCount: 0,
				nextRunAt: "2026-03-23T18:00:00.000Z",
				createdAt: "2026-03-23T18:00:00.000Z",
				updatedAt: "2026-03-23T18:00:00.000Z",
			},
		});

		await expect(
			service.startTraktImport("did:plc:abc", "alice"),
		).resolves.toMatchObject({
			job: {
				id: "job-1",
				status: "queued",
			},
		});
		expect(importHistoryService.startTraktImport).toHaveBeenCalledWith(
			"did:plc:abc",
			"alice",
		);
	});

	it("gets the current Trakt import for an existing user", async () => {
		prisma.user.findUnique = jest
			.fn()
			.mockResolvedValue({ did: "did:plc:abc" });
		importHistoryService.getCurrentTraktImport.mockResolvedValue({
			id: "job-1",
			traktUsername: "alice",
			status: "running",
			currentPage: 2,
			totalPages: 5,
			sourceCount: 100,
			normalizedCount: 90,
			importedCount: 88,
			skippedCount: 2,
			failedCount: 0,
			nextRunAt: "2026-03-23T18:00:00.000Z",
			createdAt: "2026-03-23T18:00:00.000Z",
			updatedAt: "2026-03-23T18:01:00.000Z",
		});

		await expect(
			service.getCurrentTraktImport("did:plc:abc"),
		).resolves.toMatchObject({
			id: "job-1",
			status: "running",
		});
		expect(importHistoryService.getCurrentTraktImport).toHaveBeenCalledWith(
			"did:plc:abc",
		);
	});

	it("delegates normalized history imports", async () => {
		const items = [
			{
				type: "movie" as const,
				movieTmdbId: 10,
				watchedAt: "2026-01-01T00:00:00.000Z",
			},
			{
				type: "movie" as const,
				movieTmdbId: 10,
				watchedAt: "2026-01-02T00:00:00.000Z",
			},
		];
		importHistoryService.importNormalizedItems.mockResolvedValue({
			imported: 2,
			skipped: 0,
			failed: 0,
			errors: [],
		});

		await expect(
			service.importNormalizedItems(
				"did:plc:abc",
				{ did: "did:plc:abc" },
				items,
			),
		).resolves.toEqual({
			imported: 2,
			skipped: 0,
			failed: 0,
			errors: [],
		});
		expect(importHistoryService.importNormalizedItems).toHaveBeenCalledWith(
			"did:plc:abc",
			{ did: "did:plc:abc" },
			items,
		);
	});

	it("propagates normalized history import failures", async () => {
		const error = new BadRequestException("Too many items");
		importHistoryService.importNormalizedItems.mockRejectedValue(error);

		await expect(
			service.importNormalizedItems("did:plc:abc", { did: "did:plc:abc" }, []),
		).rejects.toThrow(error);
	});
});
