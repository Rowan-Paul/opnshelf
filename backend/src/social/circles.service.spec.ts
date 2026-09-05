import type { Mock } from "vitest";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "../generated/client";
import type { PrismaService } from "../prisma/prisma.service";
import { CirclesService } from "./circles.service";
import type { SocialUserCardDto } from "./dto/social.dto";
import { SocialUsersService } from "./social-users.service";

describe("CirclesService", () => {
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
			user: { findMany: vi.fn().mockResolvedValue([]) },
			...overrides,
		} as unknown as PrismaService;
	}

	function buildService(prisma: PrismaService) {
		return new CirclesService(prisma, new SocialUsersService(prisma));
	}

	it("rejects a member who the viewer does not follow", async () => {
		const prisma = buildPrisma();
		prisma.circle.findUnique = vi
			.fn()
			.mockResolvedValue({ ownerDid: "did:plc:self" });
		prisma.follow.findUnique = vi.fn().mockResolvedValue(null);
		const service = buildService(prisma);

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
		const service = buildService(prisma);

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
		const service = buildService(prisma);

		await expect(
			service.createCircle("did:plc:self", "Family"),
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it("returns circle member dids only after the ownership check", async () => {
		const prisma = buildPrisma();
		prisma.circle.findUnique = vi
			.fn()
			.mockResolvedValue({ ownerDid: "did:plc:self" });
		prisma.circleMember.findMany = vi
			.fn()
			.mockResolvedValue([{ followingDid: "did:plc:a" }]);
		const service = buildService(prisma);

		await expect(
			service.getCircleMemberDids("did:plc:self", "circle-1"),
		).resolves.toEqual(["did:plc:a"]);
		await expect(
			service.getCircleMemberDids("did:plc:other", "circle-1"),
		).rejects.toBeInstanceOf(NotFoundException);
		expect((prisma.circleMember.findMany as Mock).mock.calls).toHaveLength(1);
	});

	it("attaches every circle a followed user belongs to, and an empty list otherwise", async () => {
		const prisma = buildPrisma();
		prisma.circleMember.findMany = vi.fn().mockResolvedValue([
			{ circleId: "circle-1", followingDid: "did:plc:a" },
			{ circleId: "circle-2", followingDid: "did:plc:a" },
		]);
		const service = buildService(prisma);
		const cards = new Map([
			["did:plc:a", makeCard("did:plc:a")],
			["did:plc:b", makeCard("did:plc:b")],
		]);

		await service.attachCircleMembership(
			"did:plc:self",
			["did:plc:a", "did:plc:b"],
			cards,
		);

		expect(cards.get("did:plc:a")?.circleIds).toEqual(["circle-1", "circle-2"]);
		expect(cards.get("did:plc:b")?.circleIds).toEqual([]);
	});
});

function makeCard(did: string): SocialUserCardDto {
	return {
		did,
		handle: did,
		displayName: null,
		avatar: null,
		followersCount: 0,
		followingCount: 0,
		isFollowing: true,
		isFollowedBy: false,
	};
}
