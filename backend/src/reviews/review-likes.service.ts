import { Agent } from "@atproto/api";
import { TID } from "@atproto/common";
import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { $nsid as REVIEW_LIKE_COLLECTION } from "../lexicons/xyz/opnshelf/review/like";
import type { Main as ReviewLikeRecord } from "../lexicons/xyz/opnshelf/review/like.defs";
import { PrismaService } from "../prisma/prisma.service";
import { isAtprotoRecordMissingError } from "../common/atproto-record-errors";
import type { ATSession } from "./reviews.service";

/**
 * Review Likes: the xyz.opnshelf.review.like record in the liker's repo plus
 * its local index row. Covers the API write/read paths and firehose indexing.
 */
@Injectable()
export class ReviewLikesService {
	constructor(private prisma: PrismaService) {}

	async like(userDid: string, session: ATSession, reviewId: string) {
		const review = await this.prisma.review.findUnique({
			where: { id: reviewId },
		});

		if (!review) {
			throw new NotFoundException("Review not found");
		}

		if (review.userDid === userDid) {
			throw new ForbiddenException("Cannot like your own review");
		}

		const existingLike = await this.prisma.reviewLike.findUnique({
			where: {
				userDid_reviewId: {
					userDid,
					reviewId,
				},
			},
		});

		if (existingLike) {
			throw new ConflictException("Already liked this review");
		}

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		const rkey = TID.nextStr();
		const record: ReviewLikeRecord = {
			$type: REVIEW_LIKE_COLLECTION,
			reviewUri: review.uri as unknown as ReviewLikeRecord["reviewUri"],
			createdAt: new Date().toISOString(),
		};

		const response = await agent.com.atproto.repo.putRecord({
			repo: session.did,
			collection: REVIEW_LIKE_COLLECTION,
			rkey,
			record,
			validate: false,
		});

		const like = await this.prisma.reviewLike.create({
			data: {
				rkey,
				uri: response.data.uri,
				cid: response.data.cid,
				userDid,
				reviewId,
			},
		});

		return like;
	}

	async unlike(userDid: string, session: ATSession, reviewId: string) {
		const like = await this.prisma.reviewLike.findUnique({
			where: {
				userDid_reviewId: {
					userDid,
					reviewId,
				},
			},
		});

		if (!like) {
			throw new NotFoundException("Like not found");
		}

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		try {
			await agent.com.atproto.repo.deleteRecord({
				repo: session.did,
				collection: REVIEW_LIKE_COLLECTION,
				rkey: like.rkey,
			});
		} catch (error) {
			if (!isAtprotoRecordMissingError(error)) throw error;
		}

		await this.prisma.reviewLike.delete({
			where: { id: like.id },
		});
	}

	async list(reviewId: string, requestingUserDid?: string) {
		const [items, total, hasLiked] = await Promise.all([
			this.prisma.reviewLike.findMany({
				where: { reviewId },
				orderBy: { createdAt: "desc" },
				include: {
					user: {
						select: {
							did: true,
							handle: true,
							displayName: true,
							avatar: true,
						},
					},
				},
			}),
			this.prisma.reviewLike.count({ where: { reviewId } }),
			requestingUserDid
				? this.prisma.reviewLike
						.findUnique({
							where: {
								userDid_reviewId: {
									userDid: requestingUserDid,
									reviewId,
								},
							},
						})
						.then((l) => !!l)
				: false,
		]);

		return {
			items: items.map((like) => ({
				userDid: like.user.did,
				userHandle: like.user.handle,
				userDisplayName: like.user.displayName ?? undefined,
				userAvatar: like.user.avatar ?? undefined,
				createdAt: like.createdAt.toISOString(),
			})),
			total,
			hasLiked,
		};
	}

	async indexRecord(
		uri: string,
		cid: string,
		rkey: string,
		userDid: string,
		record: ReviewLikeRecord,
	): Promise<void> {
		const review = await this.prisma.review.findFirst({
			where: { uri: record.reviewUri },
		});

		if (!review) {
			return;
		}

		await this.prisma.reviewLike.upsert({
			where: { userDid_rkey: { userDid, rkey } },
			create: {
				rkey,
				uri,
				cid,
				userDid,
				reviewId: review.id,
			},
			update: {
				cid,
				uri,
				reviewId: review.id,
			},
		});
	}

	async deleteRecord(userDid: string, rkey: string): Promise<void> {
		await this.prisma.reviewLike.deleteMany({
			where: { userDid, rkey },
		});
	}
}
