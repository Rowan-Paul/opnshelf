import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../generated/client";
import { PrismaService } from "../prisma/prisma.service";
import type {
	CircleDto,
	PaginatedSocialUsersDto,
	SocialUserCardDto,
} from "./dto/social.dto";
import {
	clampPage,
	clampPageSize,
	DEFAULT_SOCIAL_PAGE_SIZE,
	getPaginationMeta,
	MAX_SOCIAL_PAGE_SIZE,
} from "./social-pagination";
import { SocialUsersService } from "./social-users.service";

/**
 * Circles: the viewer's private, local-only grouping of Users they follow
 * (ADR 0010). Never written to the PDS.
 */
@Injectable()
export class CirclesService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly users: SocialUsersService,
	) {}

	async listCircles(viewerDid: string): Promise<CircleDto[]> {
		const circles = await this.prisma.circle.findMany({
			where: { ownerDid: viewerDid },
			select: {
				id: true,
				name: true,
				createdAt: true,
				_count: { select: { members: true } },
			},
			orderBy: [{ name: "asc" }],
		});

		return circles.map((circle) => ({
			id: circle.id,
			name: circle.name,
			memberCount: circle._count.members,
			createdAt: circle.createdAt.toISOString(),
		}));
	}

	async createCircle(viewerDid: string, name: string): Promise<CircleDto> {
		const trimmed = name.trim();
		if (trimmed.length === 0) {
			throw new BadRequestException("Circle name is required");
		}

		try {
			const circle = await this.prisma.circle.create({
				data: { ownerDid: viewerDid, name: trimmed },
				select: { id: true, name: true, createdAt: true },
			});
			return {
				id: circle.id,
				name: circle.name,
				memberCount: 0,
				createdAt: circle.createdAt.toISOString(),
			};
		} catch (error) {
			if (isUniqueConstraintError(error)) {
				throw new BadRequestException(
					"You already have a circle with that name",
				);
			}
			throw error;
		}
	}

	async renameCircle(
		viewerDid: string,
		circleId: string,
		name: string,
	): Promise<CircleDto> {
		const trimmed = name.trim();
		if (trimmed.length === 0) {
			throw new BadRequestException("Circle name is required");
		}
		await this.assertCircleOwned(viewerDid, circleId);

		try {
			const circle = await this.prisma.circle.update({
				where: { id: circleId },
				data: { name: trimmed },
				select: {
					id: true,
					name: true,
					createdAt: true,
					_count: { select: { members: true } },
				},
			});
			return {
				id: circle.id,
				name: circle.name,
				memberCount: circle._count.members,
				createdAt: circle.createdAt.toISOString(),
			};
		} catch (error) {
			if (isUniqueConstraintError(error)) {
				throw new BadRequestException(
					"You already have a circle with that name",
				);
			}
			throw error;
		}
	}

	async deleteCircle(viewerDid: string, circleId: string): Promise<void> {
		await this.assertCircleOwned(viewerDid, circleId);
		// Members cascade-delete with the circle.
		await this.prisma.circle.delete({ where: { id: circleId } });
	}

	async addCircleMember(
		viewerDid: string,
		circleId: string,
		targetDid: string,
	): Promise<void> {
		await this.assertCircleOwned(viewerDid, circleId);

		const follow = await this.prisma.follow.findUnique({
			where: {
				followerDid_followingDid: {
					followerDid: viewerDid,
					followingDid: targetDid,
				},
			},
			select: { followerDid: true },
		});
		if (!follow) {
			throw new BadRequestException(
				"You can only add users you follow to a circle",
			);
		}

		await this.prisma.circleMember.upsert({
			where: {
				circleId_followingDid: { circleId, followingDid: targetDid },
			},
			create: { circleId, followerDid: viewerDid, followingDid: targetDid },
			update: {},
		});
	}

	async removeCircleMember(
		viewerDid: string,
		circleId: string,
		targetDid: string,
	): Promise<void> {
		await this.assertCircleOwned(viewerDid, circleId);
		await this.prisma.circleMember.deleteMany({
			where: { circleId, followingDid: targetDid },
		});
	}

	/** Members of one of the viewer's circles (paginated), as social cards. */
	async getCircleMembers(
		viewerDid: string,
		circleId: string,
		page = 1,
		pageSize = DEFAULT_SOCIAL_PAGE_SIZE,
	): Promise<PaginatedSocialUsersDto> {
		await this.assertCircleOwned(viewerDid, circleId);
		const safePageSize = clampPageSize(pageSize, MAX_SOCIAL_PAGE_SIZE);
		const safePage = clampPage(page);

		const total = await this.prisma.circleMember.count({ where: { circleId } });
		const pagination = getPaginationMeta(total, safePage, safePageSize);
		const members =
			total === 0
				? []
				: await this.prisma.circleMember.findMany({
						where: { circleId },
						select: { followingDid: true },
						orderBy: [{ createdAt: "desc" }, { followingDid: "asc" }],
						skip: (pagination.page - 1) * safePageSize,
						take: safePageSize,
					});

		const dids = members.map((member) => member.followingDid);
		const cards = await this.users.buildSocialUserCards(dids, viewerDid);
		await this.attachCircleMembership(viewerDid, dids, cards);

		return {
			...pagination,
			items: dids
				.map((did) => cards.get(did))
				.filter((item): item is SocialUserCardDto => Boolean(item)),
		};
	}

	/**
	 * Annotates each card with the ids of the viewer's circles the user is in.
	 * Callers decide whether the viewer may see membership at all: it belongs
	 * only on the viewer's own following list and circle member lists.
	 */
	async attachCircleMembership(
		viewerDid: string,
		followingDids: string[],
		cards: Map<string, SocialUserCardDto>,
	) {
		if (followingDids.length === 0) {
			return;
		}
		const memberships = await this.prisma.circleMember.findMany({
			where: { followerDid: viewerDid, followingDid: { in: followingDids } },
			select: { circleId: true, followingDid: true },
		});

		const byUser = new Map<string, string[]>();
		for (const member of memberships) {
			const existing = byUser.get(member.followingDid);
			if (existing) {
				existing.push(member.circleId);
			} else {
				byUser.set(member.followingDid, [member.circleId]);
			}
		}

		for (const [did, card] of cards) {
			card.circleIds = byUser.get(did) ?? [];
		}
	}

	/** DIDs of the members of one of the viewer's circles, after an ownership check. */
	async getCircleMemberDids(
		viewerDid: string,
		circleId: string,
	): Promise<string[]> {
		await this.assertCircleOwned(viewerDid, circleId);
		const members = await this.prisma.circleMember.findMany({
			where: { circleId },
			select: { followingDid: true },
		});
		return members.map((member) => member.followingDid);
	}

	private async assertCircleOwned(viewerDid: string, circleId: string) {
		const circle = await this.prisma.circle.findUnique({
			where: { id: circleId },
			select: { ownerDid: true },
		});
		if (!circle || circle.ownerDid !== viewerDid) {
			throw new NotFoundException("Circle not found");
		}
	}
}

function isUniqueConstraintError(error: unknown): boolean {
	return (
		error instanceof Prisma.PrismaClientKnownRequestError &&
		error.code === "P2002"
	);
}
