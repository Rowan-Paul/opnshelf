import { Agent } from "@atproto/api";
import { TID } from "@atproto/common";
import { BadRequestException, Injectable } from "@nestjs/common";
import {
	$nsid as FOLLOW_COLLECTION,
	main as followSchema,
} from "../lexicons/xyz/opnshelf/follow";
import type { Main as FollowRecord } from "../lexicons/xyz/opnshelf/follow.defs";
import { PrismaService } from "../prisma/prisma.service";
import { isAtprotoRecordMissingError } from "../common/atproto-record-errors";
import type {
	PaginatedSocialUsersDto,
	SocialUserCardDto,
	UserRelationshipDto,
} from "./dto/social.dto";
import { CirclesService } from "./circles.service";
import {
	clampPage,
	clampPageSize,
	DEFAULT_SOCIAL_PAGE_SIZE,
	getPaginationMeta,
	MAX_SOCIAL_PAGE_SIZE,
} from "./social-pagination";
import { SocialUsersService } from "./social-users.service";

export interface ATSession {
	did: string;
}

/**
 * The Follow graph: `xyz.opnshelf.follow` records written to the user's PDS,
 * mirrored into the local `Follow` table (directly on follow/unfollow, and
 * from the firehose through the ingester's index methods).
 */
@Injectable()
export class FollowsService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly users: SocialUsersService,
		private readonly circles: CirclesService,
	) {}

	async follow(
		viewerDid: string,
		session: ATSession,
		targetDid: string,
	): Promise<UserRelationshipDto> {
		await this.assertCanFollow(viewerDid, targetDid);
		const existingFollow = await this.prisma.follow.findFirst({
			where: {
				followerDid: viewerDid,
				followingDid: targetDid,
			},
			select: { rkey: true },
		});

		if (existingFollow?.rkey) {
			return this.getRelationship(viewerDid, targetDid);
		}

		const { rkey, uri, cid, createdAt } = await this.createFollowRecord(
			session,
			targetDid,
		);

		if (existingFollow) {
			await this.prisma.follow.update({
				where: {
					followerDid_followingDid: {
						followerDid: viewerDid,
						followingDid: targetDid,
					},
				},
				data: { rkey, uri, cid, createdAt },
			});
		} else {
			await this.prisma.follow.create({
				data: {
					followerDid: viewerDid,
					followingDid: targetDid,
					rkey,
					uri,
					cid,
					createdAt,
				},
			});
		}

		return this.getRelationship(viewerDid, targetDid);
	}

	async unfollow(
		viewerDid: string,
		session: ATSession,
		targetDid: string,
	): Promise<void> {
		await this.users.assertTargetUserExists(targetDid);

		if (viewerDid === targetDid) {
			return;
		}

		const existingFollow = await this.prisma.follow.findFirst({
			where: {
				followerDid: viewerDid,
				followingDid: targetDid,
			},
			select: { rkey: true },
		});

		if (existingFollow?.rkey) {
			await this.deleteFollowRecord(session, existingFollow.rkey);
		}

		await this.prisma.follow.deleteMany({
			where: {
				followerDid: viewerDid,
				followingDid: targetDid,
			},
		});
	}

	async getRelationship(
		viewerDid: string,
		targetDid: string,
	): Promise<UserRelationshipDto> {
		await this.users.assertTargetUserExists(targetDid);

		if (viewerDid === targetDid) {
			return {
				targetDid,
				isFollowing: false,
				isFollowedBy: false,
				canFollow: false,
			};
		}

		const [isFollowing, isFollowedBy] = await Promise.all([
			this.prisma.follow.count({
				where: {
					followerDid: viewerDid,
					followingDid: targetDid,
				},
			}),
			this.prisma.follow.count({
				where: {
					followerDid: targetDid,
					followingDid: viewerDid,
				},
			}),
		]);

		return {
			targetDid,
			isFollowing: isFollowing > 0,
			isFollowedBy: isFollowedBy > 0,
			canFollow: true,
		};
	}

	async getFollowers(
		viewerDid: string | null,
		handle: string,
		page = 1,
		pageSize = DEFAULT_SOCIAL_PAGE_SIZE,
	): Promise<PaginatedSocialUsersDto> {
		const targetUser = await this.users.findUserByHandle(handle);
		const safePageSize = clampPageSize(pageSize, MAX_SOCIAL_PAGE_SIZE);
		const safePage = clampPage(page);

		const total = await this.prisma.follow.count({
			where: { followingDid: targetUser.did },
		});
		const pagination = getPaginationMeta(total, safePage, safePageSize);
		const follows =
			total === 0
				? []
				: await this.prisma.follow.findMany({
						where: { followingDid: targetUser.did },
						select: { followerDid: true },
						orderBy: [{ createdAt: "desc" }, { followerDid: "asc" }],
						skip: (pagination.page - 1) * safePageSize,
						take: safePageSize,
					});

		const cards = await this.users.buildSocialUserCards(
			follows.map((follow) => follow.followerDid),
			viewerDid,
		);

		return {
			...pagination,
			items: follows
				.map((follow) => cards.get(follow.followerDid))
				.filter((item): item is SocialUserCardDto => Boolean(item)),
		};
	}

	async getFollowing(
		viewerDid: string | null,
		handle: string,
		page = 1,
		pageSize = DEFAULT_SOCIAL_PAGE_SIZE,
	): Promise<PaginatedSocialUsersDto> {
		const targetUser = await this.users.findUserByHandle(handle);
		const safePageSize = clampPageSize(pageSize, MAX_SOCIAL_PAGE_SIZE);
		const safePage = clampPage(page);

		const total = await this.prisma.follow.count({
			where: { followerDid: targetUser.did },
		});
		const pagination = getPaginationMeta(total, safePage, safePageSize);
		const follows =
			total === 0
				? []
				: await this.prisma.follow.findMany({
						where: { followerDid: targetUser.did },
						select: { followingDid: true },
						orderBy: [{ createdAt: "desc" }, { followingDid: "asc" }],
						skip: (pagination.page - 1) * safePageSize,
						take: safePageSize,
					});

		const cards = await this.users.buildSocialUserCards(
			follows.map((follow) => follow.followingDid),
			viewerDid,
		);

		// Circles are the viewer's private grouping of their own follows, so only
		// attach membership when the viewer is looking at their own following list.
		if (viewerDid && viewerDid === targetUser.did) {
			await this.circles.attachCircleMembership(
				viewerDid,
				follows.map((follow) => follow.followingDid),
				cards,
			);
		}

		return {
			...pagination,
			items: follows
				.map((follow) => cards.get(follow.followingDid))
				.filter((item): item is SocialUserCardDto => Boolean(item)),
		};
	}

	async indexFollowRecord(
		followerDid: string,
		rkey: string,
		cid: string | undefined,
		record: FollowRecord,
		uri?: string,
	) {
		await this.users.assertTargetUserExists(record.subjectDid);

		const existingFollow = await this.prisma.follow.findFirst({
			where: {
				followerDid,
				followingDid: record.subjectDid,
			},
			select: {
				followerDid: true,
				followingDid: true,
			},
		});

		const data = {
			rkey,
			cid,
			uri: uri ?? `at://${followerDid}/${FOLLOW_COLLECTION}/${rkey}`,
			createdAt: new Date(record.createdAt),
		};

		if (existingFollow) {
			return this.prisma.follow.update({
				where: {
					followerDid_followingDid: {
						followerDid,
						followingDid: record.subjectDid,
					},
				},
				data,
			});
		}

		return this.prisma.follow.create({
			data: {
				followerDid,
				followingDid: record.subjectDid,
				...data,
			},
		});
	}

	async deleteFollowRecordIndex(followerDid: string, rkey: string) {
		return this.prisma.follow.deleteMany({
			where: {
				followerDid,
				rkey,
			},
		});
	}

	private async assertCanFollow(viewerDid: string, targetDid: string) {
		if (viewerDid === targetDid) {
			throw new BadRequestException("Users cannot follow themselves");
		}

		await this.users.assertTargetUserExists(targetDid);
	}

	private async createFollowRecord(session: ATSession, targetDid: string) {
		const rkey = TID.nextStr();
		const createdAt = new Date();
		const record: FollowRecord = followSchema.build({
			subjectDid: targetDid,
			createdAt: createdAt.toISOString(),
		});

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);
		const response = await agent.com.atproto.repo.putRecord({
			repo: session.did,
			collection: FOLLOW_COLLECTION,
			rkey,
			record,
			validate: false,
		});

		return {
			rkey,
			uri: response.data.uri,
			cid: response.data.cid,
			createdAt,
		};
	}

	private async deleteFollowRecord(session: ATSession, rkey: string) {
		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		try {
			await agent.com.atproto.repo.deleteRecord({
				repo: session.did,
				collection: FOLLOW_COLLECTION,
				rkey,
			});
		} catch (error) {
			if (!isAtprotoRecordMissingError(error)) throw error;
		}
	}
}
