import type { Mock } from "vitest";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "../generated/client";
import type { PrismaService } from "../prisma/prisma.service";
import { SocialService } from "./social.service";

const mockPutRecord = vi.fn();
const mockDeleteRecord = vi.fn();

vi.mock("@atproto/api", () => ({
	Agent: vi.fn().mockImplementation(() => ({
		com: {
			atproto: {
				repo: {
					putRecord: mockPutRecord,
					deleteRecord: mockDeleteRecord,
				},
			},
		},
	})),
}));

vi.mock("@atproto/common", () => ({
	TID: {
		nextStr: vi.fn(() => "follow-rkey-123"),
	},
}));

vi.mock("../lexicons/xyz/opnshelf/follow", () => ({
	main: {
		build: vi.fn((data: Record<string, unknown>) => ({
			$type: "xyz.opnshelf.follow",
			...data,
		})),
	},
	$nsid: "xyz.opnshelf.follow",
}));

describe("SocialService", () => {
	let service: SocialService;

	const prisma = {
		user: {
			findUnique: vi.fn(),
			findMany: vi.fn(),
		},
		follow: {
			count: vi.fn(),
			create: vi.fn(),
			deleteMany: vi.fn(),
			findMany: vi.fn(),
			findFirst: vi.fn(),
			update: vi.fn(),
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
	const session = { did: "did:plc:self" };

	beforeEach(() => {
		vi.clearAllMocks();
		mockPutRecord.mockReset();
		mockDeleteRecord.mockReset();
		service = new SocialService(prisma);
	});

	it("creates follows idempotently and returns the current relationship", async () => {
		prisma.user.findUnique = vi
			.fn()
			.mockResolvedValue({ did: "did:plc:target" });
		prisma.follow.findFirst = vi
			.fn()
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce({ rkey: "follow-rkey-123" });
		prisma.follow.create = vi.fn().mockResolvedValue({
			followerDid: "did:plc:self",
			followingDid: "did:plc:target",
			rkey: "follow-rkey-123",
		});
		prisma.follow.count = vi
			.fn()
			.mockResolvedValueOnce(1)
			.mockResolvedValueOnce(0)
			.mockResolvedValueOnce(1)
			.mockResolvedValueOnce(0);
		mockPutRecord.mockResolvedValue({
			data: {
				uri: "at://did:plc:self/xyz.opnshelf.follow/follow-rkey-123",
				cid: "cid-follow-123",
			},
		});

		await expect(
			service.follow("did:plc:self", session, "did:plc:target"),
		).resolves.toEqual({
			targetDid: "did:plc:target",
			isFollowing: true,
			isFollowedBy: false,
			canFollow: true,
		});

		await expect(
			service.follow("did:plc:self", session, "did:plc:target"),
		).resolves.toEqual({
			targetDid: "did:plc:target",
			isFollowing: true,
			isFollowedBy: false,
			canFollow: true,
		});

		expect(mockPutRecord).toHaveBeenCalledTimes(1);
		expect(mockPutRecord).toHaveBeenCalledWith({
			repo: "did:plc:self",
			collection: "xyz.opnshelf.follow",
			rkey: "follow-rkey-123",
			record: expect.objectContaining({
				$type: "xyz.opnshelf.follow",
				subjectDid: "did:plc:target",
			}),
			validate: false,
		});
		expect(prisma.follow.create).toHaveBeenCalledTimes(1);
		expect(prisma.follow.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				followerDid: "did:plc:self",
				followingDid: "did:plc:target",
				rkey: "follow-rkey-123",
				uri: "at://did:plc:self/xyz.opnshelf.follow/follow-rkey-123",
				cid: "cid-follow-123",
			}),
		});
	});

	it("deletes follows idempotently", async () => {
		prisma.user.findUnique = vi
			.fn()
			.mockResolvedValue({ did: "did:plc:target" });
		prisma.follow.findFirst = vi
			.fn()
			.mockResolvedValueOnce({ rkey: "follow-rkey-123" })
			.mockResolvedValueOnce(null);
		prisma.follow.deleteMany = vi
			.fn()
			.mockResolvedValueOnce({ count: 1 })
			.mockResolvedValueOnce({ count: 0 });
		mockDeleteRecord.mockResolvedValue({});

		await expect(
			service.unfollow("did:plc:self", session, "did:plc:target"),
		).resolves.toBeUndefined();
		await expect(
			service.unfollow("did:plc:self", session, "did:plc:target"),
		).resolves.toBeUndefined();

		expect(mockDeleteRecord).toHaveBeenCalledTimes(1);
		expect(mockDeleteRecord).toHaveBeenCalledWith({
			repo: "did:plc:self",
			collection: "xyz.opnshelf.follow",
			rkey: "follow-rkey-123",
		});
		expect(prisma.follow.deleteMany).toHaveBeenCalledTimes(2);
		expect(prisma.follow.deleteMany).toHaveBeenCalledWith({
			where: {
				followerDid: "did:plc:self",
				followingDid: "did:plc:target",
			},
		});
	});

	it("logs best-effort PDS delete failures at debug while still unfollowing locally", async () => {
		prisma.user.findUnique = vi
			.fn()
			.mockResolvedValue({ did: "did:plc:target" });
		prisma.follow.findFirst = vi
			.fn()
			.mockResolvedValue({ rkey: "follow-rkey-123" });
		prisma.follow.deleteMany = vi.fn().mockResolvedValue({ count: 1 });
		mockDeleteRecord.mockRejectedValue(new Error("pds unavailable"));
		const debugSpy = vi.spyOn(
			(
				service as unknown as {
					logger: { debug: (...args: unknown[]) => void };
				}
			).logger,
			"debug",
		);
		const warnSpy = vi.spyOn(
			(service as unknown as { logger: { warn: (...args: unknown[]) => void } })
				.logger,
			"warn",
		);

		await expect(
			service.unfollow("did:plc:self", session, "did:plc:target"),
		).resolves.toBeUndefined();

		expect(debugSpy).toHaveBeenCalledWith(
			"Failed to delete follow record follow-rkey-123 from PDS",
			expect.any(Error),
		);
		expect(warnSpy).not.toHaveBeenCalled();
		expect(prisma.follow.deleteMany).toHaveBeenCalledWith({
			where: {
				followerDid: "did:plc:self",
				followingDid: "did:plc:target",
			},
		});
	});

	it("rejects self-follow", async () => {
		await expect(
			service.follow("did:plc:self", session, "did:plc:self"),
		).rejects.toThrow(BadRequestException);
		expect(prisma.user.findUnique).not.toHaveBeenCalled();
	});

	it("returns relationship states for self, following, follower, and mutual cases", async () => {
		prisma.user.findUnique = vi
			.fn()
			.mockResolvedValue({ did: "did:plc:target" });
		prisma.follow.count = vi
			.fn()
			.mockResolvedValueOnce(1)
			.mockResolvedValueOnce(0)
			.mockResolvedValueOnce(0)
			.mockResolvedValueOnce(1)
			.mockResolvedValueOnce(1)
			.mockResolvedValueOnce(1);

		await expect(
			service.getRelationship("did:plc:self", "did:plc:self"),
		).resolves.toEqual({
			targetDid: "did:plc:self",
			isFollowing: false,
			isFollowedBy: false,
			canFollow: false,
		});

		await expect(
			service.getRelationship("did:plc:self", "did:plc:target"),
		).resolves.toEqual({
			targetDid: "did:plc:target",
			isFollowing: true,
			isFollowedBy: false,
			canFollow: true,
		});

		await expect(
			service.getRelationship("did:plc:self", "did:plc:target"),
		).resolves.toEqual({
			targetDid: "did:plc:target",
			isFollowing: false,
			isFollowedBy: true,
			canFollow: true,
		});

		await expect(
			service.getRelationship("did:plc:self", "did:plc:target"),
		).resolves.toEqual({
			targetDid: "did:plc:target",
			isFollowing: true,
			isFollowedBy: true,
			canFollow: true,
		});
	});

	it("searches people without returning the viewer and ranks stronger handle matches first", async () => {
		prisma.user.findMany = vi
			.fn()
			.mockResolvedValue([
				makeUser("did:plc:exact", "al", "Al Exact", 2, 1),
				makeUser("did:plc:prefix", "alice", "Alice Prefix", 1, 1),
				makeUser("did:plc:display", "bravo", "Alana Display", 99, 1),
				makeUser("did:plc:substring", "coral", "Coral", 5, 1),
			]);
		prisma.follow.findMany = vi
			.fn()
			.mockResolvedValueOnce([{ followingDid: "did:plc:prefix" }])
			.mockResolvedValueOnce([{ followerDid: "did:plc:display" }]);

		const result = await service.searchPeople("did:plc:self", "al", 1, 10);

		expect(prisma.user.findMany).toHaveBeenCalledWith({
			where: {
				did: { not: "did:plc:self" },
				OR: [
					{ handle: { contains: "al", mode: "insensitive" } },
					{ displayName: { contains: "al", mode: "insensitive" } },
				],
			},
			select: expect.any(Object),
		});
		expect(result.items.map((item) => item.did)).toEqual([
			"did:plc:exact",
			"did:plc:prefix",
			"did:plc:display",
			"did:plc:substring",
		]);
		expect(result.items[1]).toMatchObject({
			isFollowing: true,
			isFollowedBy: false,
		});
		expect(result.items[2]).toMatchObject({
			isFollowing: false,
			isFollowedBy: true,
		});
	});

	it("paginates follower and following lists", async () => {
		prisma.user.findUnique = vi
			.fn()
			.mockResolvedValue({ did: "did:plc:target", handle: "target" });
		prisma.follow.count = vi
			.fn()
			.mockResolvedValueOnce(3)
			.mockResolvedValueOnce(3);
		prisma.follow.findMany = vi
			.fn()
			.mockResolvedValueOnce([{ followerDid: "did:plc:follower-3" }])
			.mockResolvedValueOnce([{ followingDid: "did:plc:follower-3" }])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ followingDid: "did:plc:following-3" }])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ followerDid: "did:plc:following-3" }]);
		prisma.user.findMany = vi
			.fn()
			.mockResolvedValueOnce([makeUser("did:plc:follower-3", "f3", "F3", 3, 1)])
			.mockResolvedValueOnce([
				makeUser("did:plc:following-3", "g3", "G3", 1, 3),
			]);

		const followers = await service.getFollowers(
			"did:plc:self",
			"@target",
			2,
			2,
		);
		const following = await service.getFollowing(
			"did:plc:self",
			"@target",
			2,
			2,
		);

		expect(followers).toMatchObject({
			page: 2,
			pageSize: 2,
			total: 3,
			totalPages: 2,
			hasPreviousPage: true,
			hasNextPage: false,
		});
		expect(followers.items[0]).toMatchObject({
			did: "did:plc:follower-3",
			isFollowing: true,
			isFollowedBy: false,
		});

		expect(following).toMatchObject({
			page: 2,
			pageSize: 2,
			total: 3,
			totalPages: 2,
			hasPreviousPage: true,
			hasNextPage: false,
		});
		expect(following.items[0]).toMatchObject({
			did: "did:plc:following-3",
			isFollowing: false,
			isFollowedBy: true,
		});
	});

	it("merges followed movie and episode activity in descending activity order", async () => {
		prisma.follow.findMany = vi
			.fn()
			.mockResolvedValueOnce([{ followingDid: "did:plc:friend-1" }]);
		prisma.trackedMovie.count = vi.fn().mockResolvedValue(2);
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
			{
				actorDid: "did:plc:friend-1",
				id: "movie-2",
				type: "movie",
				activityAt: new Date("2026-03-01T12:00:00.000Z"),
				watchedDate: null,
				createdAt: new Date("2026-03-01T12:00:00.000Z"),
				movieId: "movie-2",
				title: "Aftersun",
				showId: null,
				showTitle: null,
				seasonNumber: null,
				episodeNumber: null,
				posterPath: "/poster-movie-2.jpg",
				backdropPath: "/backdrop-movie-2.jpg",
				releaseYear: 2022,
				firstAirYear: null,
				overview: "Another movie overview",
			},
		]);
		prisma.user.findMany = vi
			.fn()
			.mockResolvedValue([
				makeUser("did:plc:friend-1", "friend", "Friend", 10, 5),
			]);
		prisma.movie.findMany = vi.fn().mockResolvedValue([
			{ movieId: "movie-1", colors: { primary: "#111111" } },
			{ movieId: "movie-2", colors: { primary: "#222222" } },
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
			total: 3,
			totalPages: 1,
			hasNextPage: false,
			hasPreviousPage: false,
		});
		expect(result.items.map((item) => item.id)).toEqual([
			"episode-1",
			"movie-1",
			"movie-2",
		]);
		expect(result.items[0]).toMatchObject({
			type: "episode",
			showId: "show-1",
			showTitle: "Severance",
		});
		expect(result.items[1]).toMatchObject({
			type: "movie",
			movieId: "movie-1",
			title: "Past Lives",
		});
		const sql = getSqlText(getQueryRawMock(prisma).mock.calls[0][0]);
		expect(sql).toContain('r.markdown AS "reviewContent"');
		expect(sql).not.toContain('r."textContent"');
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

	it("can reflect public profile counts after follow and unfollow", async () => {
		const follows = new Map<string, { rkey?: string }>();
		const statefulPrisma = createStatefulPrisma(follows);
		const statefulService = new SocialService(
			statefulPrisma as unknown as PrismaService,
		);
		mockPutRecord.mockResolvedValue({
			data: {
				uri: "at://did:plc:self/xyz.opnshelf.follow/follow-rkey-123",
				cid: "cid-follow-123",
			},
		});
		mockDeleteRecord.mockResolvedValue({});

		await statefulService.follow("did:plc:self", session, "did:plc:target");
		const followedProfile = await statefulService.getFollowers(
			"did:plc:self",
			"target",
			1,
			10,
		);
		expect(followedProfile.items[0]).toMatchObject({
			did: "did:plc:self",
			followersCount: 0,
			followingCount: 1,
		});

		await statefulService.unfollow("did:plc:self", session, "did:plc:target");
		const relationship = await statefulService.getRelationship(
			"did:plc:self",
			"did:plc:target",
		);
		expect(relationship).toMatchObject({
			isFollowing: false,
			isFollowedBy: false,
		});
	});

	it("throws when a relationship target is missing", async () => {
		prisma.user.findUnique = vi.fn().mockResolvedValue(null);

		await expect(
			service.getRelationship("did:plc:self", "did:plc:missing"),
		).rejects.toThrow(NotFoundException);
	});
});

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

