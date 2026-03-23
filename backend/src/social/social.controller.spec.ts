import { Test, type TestingModule } from "@nestjs/testing";
import type { AuthenticatedRequest } from "../auth/types";

jest.mock("../auth/auth.guard", () => ({
	AuthGuard: class MockAuthGuard {
		canActivate() {
			return true;
		}
	},
}));

import { SocialController } from "./social.controller";
import { SocialService } from "./social.service";

describe("SocialController", () => {
	let controller: SocialController;

	const socialService = {
		searchPeople: jest.fn(),
		follow: jest.fn(),
		unfollow: jest.fn(),
		getRelationship: jest.fn(),
		getFollowers: jest.fn(),
		getFollowing: jest.fn(),
		getFeed: jest.fn(),
		getFollowedActivityFeed: jest.fn(),
		getFollowedWatchers: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			controllers: [SocialController],
			providers: [{ provide: SocialService, useValue: socialService }],
		}).compile();

		controller = module.get<SocialController>(SocialController);
	});

	it("returns followed watchers for a scoped media item", async () => {
		socialService.getFollowedWatchers.mockResolvedValue({
			items: [
				{
					actor: {
						did: "did:plc:friend-1",
						handle: "friend-1",
						displayName: "Friend One",
						avatar: "https://example.com/friend-1.jpg",
					},
					activityAt: "2026-03-03T12:00:00.000Z",
				},
			],
			pageSize: 3,
			total: 1,
		});

		const req = {
			user: { did: "did:plc:self", session: {} },
		} as AuthenticatedRequest;

		await expect(
			controller.getWatchers(req, {
				mediaType: "show",
				mediaId: "show-1:season:1:episode:2",
				pageSize: 3,
			}),
		).resolves.toEqual({
			items: [
				{
					actor: {
						did: "did:plc:friend-1",
						handle: "friend-1",
						displayName: "Friend One",
						avatar: "https://example.com/friend-1.jpg",
					},
					activityAt: "2026-03-03T12:00:00.000Z",
				},
			],
			pageSize: 3,
			total: 1,
		});

		expect(socialService.getFollowedWatchers).toHaveBeenCalledWith(
			"did:plc:self",
			"show",
			"show-1:season:1:episode:2",
			3,
		);
	});

	it("uses the default watcher page size when one is not provided", async () => {
		socialService.getFollowedWatchers.mockResolvedValue({
			items: [],
			pageSize: 3,
			total: 0,
		});

		const req = {
			user: { did: "did:plc:self", session: {} },
		} as AuthenticatedRequest;

		await controller.getWatchers(req, {
			mediaType: "movie",
			mediaId: "movie-1",
		});

		expect(socialService.getFollowedWatchers).toHaveBeenCalledWith(
			"did:plc:self",
			"movie",
			"movie-1",
			3,
		);
	});
});
