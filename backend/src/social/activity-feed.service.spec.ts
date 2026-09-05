import type { Mock } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { ActivityFeedService } from "./activity-feed.service";
import { CirclesService } from "./circles.service";
import { SocialUsersService } from "./social-users.service";

describe("ActivityFeedService", () => {
	let service: ActivityFeedService;

	const prisma = {
		user: {
			findUnique: vi.fn(),
			findMany: vi.fn(),
		},
		follow: {
			findMany: vi.fn(),
		},
		trackedMovie: {
			count: vi.fn(),
		},
		trackedEpisode: {
			count: vi.fn(),
		},
		movie: {
			findMany: vi.fn(),
		},
		show: {
			findMany: vi.fn(),
		},
		review: {
			count: vi.fn(),
		},
		$queryRaw: vi.fn(),
	} as unknown as PrismaService;

	beforeEach(() => {
		vi.clearAllMocks();
		service = buildActivityFeedService(prisma);
	});

	it("merges followed movie and episode activity in descending activity order", async () => {
		prisma.follow.findMany = vi
			.fn()
			.mockResolvedValueOnce([{ followingDid: "did:plc:friend-1" }]);
		prisma.trackedMovie.count = vi.fn().mockResolvedValue(1);
		prisma.trackedEpisode.count = vi.fn().mockResolvedValue(1);
		prisma.review.count = vi.fn().mockResolvedValue(0);
		prisma.$queryRaw = vi.fn().mockResolvedValue([
			{
				actorDid: "did:plc:friend-1",
				id: "episode-1",
				type: "episode",
				activityAt: new Date("2026-03-03T12:00:00.000Z"),
				watchedDate: new Date("2026-03-03T12:00:00.000Z"),
				createdAt: new Date("2026-03-03T11:00:00.000Z"),
				movieId: null,
				title: null,
				showId: "show-1",
				showTitle: "Severance",
				seasonNumber: 1,
				episodeNumber: 2,
				episodeName: "Episode Name",
				episodeOverview: "Episode overview",
				stillPath: null,
				posterPath: "/poster-show.jpg",
				backdropPath: "/backdrop-show.jpg",
				releaseYear: null,
				firstAirYear: 2022,
				overview: "Show overview",
			},
			{
				actorDid: "did:plc:friend-1",
				id: "movie-1",
				type: "movie",
				activityAt: new Date("2026-03-02T12:00:00.000Z"),
				watchedDate: new Date("2026-03-02T12:00:00.000Z"),
				createdAt: new Date("2026-03-02T11:00:00.000Z"),
				movieId: "movie-1",
				title: "Past Lives",
				showId: null,
				showTitle: null,
				seasonNumber: null,
				episodeNumber: null,
				posterPath: "/poster-movie.jpg",
				backdropPath: "/backdrop-movie.jpg",
				releaseYear: 2023,
				firstAirYear: null,
				overview: "Movie overview",
			},
		]);
		prisma.user.findMany = vi
			.fn()
			.mockResolvedValue([
				makeUser("did:plc:friend-1", "friend", "Friend", 10, 5),
			]);
		prisma.movie.findMany = vi
			.fn()
			.mockResolvedValue([
				{ movieId: "movie-1", colors: { primary: "#111111" } },
			]);
		prisma.show.findMany = vi
			.fn()
			.mockResolvedValue([
				{ showId: "show-1", colors: { primary: "#333333" } },
			]);

		const result = await service.getFollowedActivityFeed("did:plc:self", 1, 10);

		expect(result).toMatchObject({
			page: 1,
			pageSize: 10,
			total: 2,
			totalPages: 1,
			hasNextPage: false,
			hasPreviousPage: false,
		});
		expect(result.items.map((item) => item.id)).toEqual([
			"episode-1",
			"movie-1",
		]);
		expect(prisma.trackedMovie.count).toHaveBeenCalledWith({
			where: {
				userDid: { in: ["did:plc:friend-1"] },
				watchedDate: { not: null },
			},
		});
		expect(prisma.trackedEpisode.count).toHaveBeenCalledWith({
			where: {
				userDid: { in: ["did:plc:friend-1"] },
				watchedDate: { not: null },
			},
		});
		const activityQuery = (prisma.$queryRaw as Mock).mock.calls[0]?.[0];
		const activityQueryText = Array.isArray(activityQuery?.strings)
			? activityQuery.strings.join(" ")
			: String(activityQuery);
		expect(activityQueryText).toContain('tm."watchedDate" IS NOT NULL');
		expect(activityQueryText).toContain('te."watchedDate" IS NOT NULL');
		expect(result.items[0]).toMatchObject({
			type: "episode",
			showId: "show-1",
			showTitle: "Severance",
			colors: { primary: "#333333" },
		});
		expect(result.items[1]).toMatchObject({
			type: "movie",
			movieId: "movie-1",
			title: "Past Lives",
			colors: { primary: "#111111" },
		});
		const sql = getSqlText(getQueryRawMock(prisma).mock.calls[0][0]);
		expect(sql).toContain('r.markdown AS "reviewContent"');
		expect(sql).not.toContain('r."textContent"');
	});

	it("returns an empty feed without querying when the viewer follows nobody", async () => {
		prisma.follow.findMany = vi.fn().mockResolvedValue([]);

		await expect(
			service.getFollowedActivityFeed("did:plc:self", 3, 10),
		).resolves.toEqual({
			items: [],
			page: 3,
			pageSize: 10,
			total: 0,
			totalPages: 0,
			hasNextPage: false,
			hasPreviousPage: false,
		});
		expect(prisma.trackedMovie.count).not.toHaveBeenCalled();
		expect(prisma.$queryRaw).not.toHaveBeenCalled();
	});

	it("returns an empty watcher summary when the viewer follows nobody", async () => {
		prisma.follow.findMany = vi.fn().mockResolvedValue([]);

		await expect(
			service.getFollowedWatchers("did:plc:self", "movie", "movie-1", 3),
		).resolves.toEqual({
			items: [],
			pageSize: 3,
			total: 0,
		});

		expect(prisma.$queryRaw).not.toHaveBeenCalled();
		expect(prisma.user.findMany).not.toHaveBeenCalled();
	});

	it("returns an empty watcher summary when followed users have no matching watches", async () => {
		prisma.follow.findMany = vi
			.fn()
			.mockResolvedValue([{ followingDid: "did:plc:friend-1" }]);
		prisma.$queryRaw = vi.fn().mockResolvedValue([]);

		await expect(
			service.getFollowedWatchers("did:plc:self", "movie", "movie-1", 3),
		).resolves.toEqual({
			items: [],
			pageSize: 3,
			total: 0,
		});

		expect(prisma.user.findMany).not.toHaveBeenCalled();
	});

	it("returns compact movie watchers and preserves total count beyond the avatar limit", async () => {
		prisma.follow.findMany = vi
			.fn()
			.mockResolvedValue([{ followingDid: "did:plc:friend-1" }]);
		prisma.$queryRaw = vi.fn().mockResolvedValue([
			{
				actorDid: "did:plc:friend-3",
				activityAt: new Date("2026-03-03T12:00:00.000Z"),
				createdAt: new Date("2026-03-03T12:00:00.000Z"),
			},
			{
				actorDid: "did:plc:friend-2",
				activityAt: new Date("2026-03-02T12:00:00.000Z"),
				createdAt: new Date("2026-03-02T12:00:00.000Z"),
			},
			{
				actorDid: "did:plc:friend-1",
				activityAt: new Date("2026-03-01T12:00:00.000Z"),
				createdAt: new Date("2026-03-01T12:00:00.000Z"),
			},
			{
				actorDid: "did:plc:friend-4",
				activityAt: new Date("2026-02-28T12:00:00.000Z"),
				createdAt: new Date("2026-02-28T12:00:00.000Z"),
			},
		]);
		prisma.user.findMany = vi
			.fn()
			.mockResolvedValue([
				makeUser("did:plc:friend-1", "friend-1", "Friend 1", 10, 5),
				makeUser("did:plc:friend-2", "friend-2", "Friend 2", 10, 5),
				makeUser("did:plc:friend-3", "friend-3", "Friend 3", 10, 5),
			]);

		const result = await service.getFollowedWatchers(
			"did:plc:self",
			"movie",
			"movie-1",
			3,
		);

		expect(result.total).toBe(4);
		expect(result.pageSize).toBe(3);
		expect(result.items.map((item) => item.actor.did)).toEqual([
			"did:plc:friend-3",
			"did:plc:friend-2",
			"did:plc:friend-1",
		]);
		expect(getSqlText(getQueryRawMock(prisma).mock.calls[0][0])).toContain(
			'tm."movieId" = ',
		);
	});

	it("queries show watchers without season or episode filters for show detail pages", async () => {
		prisma.follow.findMany = vi
			.fn()
			.mockResolvedValue([{ followingDid: "did:plc:friend-1" }]);
		prisma.$queryRaw = vi.fn().mockResolvedValue([
			{
				actorDid: "did:plc:friend-1",
				activityAt: new Date("2026-03-03T12:00:00.000Z"),
				createdAt: new Date("2026-03-03T12:00:00.000Z"),
			},
		]);
		prisma.user.findMany = vi
			.fn()
			.mockResolvedValue([
				makeUser("did:plc:friend-1", "friend", "Friend", 10, 5),
			]);

		await service.getFollowedWatchers("did:plc:self", "show", "show-1", 3);

		const sql = getSqlText(getQueryRawMock(prisma).mock.calls[0][0]);
		expect(sql).toContain('te."showId" = ');
		expect(sql).not.toContain('te."seasonNumber" = ');
		expect(sql).not.toContain('te."episodeNumber" = ');
	});

	it("filters season watcher queries by season only", async () => {
		prisma.follow.findMany = vi
			.fn()
			.mockResolvedValue([{ followingDid: "did:plc:friend-1" }]);
		prisma.$queryRaw = vi.fn().mockResolvedValue([
			{
				actorDid: "did:plc:friend-1",
				activityAt: new Date("2026-03-03T12:00:00.000Z"),
				createdAt: new Date("2026-03-03T12:00:00.000Z"),
			},
		]);
		prisma.user.findMany = vi
			.fn()
			.mockResolvedValue([
				makeUser("did:plc:friend-1", "friend", "Friend", 10, 5),
			]);

		await service.getFollowedWatchers(
			"did:plc:self",
			"show",
			"show-1:season:2",
			3,
		);

		const sql = getSqlText(getQueryRawMock(prisma).mock.calls[0][0]);
		expect(sql).toContain('te."showId" = ');
		expect(sql).toContain('te."seasonNumber" = ');
		expect(sql).not.toContain('te."episodeNumber" = ');
	});

	it("filters episode watcher queries by exact season and episode", async () => {
		prisma.follow.findMany = vi
			.fn()
			.mockResolvedValue([{ followingDid: "did:plc:friend-1" }]);
		prisma.$queryRaw = vi.fn().mockResolvedValue([
			{
				actorDid: "did:plc:friend-1",
				activityAt: new Date("2026-03-03T12:00:00.000Z"),
				createdAt: new Date("2026-03-03T12:00:00.000Z"),
			},
		]);
		prisma.user.findMany = vi
			.fn()
			.mockResolvedValue([
				makeUser("did:plc:friend-1", "friend", "Friend", 10, 5),
			]);

		await service.getFollowedWatchers(
			"did:plc:self",
			"show",
			"show-1:season:2:episode:4",
			3,
		);

		const sql = getSqlText(getQueryRawMock(prisma).mock.calls[0][0]);
		expect(sql).toContain('te."showId" = ');
		expect(sql).toContain('te."seasonNumber" = ');
		expect(sql).toContain('te."episodeNumber" = ');
	});

	it("scopes the feed to circle members instead of all follows", async () => {
		const circlePrisma = {
			circle: { findUnique: vi.fn() },
			circleMember: { findMany: vi.fn() },
			follow: { findMany: vi.fn() },
			trackedMovie: { count: vi.fn().mockResolvedValue(0) },
			trackedEpisode: { count: vi.fn().mockResolvedValue(0) },
			review: { count: vi.fn().mockResolvedValue(0) },
			$queryRaw: vi.fn().mockResolvedValue([]),
			user: { findMany: vi.fn().mockResolvedValue([]) },
		} as unknown as PrismaService;
		circlePrisma.circle.findUnique = vi
			.fn()
			.mockResolvedValue({ ownerDid: "did:plc:self" });
		circlePrisma.circleMember.findMany = vi
			.fn()
			.mockResolvedValue([{ followingDid: "did:plc:a" }]);
		const circleService = buildActivityFeedService(circlePrisma);

		const feed = await circleService.getFollowedActivityFeed(
			"did:plc:self",
			1,
			10,
			"circle-1",
		);

		// Counts queried for the single member, follow.findMany never used.
		expect(
			(circlePrisma.circleMember.findMany as Mock).mock.calls,
		).toHaveLength(1);
		expect((circlePrisma.follow.findMany as Mock).mock.calls).toHaveLength(0);
		expect(circlePrisma.trackedMovie.count).toHaveBeenCalledWith({
			where: { userDid: { in: ["did:plc:a"] }, watchedDate: { not: null } },
		});
		expect(feed.total).toBe(0);
	});
});

function buildActivityFeedService(prisma: PrismaService) {
	const users = new SocialUsersService(prisma);
	return new ActivityFeedService(
		prisma,
		users,
		new CirclesService(prisma, users),
	);
}

function makeUser(
	did: string,
	handle: string,
	displayName: string,
	followers: number,
	following: number,
) {
	return {
		did,
		handle,
		displayName,
		avatar: null,
		_count: {
			followers,
			following,
		},
	};
}

function getSqlText(query: unknown) {
	if (
		query &&
		typeof query === "object" &&
		"strings" in query &&
		Array.isArray(query.strings)
	) {
		return query.strings.join(" ");
	}

	return String(query);
}

function getQueryRawMock(prisma: PrismaService) {
	return prisma.$queryRaw as unknown as Mock;
}
