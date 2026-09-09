import { BadRequestException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";
import { SocialUsersService } from "./social-users.service";

describe("SocialUsersService", () => {
	let service: SocialUsersService;

	const prismaMock = {
		$queryRaw: vi.fn(),
		user: {
			findUnique: vi.fn(),
			findMany: vi.fn(),
		},
		follow: {
			findMany: vi.fn(),
		},
	};
	const prisma = prismaMock as unknown as PrismaService;

	beforeEach(() => {
		vi.clearAllMocks();
		service = new SocialUsersService(prisma);
	});

	it("searches people without returning the viewer and ranks stronger handle matches first", async () => {
		prismaMock.$queryRaw.mockResolvedValue([
			rankedUser("did:plc:exact", "al", "Al Exact", 2, 1),
			rankedUser("did:plc:prefix", "alice", "Alice Prefix", 1, 1),
			rankedUser("did:plc:display", "bravo", "Alana Display", 99, 1),
			rankedUser("did:plc:substring", "coral", "Coral", 5, 1),
		]);
		prisma.follow.findMany = vi
			.fn()
			.mockResolvedValueOnce([{ followingDid: "did:plc:prefix" }])
			.mockResolvedValueOnce([{ followerDid: "did:plc:display" }]);

		const result = await service.searchPeople("did:plc:self", "al", 1, 10);

		expect(prismaMock.$queryRaw).toHaveBeenCalledOnce();
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

	it("rejects search queries shorter than two characters after trimming", async () => {
		await expect(service.searchPeople("did:plc:self", " @a ")).rejects.toThrow(
			BadRequestException,
		);
		expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
	});

	it("builds cards without relationship lookups for anonymous viewers", async () => {
		prisma.user.findMany = vi
			.fn()
			.mockResolvedValue([makeUser("did:plc:a", "a", "A", 4, 2)]);

		const cards = await service.buildSocialUserCards(
			["did:plc:a", "did:plc:a", "did:plc:missing"],
			null,
		);

		expect(prisma.follow.findMany).not.toHaveBeenCalled();
		expect([...cards.keys()]).toEqual(["did:plc:a"]);
		expect(cards.get("did:plc:a")).toEqual({
			did: "did:plc:a",
			handle: "a",
			displayName: "A",
			avatar: null,
			followersCount: 4,
			followingCount: 2,
			isFollowing: false,
			isFollowedBy: false,
		});
	});

	it("normalises handles before looking users up", async () => {
		prisma.user.findUnique = vi
			.fn()
			.mockResolvedValue({ did: "did:plc:target", handle: "target" });

		await expect(service.findUserByHandle(" @Target ")).resolves.toEqual({
			did: "did:plc:target",
			handle: "target",
		});
		expect(prisma.user.findUnique).toHaveBeenCalledWith({
			where: { handle: "target" },
			select: { did: true, handle: true },
		});
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

function rankedUser(
	did: string,
	handle: string,
	displayName: string,
	followersCount: number,
	followingCount: number,
) {
	return {
		did,
		handle,
		displayName,
		avatar: null,
		followersCount,
		followingCount,
	};
}
