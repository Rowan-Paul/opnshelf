import { Test, type TestingModule } from "@nestjs/testing";
import { AuthGuard } from "../auth/auth.guard";
import { AuthService } from "../auth/auth.service";
import type { AuthenticatedRequest } from "../auth/types";

jest.mock("../prisma/prisma.service", () => ({
	PrismaService: jest.fn(),
}));
jest.mock("@atproto/oauth-client-node", () => ({}));
jest.mock("@atproto/api", () => ({}));

import { ShowsController } from "./shows.controller";
import { ShowsService } from "./shows.service";

describe("ShowsController", () => {
	let controller: ShowsController;

	const mockShowsService = {
		searchShows: jest.fn(),
		discoverShows: jest.fn(),
		getShowDetails: jest.fn(),
		upsertShow: jest.fn(),
		getShowCredits: jest.fn(),
		getSeasonDetails: jest.fn(),
		getEpisodeDetails: jest.fn(),
		getUserShows: jest.fn(),
		getUserUpNext: jest.fn(),
		ensureShowHasColors: jest.fn(),
		markEpisodeWatched: jest.fn(),
		indexTrackedEpisode: jest.fn(),
		unmarkEpisodeWatched: jest.fn(),
		removeAllTrackedEpisodes: jest.fn(),
		removeLatestTrackedEpisode: jest.fn(),
		getShowByTMDBId: jest.fn(),
		getEpisodeWatchHistory: jest.fn(),
		removeTrackedEpisodeById: jest.fn(),
	};

	const mockAuthService = {
		getUser: jest.fn(),
		revokeBySessionId: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			controllers: [ShowsController],
			providers: [
				{ provide: ShowsService, useValue: mockShowsService },
				{ provide: AuthService, useValue: mockAuthService },
				AuthGuard,
			],
		}).compile();

		controller = module.get<ShowsController>(ShowsController);
	});

	const createMockRequest = (user: {
		did: string;
		session: { did: string };
	}): AuthenticatedRequest => {
		return { user } as unknown as AuthenticatedRequest;
	};

	it("should search shows", async () => {
		const mockResults = {
			results: [{ id: 1, name: "Show 1" }],
			total_results: 1,
		};
		mockShowsService.searchShows.mockResolvedValue(mockResults);

		const result = await controller.searchShows("show");

		expect(result).toEqual(mockResults);
		expect(mockShowsService.searchShows).toHaveBeenCalledWith("show");
	});

	it("should get season details", async () => {
		const mockSeason = { id: 1, season_number: 1, episodes: [] };
		mockShowsService.getSeasonDetails.mockResolvedValue(mockSeason);

		const result = await controller.getSeasonDetails("123", "1");

		expect(result).toEqual(mockSeason);
		expect(mockShowsService.getSeasonDetails).toHaveBeenCalledWith("123", 1);
	});

	it("should mark an episode as watched", async () => {
		const mockUser = {
			did: "did:plc:abc123",
			session: { did: "did:plc:abc123" },
		};
		const mockMarkResult = {
			uri: "at://did:plc:abc123/xyz.opnshelf.episode/abc",
			cid: "cid1",
			rkey: "rk1",
			record: { watchedAt: "2024-01-01T00:00:00Z" },
		};
		const mockTracked = {
			id: "1",
			showId: "123",
			seasonNumber: 1,
			episodeNumber: 2,
		};
		mockShowsService.markEpisodeWatched.mockResolvedValue(mockMarkResult);
		mockShowsService.indexTrackedEpisode.mockResolvedValue(mockTracked);

		const result = await controller.markWatched(
			{ showId: "123", seasonNumber: 1, episodeNumber: 2 },
			createMockRequest(mockUser),
		);

		expect(mockShowsService.markEpisodeWatched).toHaveBeenCalledWith(
			"did:plc:abc123",
			mockUser.session,
			"123",
			1,
			2,
			undefined,
		);
		expect(result).toEqual(mockTracked);
	});

	it("should unmark episodes in all mode", async () => {
		const mockUser = {
			did: "did:plc:abc123",
			session: { did: "did:plc:abc123" },
		};
		mockShowsService.unmarkEpisodeWatched.mockResolvedValue({});

		await controller.unmarkWatched(
			"123",
			"all",
			"1",
			"2",
			createMockRequest(mockUser),
		);

		expect(mockShowsService.unmarkEpisodeWatched).toHaveBeenCalledWith(
			"did:plc:abc123",
			mockUser.session,
			"123",
			"all",
			1,
			2,
		);
		expect(mockShowsService.removeAllTrackedEpisodes).toHaveBeenCalledWith(
			"did:plc:abc123",
			"123",
			1,
			2,
		);
	});

	it("should return show history for owner", async () => {
		const mockUser = {
			did: "did:plc:abc123",
			session: { did: "did:plc:abc123" },
		};
		const mockHistory = [{ id: "h1", seasonNumber: 1, episodeNumber: 2 }];
		mockShowsService.getEpisodeWatchHistory.mockResolvedValue(mockHistory);

		const result = await controller.getShowWatchHistory(
			"did:plc:abc123",
			"123",
			createMockRequest(mockUser),
		);

		expect(result).toEqual(mockHistory);
	});

	it("should return up next episodes for user", async () => {
		const mockUpNext = [
			{
				showId: "123",
				watchCount: 4,
				latestWatchedDate: "2024-01-01T00:00:00.000Z",
				lastWatched: { seasonNumber: 1, episodeNumber: 4 },
				nextEpisode: {
					seasonNumber: 1,
					episodeNumber: 5,
					name: "Next Episode",
				},
				show: { showId: "123", title: "Test Show" },
			},
		];
		mockShowsService.getUserUpNext.mockResolvedValue(mockUpNext);

		const result = await controller.getUserUpNext("did:plc:abc123");

		expect(result).toEqual(mockUpNext);
		expect(mockShowsService.getUserUpNext).toHaveBeenCalledWith(
			"did:plc:abc123",
		);
	});
});