function createStatefulPrisma(follows: Map<string, { rkey?: string }>) {
	const users = [
		{ did: "did:plc:self", handle: "self", displayName: "Self", avatar: null },
		{
			did: "did:plc:target",
			handle: "target",
			displayName: "Target",
			avatar: null,
		},
	];

	return {
		user: {
			findUnique: vi
				.fn()
				.mockImplementation(
					({ where }: { where: { did?: string; handle?: string } }) => {
						if (where.did) {
							const user = users.find(
								(candidate) => candidate.did === where.did,
							);
							return Promise.resolve(user ? { did: user.did } : null);
						}

						const user = users.find(
							(candidate) => candidate.handle === where.handle,
						);
						return Promise.resolve(
							user
								? {
										did: user.did,
										handle: user.handle,
									}
								: null,
						);
					},
				),
			findMany: vi
				.fn()
				.mockImplementation(
					({ where }: { where: { did: { in: string[] } } }) => {
						return Promise.resolve(
							users
								.filter((user) => where.did.in.includes(user.did))
								.map((user) => ({
									...user,
									_count: {
										followers: [...follows.keys()].filter((entry) =>
											entry.endsWith(`->${user.did}`),
										).length,
										following: [...follows.keys()].filter((entry) =>
											entry.startsWith(`${user.did}->`),
										).length,
									},
								})),
						);
					},
				),
		},
		follow: {
			count: vi
				.fn()
				.mockImplementation(
					({
						where,
					}: {
						where: { followerDid?: string; followingDid?: string };
					}) => {
						return Promise.resolve(
							[...follows.keys()].filter((entry) => {
								const [followerDid, followingDid] = entry.split("->");
								return (
									(where.followerDid
										? followerDid === where.followerDid
										: true) &&
									(where.followingDid
										? followingDid === where.followingDid
										: true)
								);
							}).length,
						);
					},
				),
			create: vi.fn().mockImplementation(
				({
					data,
				}: {
					data: {
						followerDid: string;
						followingDid: string;
						rkey?: string | null;
					};
				}) => {
					follows.set(`${data.followerDid}->${data.followingDid}`, {
						rkey: data.rkey ?? undefined,
					});
					return Promise.resolve(data);
				},
			),
			findFirst: vi
				.fn()
				.mockImplementation(
					({
						where,
					}: {
						where: { followerDid: string; followingDid: string };
					}) => {
						const entry = follows.get(
							`${where.followerDid}->${where.followingDid}`,
						);
						return Promise.resolve(entry ? { rkey: entry.rkey ?? null } : null);
					},
				),
			update: vi.fn().mockImplementation(
				({
					where,
					data,
				}: {
					where: {
						followerDid_followingDid: {
							followerDid: string;
							followingDid: string;
						};
					};
					data: { rkey?: string | null };
				}) => {
					const key = `${where.followerDid_followingDid.followerDid}->${where.followerDid_followingDid.followingDid}`;
					follows.set(key, { rkey: data.rkey ?? undefined });
					return Promise.resolve({});
				},
			),
			deleteMany: vi
				.fn()
				.mockImplementation(
					({
						where,
					}: {
						where: { followerDid: string; followingDid: string };
					}) => {
						follows.delete(`${where.followerDid}->${where.followingDid}`);
						return Promise.resolve({ count: 1 });
					},
				),
			findMany: vi
				.fn()
				.mockImplementation(({ where }: { where: Record<string, unknown> }) => {
					const entries = [...follows.keys()]
						.map((entry) => {
							const [followerDid, followingDid] = entry.split("->");
							return { followerDid, followingDid };
						})
						.filter((entry) => {
							return Object.entries(where).every(([key, value]) => {
								if (typeof value === "string") {
									return entry[key as "followerDid" | "followingDid"] === value;
								}

								if (
									value &&
									typeof value === "object" &&
									"in" in value &&
									Array.isArray((value as { in: string[] }).in)
								) {
									return (value as { in: string[] }).in.includes(
										entry[key as "followerDid" | "followingDid"],
									);
								}

								return true;
							});
						});

					return Promise.resolve(entries);
				}),
		},
		trackedMovie: {
			count: vi.fn().mockResolvedValue(0),
		},
		trackedEpisode: {
			count: vi.fn().mockResolvedValue(0),
		},
		movie: {
			findMany: vi.fn().mockResolvedValue([]),
		},
		show: {
			findMany: vi.fn().mockResolvedValue([]),
		},
		$queryRaw: vi.fn().mockResolvedValue([]),
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

describe("SocialService circles", () => {
	function buildPrisma(overrides: Record<string, unknown> = {}) {
		return {
			circle: {
				findUnique: vi.fn(),
				findMany: vi.fn(),
				create: vi.fn(),
				update: vi.fn(),
				delete: vi.fn(),
			},
			circleMember: {
				findMany: vi.fn(),
				upsert: vi.fn(),
				deleteMany: vi.fn(),
			},
			follow: {
				findUnique: vi.fn(),
				findMany: vi.fn(),
			},
			trackedMovie: { count: vi.fn().mockResolvedValue(0) },
			trackedEpisode: { count: vi.fn().mockResolvedValue(0) },
			review: { count: vi.fn().mockResolvedValue(0) },
			$queryRaw: vi.fn().mockResolvedValue([]),
			user: { findMany: vi.fn().mockResolvedValue([]) },
			...overrides,
		} as unknown as PrismaService;
	}

	it("rejects a member who the viewer does not follow", async () => {
		const prisma = buildPrisma();
		prisma.circle.findUnique = vi
			.fn()
			.mockResolvedValue({ ownerDid: "did:plc:self" });
		prisma.follow.findUnique = vi.fn().mockResolvedValue(null);
		const service = new SocialService(prisma);

		await expect(
			service.addCircleMember("did:plc:self", "circle-1", "did:plc:stranger"),
		).rejects.toBeInstanceOf(BadRequestException);
		expect((prisma.circleMember.upsert as Mock).mock.calls).toHaveLength(0);
	});

	it("refuses to operate on a circle owned by someone else", async () => {
		const prisma = buildPrisma();
		prisma.circle.findUnique = vi
			.fn()
			.mockResolvedValue({ ownerDid: "did:plc:other" });
		const service = new SocialService(prisma);

		await expect(
			service.deleteCircle("did:plc:self", "circle-1"),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("maps a duplicate circle name to a friendly error", async () => {
		const prisma = buildPrisma();
		prisma.circle.create = vi.fn().mockRejectedValue(
			new Prisma.PrismaClientKnownRequestError("dup", {
				code: "P2002",
				clientVersion: "test",
			}),
		);
		const service = new SocialService(prisma);

		await expect(
			service.createCircle("did:plc:self", "Family"),
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it("scopes the feed to circle members instead of all follows", async () => {
		const prisma = buildPrisma();
		prisma.circle.findUnique = vi
			.fn()
			.mockResolvedValue({ ownerDid: "did:plc:self" });
		prisma.circleMember.findMany = vi
			.fn()
			.mockResolvedValue([{ followingDid: "did:plc:a" }]);
		const service = new SocialService(prisma);

		const feed = await service.getFollowedActivityFeed(
			"did:plc:self",
			1,
			10,
			"circle-1",
		);

		// Counts queried for the single member, follow.findMany never used.
		expect((prisma.circleMember.findMany as Mock).mock.calls).toHaveLength(1);
		expect((prisma.follow.findMany as Mock).mock.calls).toHaveLength(0);
		expect(feed.total).toBe(0);
	});
});
