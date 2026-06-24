import { Test, type TestingModule } from "@nestjs/testing";
import { AuthGuard } from "../auth/auth.guard";
import { AuthService } from "../auth/auth.service";
import type { AuthenticatedRequest } from "../auth/types";

vi.mock("../prisma/prisma.service", () => ({
	PrismaService: vi.fn(),
}));
vi.mock("@atproto/oauth-client-node", () => ({}));
vi.mock("@atproto/api", () => ({}));

import { ShowsController } from "./shows.controller";
import { ShowsService } from "./shows.service";

describe("ShowsController", () => {
	let controller: ShowsController;

	const mockShowsService = {
		searchShows: vi.fn(),
		discoverShows: vi.fn(),
		getShowDetails: vi.fn(),
		upsertShow: vi.fn(),
		getShowCredits: vi.fn(),
		getSeasonDetails: vi.fn(),
		getEpisodeDetails: vi.fn(),
		getUserShows: vi.fn(),
		getUserUpNext: vi.fn(),
		getUserReleaseCalendar: vi.fn(),
		ensureShowHasColors: vi.fn(),
		markEpisodeWatched: vi.fn(),
		indexTrackedEpisode: vi.fn(),
		unmarkEpisodeWatched: vi.fn(),
		removeAllTrackedEpisodes: vi.fn(),
		removeLatestTrackedEpisode: vi.fn(),
		getShowByTMDBId: vi.fn(),
		getEpisodeWatchHistory: vi.fn(),
		removeTrackedEpisodeById: vi.fn(),
		syncShowMetadata: vi.fn().mockResolvedValue(undefined),
		getLocalSeasons: vi.fn().mockResolvedValue([]),
		getLocalEpisodes: vi.fn().mockResolvedValue([]),
		getEpisodeContext: vi.fn(),
	};

	const mockAuthService = {
		getUser: vi.fn(),
		revokeBySessionId: vi.fn(),
	};

	beforeEach(async () => {
		vi.clearAllMocks();

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

	it("should get show details with trailer and colors", async () => {
		const mockShow = {
			id: 123,
			name: "Test Show",
			trailer: {
				id: "trailer-1",
				key: "show-key",
				name: "Main Trailer",
				site: "YouTube",
				type: "Trailer",
				sourceMediaType: "show",
			},
		};
		mockShowsService.getShowDetails.mockResolvedValue(mockShow);
		mockShowsService.upsertShow.mockResolvedValue({
			showId: "123",
			colors: {
				primary: "#111111",
				secondary: "#222222",
				accent: "#333333",
				muted: "#444444",
			},
		});
		mockShowsService.getShowCredits.mockResolvedValue({
			cast: [],
			crew: [],
		});

		const result = await controller.getShowDetails("123");

		expect(result).toEqual({
			...mockShow,
			colors: {
				primary: "#111111",
				secondary: "#222222",
				accent: "#333333",
				muted: "#444444",
			},
			credits: {
				cast: [],
				crew: [],
			},
		});
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

	it("returns episode watch history to the owner", async () => {
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

	it("rejects episode watch history requests for another user", async () => {
		const mockUser = {
			did: "did:plc:abc123",
			session: { did: "did:plc:abc123" },
		};

		await expect(
			controller.getShowWatchHistory(
				"did:plc:someone-else",
				"123",
				createMockRequest(mockUser),
			),
		).rejects.toThrow("Unauthorized");
		expect(mockShowsService.getEpisodeWatchHistory).not.toHaveBeenCalled();
	});
});
