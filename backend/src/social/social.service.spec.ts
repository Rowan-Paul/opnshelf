import type { Main as FollowRecord } from "../lexicons/xyz/opnshelf/follow.defs";
import type { PrismaService } from "../prisma/prisma.service";
import { ActivityFeedService } from "./activity-feed.service";
import { CirclesService } from "./circles.service";
import { FollowsService } from "./follows.service";
import { SocialService } from "./social.service";
import { SocialUsersService } from "./social-users.service";

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
	const session = { did: "did:plc:self" };

	beforeEach(() => {
		vi.clearAllMocks();
		mockPutRecord.mockReset();
		mockDeleteRecord.mockReset();
	});

	it("can reflect public profile counts after follow and unfollow", async () => {
		const follows = new Map<string, { rkey?: string }>();
		const statefulPrisma = createStatefulPrisma(follows);
		const statefulService = buildSocialService(
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

	it("delegates every public method to its owning service with the same arguments", async () => {
		const users = {
			getSuggestions: vi.fn().mockResolvedValue("suggestions"),
			searchPeople: vi.fn().mockResolvedValue("search"),
		};
		const follows = {
			follow: vi.fn().mockResolvedValue("follow"),
			unfollow: vi.fn().mockResolvedValue(undefined),
			getRelationship: vi.fn().mockResolvedValue("relationship"),
			getFollowers: vi.fn().mockResolvedValue("followers"),
			getFollowing: vi.fn().mockResolvedValue("following"),
			indexFollowRecord: vi.fn().mockResolvedValue("indexed"),
			deleteFollowRecordIndex: vi.fn().mockResolvedValue({ count: 1 }),
		};
		const circles = {
			listCircles: vi.fn().mockResolvedValue("circles"),
			createCircle: vi.fn().mockResolvedValue("created"),
			renameCircle: vi.fn().mockResolvedValue("renamed"),
			deleteCircle: vi.fn().mockResolvedValue(undefined),
			addCircleMember: vi.fn().mockResolvedValue(undefined),
			removeCircleMember: vi.fn().mockResolvedValue(undefined),
			getCircleMembers: vi.fn().mockResolvedValue("members"),
		};
		const activityFeed = {
			getFollowedActivityFeed: vi.fn().mockResolvedValue("feed"),
			getFollowedWatchers: vi.fn().mockResolvedValue("watchers"),
		};
		const service = new SocialService(
			users as unknown as SocialUsersService,
			follows as unknown as FollowsService,
			circles as unknown as CirclesService,
			activityFeed as unknown as ActivityFeedService,
		);
		const record: FollowRecord = {
			$type: "xyz.opnshelf.follow",
			subjectDid: "did:plc:target",
			createdAt: "2026-03-01T00:00:00.000Z",
		};

		await expect(service.getSuggestions("v", 5)).resolves.toBe("suggestions");
		expect(users.getSuggestions).toHaveBeenCalledWith("v", 5);
		await expect(service.getSuggestions("v")).resolves.toBe("suggestions");
		expect(users.getSuggestions).toHaveBeenLastCalledWith("v", 10);

		await expect(service.searchPeople("v", "al", 2, 5)).resolves.toBe("search");
		expect(users.searchPeople).toHaveBeenCalledWith("v", "al", 2, 5);
		await expect(service.searchPeople("v", "al")).resolves.toBe("search");
		expect(users.searchPeople).toHaveBeenLastCalledWith("v", "al", 1, 20);

		await expect(service.follow("v", session, "t")).resolves.toBe("follow");
		expect(follows.follow).toHaveBeenCalledWith("v", session, "t");
		await expect(service.unfollow("v", session, "t")).resolves.toBeUndefined();
		expect(follows.unfollow).toHaveBeenCalledWith("v", session, "t");
		await expect(service.getRelationship("v", "t")).resolves.toBe(
			"relationship",
		);
		expect(follows.getRelationship).toHaveBeenCalledWith("v", "t");
		await expect(service.getFollowers(null, "h")).resolves.toBe("followers");
		expect(follows.getFollowers).toHaveBeenCalledWith(null, "h", 1, 20);
		await expect(service.getFollowing("v", "h", 3, 7)).resolves.toBe(
			"following",
		);
		expect(follows.getFollowing).toHaveBeenCalledWith("v", "h", 3, 7);
		await expect(
			service.indexFollowRecord("f", "rkey", "cid", record, "at://uri"),
		).resolves.toBe("indexed");
		expect(follows.indexFollowRecord).toHaveBeenCalledWith(
			"f",
			"rkey",
			"cid",
			record,
			"at://uri",
		);
		await expect(service.deleteFollowRecordIndex("f", "rkey")).resolves.toEqual(
			{ count: 1 },
		);
		expect(follows.deleteFollowRecordIndex).toHaveBeenCalledWith("f", "rkey");

		await expect(service.listCircles("v")).resolves.toBe("circles");
		expect(circles.listCircles).toHaveBeenCalledWith("v");
		await expect(service.createCircle("v", "Family")).resolves.toBe("created");
		expect(circles.createCircle).toHaveBeenCalledWith("v", "Family");
		await expect(service.renameCircle("v", "c", "Friends")).resolves.toBe(
			"renamed",
		);
		expect(circles.renameCircle).toHaveBeenCalledWith("v", "c", "Friends");
		await expect(service.deleteCircle("v", "c")).resolves.toBeUndefined();
		expect(circles.deleteCircle).toHaveBeenCalledWith("v", "c");
		await expect(
			service.addCircleMember("v", "c", "t"),
		).resolves.toBeUndefined();
		expect(circles.addCircleMember).toHaveBeenCalledWith("v", "c", "t");
		await expect(
			service.removeCircleMember("v", "c", "t"),
		).resolves.toBeUndefined();
		expect(circles.removeCircleMember).toHaveBeenCalledWith("v", "c", "t");
		await expect(service.getCircleMembers("v", "c")).resolves.toBe("members");
		expect(circles.getCircleMembers).toHaveBeenCalledWith("v", "c", 1, 20);

		await expect(service.getFollowedActivityFeed("v")).resolves.toBe("feed");
		expect(activityFeed.getFollowedActivityFeed).toHaveBeenCalledWith(
			"v",
			1,
			10,
			undefined,
		);
		await expect(service.getFollowedActivityFeed("v", 2, 5, "c")).resolves.toBe(
			"feed",
		);
		expect(activityFeed.getFollowedActivityFeed).toHaveBeenLastCalledWith(
			"v",
			2,
			5,
			"c",
		);
		await expect(service.getFollowedWatchers("v", "movie", "m")).resolves.toBe(
			"watchers",
		);
		expect(activityFeed.getFollowedWatchers).toHaveBeenCalledWith(
			"v",
			"movie",
			"m",
			3,
		);
	});
});

function buildSocialService(prisma: PrismaService) {
	const users = new SocialUsersService(prisma);
	const circles = new CirclesService(prisma, users);
	const follows = new FollowsService(prisma, users, circles);
	const activityFeed = new ActivityFeedService(prisma, users, circles);
	return new SocialService(users, follows, circles, activityFeed);
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
