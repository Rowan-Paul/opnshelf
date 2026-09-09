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
		getShowByTMDBId: vi.fn(),
		getEpisodeWatchHistory: vi.fn(),
		getShowProgress: vi.fn(),
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
		mockShowsService.syncShowMetadata.mockResolvedValue(undefined);

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
		expect(
			mockShowsService.upsertShow.mock.invocationCallOrder[0],
		).toBeLessThan(
			mockShowsService.syncShowMetadata.mock.invocationCallOrder[0],
		);
		expect(
			mockShowsService.syncShowMetadata.mock.invocationCallOrder[0],
		).toBeLessThan(mockShowsService.getShowCredits.mock.invocationCallOrder[0]);
	});

	it("does not return a detail response when season metadata synchronization fails", async () => {
		mockShowsService.getShowDetails.mockResolvedValue({
			id: 123,
			name: "Test Show",
		});
		mockShowsService.upsertShow.mockResolvedValue({ showId: "123" });
		mockShowsService.syncShowMetadata.mockRejectedValue(
			new Error("Could not synchronize seasons 2"),
		);

		await expect(controller.getShowDetails("123")).rejects.toThrow(
			"Could not synchronize seasons 2",
		);
		expect(mockShowsService.getShowCredits).not.toHaveBeenCalled();
	});

	it("returns progress for the authenticated viewer's requested shows", async () => {
		const items = [
			{
				showId: "123",
				episodesWatched: 2,
				episodesTotal: 10,
				seasons: [],
			},
		];
		mockShowsService.getShowProgress.mockResolvedValue(items);

		await expect(
			controller.getShowProgress(
				{ showIds: ["123"] },
				createMockRequest({
					did: "did:plc:viewer",
					session: { did: "did:plc:viewer" },
				}),
			),
		).resolves.toEqual({ items });
		expect(mockShowsService.getShowProgress).toHaveBeenCalledWith(
			"did:plc:viewer",
			["123"],
		);
	});

	describe("getUserShows", () => {
		it("returns tracked show summaries with persisted colors without enrichment", async () => {
			const colors = { primary: "#111111", secondary: "#222222" };
			mockShowsService.getUserShows.mockResolvedValue([
				{
					showId: "123",
					episodeWatchCount: 2,
					watchedDate: new Date("2024-01-15T12:00:00.000Z"),
					show: { showId: "123", title: "Test Show", colors },
				},
			]);

			const result = await controller.getUserShows("did:plc:abc123");

			expect(result).toEqual([
				{
					showId: "123",
					episodeWatchCount: 2,
					latestWatchedDate: "2024-01-15T12:00:00.000Z",
					show: { showId: "123", title: "Test Show", colors },
				},
			]);
			expect(mockShowsService.getUserShows).toHaveBeenCalledWith(
				"did:plc:abc123",
			);
			expect(mockShowsService.ensureShowHasColors).not.toHaveBeenCalled();
		});

		it("returns an empty array when the user has no tracked shows", async () => {
			mockShowsService.getUserShows.mockResolvedValue([]);

			await expect(controller.getUserShows("did:plc:unknown")).resolves.toEqual(
				[],
			);
			expect(mockShowsService.ensureShowHasColors).not.toHaveBeenCalled();
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
	});

	it("returns episode watch history to the owner", async () => {
		const mockUser = {
			did: "did:plc:abc123",
			session: { did: "did:plc:abc123" },
		};
		const mockHistory = [
			{
				id: "h1",
				watchedDate: null,
				seasonNumber: 1,
				episodeNumber: 2,
			},
		];
		mockShowsService.getEpisodeWatchHistory.mockResolvedValue(mockHistory);

		const result = await controller.getShowWatchHistory(
			"did:plc:abc123",
			"123",
			createMockRequest(mockUser),
		);

		expect(result).toEqual([
			{
				id: "h1",
				watchedDate: undefined,
				seasonNumber: 1,
				episodeNumber: 2,
			},
		]);
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
