import { BadRequestException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { AuthenticatedRequest } from "../auth/types";

jest.mock("@nestjs/platform-express", () => ({
	FileInterceptor: () => class MockFileInterceptor {},
}));

jest.mock("./users.service", () => ({
	UsersService: class MockUsersService {},
}));

jest.mock("../auth/auth.guard", () => ({
	AuthGuard: class MockAuthGuard {
		canActivate() {
			return true;
		}
	},
}));

import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

describe("UsersController", () => {
	let controller: UsersController;

	const usersService = {
		completeOnboarding: jest.fn(),
		fetchTraktPublicHistory: jest.fn(),
		startTraktImport: jest.fn(),
		getCurrentTraktImport: jest.fn(),
		importBlueskyFollows: jest.fn(),
		importNormalizedItems: jest.fn(),
		getPublicProfileByHandle: jest.fn(),
		getUserSettings: jest.fn(),
		updateUserSettings: jest.fn(),
		updateUserProfile: jest.fn(),
		uploadUserAvatar: jest.fn(),
		deleteUserAvatar: jest.fn(),
		streamUserAvatar: jest.fn(),
		deleteUserSync: jest.fn(),
		createDeletionJob: jest.fn(),
		getCurrentDeletionJob: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();
		const module: TestingModule = await Test.createTestingModule({
			controllers: [UsersController],
			providers: [{ provide: UsersService, useValue: usersService }],
		}).compile();

		controller = module.get<UsersController>(UsersController);
	});

	it("completes onboarding for current user", async () => {
		usersService.completeOnboarding.mockResolvedValue({
			onboardingCompletedAt: "2026-03-03T12:00:00.000Z",
			needsOnboarding: false,
		});

		const req = {
			user: { did: "did:plc:abc", session: {} },
		} as AuthenticatedRequest;

		await expect(controller.completeOnboarding(req)).resolves.toEqual({
			onboardingCompletedAt: "2026-03-03T12:00:00.000Z",
			needsOnboarding: false,
		});
		expect(usersService.completeOnboarding).toHaveBeenCalledWith("did:plc:abc");
	});

	it("fetches public Trakt history", async () => {
		usersService.fetchTraktPublicHistory.mockResolvedValue({
			profile: {
				username: "alice",
				slug: "alice",
				name: "Alice Example",
				isPrivate: false,
				isVip: true,
			},
			importableCount: 0,
			previewItems: [],
			items: [],
			skipped: [],
		});

		await expect(
			controller.fetchMyTraktPublicHistory({ username: "alice" }),
		).resolves.toEqual({
			profile: {
				username: "alice",
				slug: "alice",
				name: "Alice Example",
				isPrivate: false,
				isVip: true,
			},
			importableCount: 0,
			previewItems: [],
			items: [],
			skipped: [],
		});
		expect(usersService.fetchTraktPublicHistory).toHaveBeenCalledWith("alice");
	});

	it("starts a background Trakt import", async () => {
		usersService.startTraktImport.mockResolvedValue({
			profile: {
				username: "alice",
				slug: "alice",
				name: "Alice Example",
				isPrivate: false,
				isVip: true,
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

		const req = {
			user: { did: "did:plc:abc", session: {} },
		} as AuthenticatedRequest;

		await expect(
			controller.startMyTraktImport({ username: "alice" }, req),
		).resolves.toMatchObject({
			job: {
				id: "job-1",
				status: "queued",
			},
		});
		expect(usersService.startTraktImport).toHaveBeenCalledWith(
			"did:plc:abc",
			"alice",
		);
	});

	it("gets the current background Trakt import", async () => {
		usersService.getCurrentTraktImport.mockResolvedValue({
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

		const req = {
			user: { did: "did:plc:abc", session: {} },
		} as AuthenticatedRequest;

		await expect(
			controller.getMyCurrentTraktImport(req),
		).resolves.toMatchObject({
			id: "job-1",
			status: "running",
		});
		expect(usersService.getCurrentTraktImport).toHaveBeenCalledWith(
			"did:plc:abc",
		);
	});

	it("returns a public profile by handle", async () => {
		usersService.getPublicProfileByHandle.mockResolvedValue({
			did: "did:plc:abc",
			handle: "alice.bsky.social",
			displayName: "Alice",
			avatar: "https://example.com/alice.jpg",
			followersCount: 12,
			followingCount: 8,
		});

		await expect(
			controller.getPublicProfile("@alice.bsky.social"),
		).resolves.toEqual({
			did: "did:plc:abc",
			handle: "alice.bsky.social",
			displayName: "Alice",
			avatar: "https://example.com/alice.jpg",
			followersCount: 12,
			followingCount: 8,
		});
		expect(usersService.getPublicProfileByHandle).toHaveBeenCalledWith(
			"@alice.bsky.social",
		);
	});

	it("updates profile for authenticated requests", async () => {
		usersService.updateUserProfile.mockResolvedValue({
			displayName: "New Name",
			avatar: "https://example.com/avatar.jpg",
		});

		const req = {
			user: { did: "did:plc:abc", session: { did: "did:plc:abc" } },
		} as AuthenticatedRequest;

		await expect(
			controller.updateMyProfile({ displayName: "New Name" }, req),
		).resolves.toEqual({
			displayName: "New Name",
			avatar: "https://example.com/avatar.jpg",
		});
		expect(usersService.updateUserProfile).toHaveBeenCalledWith(
			"did:plc:abc",
			{ did: "did:plc:abc" },
			{
				displayName: "New Name",
			},
		);
	});

	it("uploads an avatar for authenticated requests", async () => {
		usersService.uploadUserAvatar.mockResolvedValue({
			displayName: "New Name",
			avatar: "https://example.com/avatar.jpg",
		});

		const req = {
			user: { did: "did:plc:abc", session: { did: "did:plc:abc" } },
		} as AuthenticatedRequest;
		const file = {
			buffer: Buffer.from("avatar"),
			mimetype: "image/png",
			size: 6,
		};

		await expect(controller.uploadMyAvatar(file, req)).resolves.toEqual({
			displayName: "New Name",
			avatar: "https://example.com/avatar.jpg",
		});
		expect(usersService.uploadUserAvatar).toHaveBeenCalledWith(
			"did:plc:abc",
			{ did: "did:plc:abc" },
			file,
		);
	});

	it("rejects avatar upload when the file is missing", async () => {
		const req = {
			user: { did: "did:plc:abc", session: { did: "did:plc:abc" } },
		} as AuthenticatedRequest;

		await expect(controller.uploadMyAvatar(undefined, req)).rejects.toThrow(
			BadRequestException,
		);
	});

	it("deletes an avatar for authenticated requests", async () => {
		usersService.deleteUserAvatar.mockResolvedValue({
			displayName: "New Name",
			avatar: null,
		});

		const req = {
			user: { did: "did:plc:abc", session: { did: "did:plc:abc" } },
		} as AuthenticatedRequest;

		await expect(controller.deleteMyAvatar(req)).resolves.toEqual({
			displayName: "New Name",
			avatar: null,
		});
		expect(usersService.deleteUserAvatar).toHaveBeenCalledWith("did:plc:abc", {
			did: "did:plc:abc",
		});
	});

	it("streams a public avatar by DID and CID", async () => {
		const res = {} as never;

		await expect(
			controller.getAvatar("did:plc:abc", "bafy-avatar", res),
		).resolves.toBeUndefined();
		expect(usersService.streamUserAvatar).toHaveBeenCalledWith(
			"did:plc:abc",
			"bafy-avatar",
			res,
		);
	});

	it("imports Bluesky follows for authenticated requests", async () => {
		usersService.importBlueskyFollows.mockResolvedValue({
			scannedCount: 5,
			matchedCount: 2,
			createdCount: 1,
			alreadyFollowingCount: 1,
		});

		const req = {
			user: { did: "did:plc:abc", session: { did: "did:plc:abc" } },
		} as AuthenticatedRequest;

		await expect(controller.importMyBlueskyFollows(req)).resolves.toEqual({
			scannedCount: 5,
			matchedCount: 2,
			createdCount: 1,
			alreadyFollowingCount: 1,
		});
		expect(usersService.importBlueskyFollows).toHaveBeenCalledWith(
			"did:plc:abc",
		);
	});

	it("imports normalized items for authenticated requests", async () => {
		usersService.importNormalizedItems.mockResolvedValue({
			imported: 1,
			skipped: 0,
			failed: 0,
			errors: [],
		});

		const req = {
			user: { did: "did:plc:abc", session: { did: "did:plc:abc" } },
		} as AuthenticatedRequest;

		await expect(
			controller.importMyHistory(
				{
					items: [
						{
							type: "movie",
							movieTmdbId: 10,
							watchedAt: "2026-01-01T00:00:00.000Z",
						},
					],
				},
				req,
			),
		).resolves.toMatchObject({ imported: 1, skipped: 0, failed: 0 });
	});

	it("deletes the current account synchronously when PDS deletion is not requested", async () => {
		usersService.deleteUserSync.mockResolvedValue(undefined);

		const req = {
			user: { did: "did:plc:abc", session: { did: "did:plc:abc" } },
		} as AuthenticatedRequest;
		const res = { status: jest.fn() } as unknown as import("express").Response;

		const result = await controller.deleteMyAccount(
			{ deletePDSData: false },
			req,
			res,
		);
		expect(result).toBeUndefined();
		expect(usersService.deleteUserSync).toHaveBeenCalledWith("did:plc:abc");
		expect(res.status).toHaveBeenCalledWith(204);
	});

	it("creates an async deletion job when PDS deletion is requested", async () => {
		const mockJob = {
			id: "job-1",
			status: "queued",
			data: {
				deletePdsData: true,
				totalRecords: 10,
				deletedRecords: 0,
			},
			lastError: null,
			createdAt: new Date("2026-03-27T12:00:00.000Z"),
		};
		usersService.createDeletionJob.mockResolvedValue(mockJob);

		const req = {
			user: { did: "did:plc:abc", session: { did: "did:plc:abc" } },
		} as AuthenticatedRequest;
		const res = { status: jest.fn() } as unknown as import("express").Response;

		const result = await controller.deleteMyAccount(
			{ deletePDSData: true },
			req,
			res,
		);
		expect(result).toMatchObject({
			id: "job-1",
			status: "queued",
			totalRecords: 10,
			deletedRecords: 0,
		});
		expect(usersService.createDeletionJob).toHaveBeenCalledWith(
			"did:plc:abc",
			true,
		);
		expect(res.status).toHaveBeenCalledWith(200);
	});

	it("rejects import when session is missing", async () => {
		const req = {
			user: { did: "did:plc:abc", session: undefined },
		} as unknown as AuthenticatedRequest;

		await expect(
			controller.importMyHistory(
				{
					items: [
						{
							type: "movie",
							movieTmdbId: 10,
							watchedAt: "2026-01-01T00:00:00.000Z",
						},
					],
				},
				req,
			),
		).rejects.toThrow(BadRequestException);
	});
});
