import { BadRequestException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { AuthenticatedRequest } from "../auth/types";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

jest.mock("../auth/auth.guard", () => ({
	AuthGuard: class MockAuthGuard {
		canActivate() {
			return true;
		}
	},
}));

describe("UsersController", () => {
	let controller: UsersController;

	const usersService = {
		completeOnboarding: jest.fn(),
		fetchTraktPublicHistory: jest.fn(),
		importNormalizedItems: jest.fn(),
		getPublicProfileByHandle: jest.fn(),
		getUserSettings: jest.fn(),
		updateUserSettings: jest.fn(),
		updateUserProfile: jest.fn(),
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
		});

		await expect(
			controller.getPublicProfile("@alice.bsky.social"),
		).resolves.toEqual({
			did: "did:plc:abc",
			handle: "alice.bsky.social",
			displayName: "Alice",
			avatar: "https://example.com/alice.jpg",
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
		expect(usersService.updateUserProfile).toHaveBeenCalledWith("did:plc:abc", {
			displayName: "New Name",
		});
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
