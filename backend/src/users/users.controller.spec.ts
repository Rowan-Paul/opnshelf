import { BadGatewayException, BadRequestException } from "@nestjs/common";
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
		importBlueskyFollows: jest.fn(),
		importNormalizedItems: jest.fn(),
		getPublicProfileByHandle: jest.fn(),
		getUserSettings: jest.fn(),
		updateUserSettings: jest.fn(),
		updateUserProfile: jest.fn(),
		uploadUserAvatar: jest.fn(),
		deleteUserAvatar: jest.fn(),
		streamUserAvatar: jest.fn(),
		deleteUser: jest.fn(),
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
			sourceCount: 0,
		});

		await expect(
			controller.fetchMyTraktPublicHistory({ username: "alice", maxItems: 10 }),
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
			sourceCount: 0,
		});
		expect(usersService.fetchTraktPublicHistory).toHaveBeenCalledWith(
			"alice",
			10,
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

	it("deletes the current account and forwards the PDS deletion flag", async () => {
		usersService.deleteUser.mockResolvedValue(undefined);

		const req = {
			user: { did: "did:plc:abc", session: { did: "did:plc:abc" } },
		} as AuthenticatedRequest;

		await expect(
			controller.deleteMyAccount({ deletePDSData: true }, req),
		).resolves.toBeUndefined();
		expect(usersService.deleteUser).toHaveBeenCalledWith(
			"did:plc:abc",
			{ did: "did:plc:abc" },
			true,
		);
	});

	it("propagates delete-account PDS cleanup failures", async () => {
		usersService.deleteUser.mockRejectedValue(
			new BadGatewayException(
				"Failed to delete OpnShelf data from your PDS. Your account was not deleted.",
			),
		);

		const req = {
			user: { did: "did:plc:abc", session: { did: "did:plc:abc" } },
		} as AuthenticatedRequest;

		await expect(
			controller.deleteMyAccount({ deletePDSData: true }, req),
		).rejects.toThrow(BadGatewayException);
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
