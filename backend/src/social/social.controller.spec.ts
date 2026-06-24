import { Test, type TestingModule } from "@nestjs/testing";
import type { AuthenticatedRequest } from "../auth/types";

vi.mock("../auth/auth.guard", () => ({
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
		searchPeople: vi.fn(),
		follow: vi.fn(),
		unfollow: vi.fn(),
		getRelationship: vi.fn(),
		getFollowers: vi.fn(),
		getFollowing: vi.fn(),
		getFeed: vi.fn(),
		getFollowedActivityFeed: vi.fn(),
		getFollowedWatchers: vi.fn(),
	};

	beforeEach(async () => {
		vi.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			controllers: [SocialController],
			providers: [{ provide: SocialService, useValue: socialService }],
		}).compile();

		controller = module.get<SocialController>(SocialController);
	});

	// The passthrough behavior (forwarding the scoped mediaId to the service) is
	// covered in social.service.spec; the only controller-side logic is the
	// default page size below.
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
