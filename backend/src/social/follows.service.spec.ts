import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";
import { CirclesService } from "./circles.service";
import { FollowsService } from "./follows.service";
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

describe("FollowsService", () => {
	let service: FollowsService;

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
	} as unknown as PrismaService;
	const session = { did: "did:plc:self" };

	beforeEach(() => {
		vi.clearAllMocks();
		mockPutRecord.mockReset();
		mockDeleteRecord.mockReset();
		service = buildFollowsService(prisma);
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

	it("preserves the local follow when the PDS delete fails transiently", async () => {
		prisma.user.findUnique = vi
			.fn()
			.mockResolvedValue({ did: "did:plc:target" });
		prisma.follow.findFirst = vi
			.fn()
			.mockResolvedValue({ rkey: "follow-rkey-123" });
		prisma.follow.deleteMany = vi.fn().mockResolvedValue({ count: 1 });
		mockDeleteRecord.mockRejectedValue(new Error("pds unavailable"));
		await expect(
			service.unfollow("did:plc:self", session, "did:plc:target"),
		).rejects.toThrow("pds unavailable");

		expect(prisma.follow.deleteMany).not.toHaveBeenCalled();
	});

	it("deletes the local follow when the PDS record is already missing", async () => {
		prisma.user.findUnique = vi
			.fn()
			.mockResolvedValue({ did: "did:plc:target" });
		prisma.follow.findFirst = vi
			.fn()
			.mockResolvedValue({ rkey: "follow-rkey-123" });
		prisma.follow.deleteMany = vi.fn().mockResolvedValue({ count: 1 });
		mockDeleteRecord.mockRejectedValue({ status: 404 });

		await expect(
			service.unfollow("did:plc:self", session, "did:plc:target"),
		).resolves.toBeUndefined();
		expect(prisma.follow.deleteMany).toHaveBeenCalledTimes(1);
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

	it("attaches circle membership only to the viewer's own following list", async () => {
		const circlePrisma = {
			...prisma,
			circleMember: { findMany: vi.fn() },
		} as unknown as PrismaService;
		circlePrisma.user.findUnique = vi
			.fn()
			.mockResolvedValue({ did: "did:plc:self", handle: "self" });
		circlePrisma.follow.count = vi.fn().mockResolvedValue(1);
		circlePrisma.follow.findMany = vi
			.fn()
			.mockResolvedValueOnce([{ followingDid: "did:plc:friend" }])
			.mockResolvedValueOnce([{ followingDid: "did:plc:friend" }])
			.mockResolvedValueOnce([]);
		circlePrisma.user.findMany = vi
			.fn()
			.mockResolvedValue([
				makeUser("did:plc:friend", "friend", "Friend", 1, 1),
			]);
		circlePrisma.circleMember.findMany = vi
			.fn()
			.mockResolvedValue([
				{ circleId: "circle-1", followingDid: "did:plc:friend" },
			]);

		const following = await buildFollowsService(circlePrisma).getFollowing(
			"did:plc:self",
			"self",
			1,
			10,
		);

		expect(circlePrisma.circleMember.findMany).toHaveBeenCalledWith({
			where: {
				followerDid: "did:plc:self",
				followingDid: { in: ["did:plc:friend"] },
			},
			select: { circleId: true, followingDid: true },
		});
		expect(following.items[0]).toMatchObject({
			did: "did:plc:friend",
			circleIds: ["circle-1"],
		});
	});

	it("throws when a relationship target is missing", async () => {
		prisma.user.findUnique = vi.fn().mockResolvedValue(null);

		await expect(
			service.getRelationship("did:plc:self", "did:plc:missing"),
		).rejects.toThrow(NotFoundException);
	});
});

function buildFollowsService(prisma: PrismaService) {
	const users = new SocialUsersService(prisma);
	return new FollowsService(prisma, users, new CirclesService(prisma, users));
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
