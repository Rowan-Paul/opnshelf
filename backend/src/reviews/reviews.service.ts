import { rebaseAvatarUrl } from "../users/avatar-url";
import { Agent } from "@atproto/api";
import { TID } from "@atproto/common";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
	$nsid as REVIEW_COLLECTION,
	main as reviewSchema,
} from "../lexicons/xyz/opnshelf/review";
import type { Main as ReviewRecord } from "../lexicons/xyz/opnshelf/review.defs";
import type { Main as ReviewLikeRecord } from "../lexicons/xyz/opnshelf/review/like.defs";
import { $nsid as PUBLICATION_COLLECTION } from "../lexicons/site/standard/publication";
import type { Main as PublicationRecord } from "../lexicons/site/standard/publication.defs";
import { PrismaService } from "../prisma/prisma.service";
import {
	BlogMirrorService,
	detectPublicationService,
	type PublicationService,
} from "./blog-mirror.service";
import {
	type BlueskyCrossPostResult,
	BlueskyCrossPostService,
} from "./bluesky-cross-post.service";
import { ReviewLikesService } from "./review-likes.service";
import { ReviewMediaService } from "./review-media.service";
import { excerptOf, PUBLIC_SITE_ORIGIN } from "./review-presentation";
import type {
	CreateReviewDto,
	MediaReviewsQueryDto,
	UpdateReviewDto,
} from "./dto/review.dto";

export interface ATSession {
	did: string;
}

export type { BlueskyCrossPostResult } from "./bluesky-cross-post.service";

const PUBLICATION_LIST_LIMIT = 100;

/**
 * Reviews: the xyz.opnshelf.review record in the author's repo (ADR-0013), its
 * local index, and the read paths that enrich it. The optional Blog Mirror,
 * Bluesky Cross-post and Review Likes are delegated to their own services.
 */
@Injectable()
export class ReviewsService {
	private readonly logger = new Logger(ReviewsService.name);

	constructor(
		private prisma: PrismaService,
		private reviewMedia: ReviewMediaService,
		private blogMirror: BlogMirrorService,
		private blueskyCrossPost: BlueskyCrossPostService,
		private reviewLikes: ReviewLikesService,
	) {}

	async getReview(reviewId: string) {
		return this.prisma.review.findUnique({ where: { id: reviewId } });
	}

	/**
	 * Resolve the canonical public review page (ADR-0013): `/reviews/{handle}/{rkey}`.
	 * Reviews are opnshelf-owned records, so the rkey is the stable identifier —
	 * there is no document `path` any more. Throws NotFoundException for an
	 * unknown handle or rkey so the controller surfaces a clean 404.
	 */
	async getCanonicalReview(handle: string, rkey: string) {
		const normalizedHandle = handle.trim().replace(/^@/, "").toLowerCase();
		const user = await this.prisma.user.findUnique({
			where: { handle: normalizedHandle },
			select: { did: true, handle: true, displayName: true, avatar: true },
		});
		if (!user) {
			throw new NotFoundException("Review not found");
		}

		const review = await this.prisma.review.findFirst({
			where: { userDid: user.did, rkey },
		});
		if (!review) {
			throw new NotFoundException("Review not found");
		}

		const mediaByReviewId = await this.reviewMedia.enrichMediaForReviews([
			review,
		]);
		const media = mediaByReviewId.get(review.id);

		return {
			id: review.id,
			rkey: review.rkey,
			title: review.title,
			markdown: review.markdown,
			spoiler: review.spoiler,
			description: excerptOf(review.markdown),
			mediaType: review.mediaType,
			mediaId: review.mediaId,
			seasonNumber: review.seasonNumber,
			episodeNumber: review.episodeNumber,
			mediaLabel: media?.label ?? null,
			mediaTitle: media?.mediaTitle ?? null,
			posterPath: media?.posterPath ?? null,
			author: {
				did: user.did,
				handle: user.handle,
				displayName: user.displayName,
				avatar: rebaseAvatarUrl(user.avatar),
			},
			canonicalUrl: `${PUBLIC_SITE_ORIGIN}/reviews/${user.handle}/${review.rkey}`,
			createdAt: review.createdAt,
			updatedAt: review.updatedAt,
		};
	}

	async retryBlueskyCrossPost(
		userDid: string,
		session: ATSession,
		reviewId: string,
	): Promise<BlueskyCrossPostResult> {
		const review = await this.prisma.review.findFirst({
			where: { id: reviewId, userDid },
		});
		if (!review) throw new NotFoundException("Review not found");
		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);
		try {
			return await this.blueskyCrossPost.write(userDid, agent, review);
		} catch (error) {
			this.logger.warn(
				`Bluesky Cross-post failed for review ${review.rkey}`,
				error instanceof Error ? error.stack : undefined,
			);
			return { status: "failed" };
		}
	}

	async getUserReviews(
		userDid: string,
		limit = 20,
		cursor?: string,
		requestingUserDid?: string,
	) {
		const take = limit + 1;

		const reviews = await this.prisma.review.findMany({
			where: { userDid },
			orderBy: { createdAt: "desc" },
			take,
			...(cursor && {
				skip: 1,
				cursor: { id: cursor },
			}),
			include: {
				_count: { select: { likes: true } },
				likes: requestingUserDid
					? {
							where: { userDid: requestingUserDid },
							select: { id: true },
							take: 1,
						}
					: (false as const),
			},
		});

		const hasMore = reviews.length > limit;
		const items = hasMore ? reviews.slice(0, limit) : reviews;
		const nextCursor = hasMore ? items[items.length - 1]?.id : null;

		const total = await this.prisma.review.count({
			where: { userDid },
		});

		// A profile page can mix movies, shows, seasons, and episodes. Fetch the
		// user's separate Ratings in one query, matching every review by its exact
		// media coordinates.
		const ratingCoordinates = Array.from(
			new Map(
				items.map((review) => {
					const coordinates = {
						mediaType: review.mediaType,
						mediaId: review.mediaId,
						seasonNumber: review.seasonNumber ?? 0,
						episodeNumber: review.episodeNumber ?? 0,
					};
					return [JSON.stringify(coordinates), coordinates] as const;
				}),
			).values(),
		);
		const ratings =
			ratingCoordinates.length > 0
				? await this.prisma.rating.findMany({
						where: { userDid, OR: ratingCoordinates },
						select: {
							mediaType: true,
							mediaId: true,
							seasonNumber: true,
							episodeNumber: true,
							rating: true,
						},
					})
				: [];
		const ratingByCoordinates = new Map(
			ratings.map((rating) => [
				JSON.stringify({
					mediaType: rating.mediaType,
					mediaId: rating.mediaId,
					seasonNumber: rating.seasonNumber,
					episodeNumber: rating.episodeNumber,
				}),
				rating.rating,
			]),
		);

		const mediaByReviewId = await this.reviewMedia.enrichMediaForReviews(items);

		const enrichedItems = items.map((review) => {
			const media = mediaByReviewId.get(review.id);
			return {
				...review,
				description: excerptOf(review.markdown),
				mediaLabel: media?.label,
				mediaTitle: media?.mediaTitle,
				posterPath: media?.posterPath,
				likeCount: review._count.likes,
				hasLiked: requestingUserDid ? review.likes.length > 0 : false,
				authorRating:
					ratingByCoordinates.get(
						JSON.stringify({
							mediaType: review.mediaType,
							mediaId: review.mediaId,
							seasonNumber: review.seasonNumber ?? 0,
							episodeNumber: review.episodeNumber ?? 0,
						}),
					) ?? null,
			};
		});

		return {
			items: enrichedItems,
			nextCursor,
			total,
		};
	}

	async getMediaReviews(
		query: MediaReviewsQueryDto,
		requestingUserDid?: string,
	) {
		const {
			mediaType,
			mediaId,
			seasonNumber,
			episodeNumber,
			limit = 20,
			pinnedReviewId,
		} = query;
		const take = limit + 1;

		const where = {
			mediaType,
			mediaId,
			seasonNumber: seasonNumber ?? 0,
			episodeNumber: episodeNumber ?? 0,
		};

		// Community-appreciation ordering: most-liked first, then most recent. The
		// author's own Rating is fetched per item below as a tiebreak among reviews
		// with identical like counts — the rating comes from the separate Rating
		// entity joined by (userDid + media coordinates), never from the review
		// (reviews carry no score). DB-level order stays (likeCount desc, createdAt
		// desc) so cursor pagination remains stable; the rating only reorders ties
		// within a returned page.
		const include = {
			user: {
				select: {
					did: true,
					handle: true,
					displayName: true,
					avatar: true,
				},
			},
			_count: {
				select: { likes: true },
			},
			likes: requestingUserDid
				? {
						where: { userDid: requestingUserDid },
						select: { id: true },
						take: 1,
					}
				: (false as const),
		};

		const reviews = await this.prisma.review.findMany({
			where,
			orderBy: [{ likes: { _count: "desc" } }, { createdAt: "desc" }],
			take,
			...(query.cursor && {
				skip: 1,
				cursor: { id: query.cursor },
			}),
			include,
		});

		const hasMore = reviews.length > limit;
		const items = hasMore ? reviews.slice(0, limit) : reviews;
		const nextCursor = hasMore ? items[items.length - 1]?.id : null;

		// Deep-link support: guarantee a specifically requested review is present
		// even when community ordering would push it past this page.
		if (pinnedReviewId && !items.some((r) => r.id === pinnedReviewId)) {
			const pinned = await this.prisma.review.findFirst({
				where: { ...where, id: pinnedReviewId },
				include,
			});
			if (pinned) {
				items.unshift(pinned);
			}
		}

		const total = await this.prisma.review.count({ where });

		// Join each author's separate Rating for this exact media item. There is no
		// stored pointer from a review to a rating — they correlate only by
		// (userDid + media coordinates).
		const authorDids = Array.from(new Set(items.map((r) => r.userDid)));
		const authorRatings =
			authorDids.length > 0
				? await this.prisma.rating.findMany({
						where: { ...where, userDid: { in: authorDids } },
						select: { userDid: true, rating: true },
					})
				: [];
		const ratingByAuthor = new Map<string, number>();
		for (const r of authorRatings) {
			ratingByAuthor.set(r.userDid, r.rating);
		}

		const mediaByReviewId = await this.reviewMedia.enrichMediaForReviews(items);
		const enrichedItems = items.map((review) => ({
			...review,
			description: excerptOf(review.markdown),
			likeCount: review._count.likes,
			hasLiked: requestingUserDid ? review.likes.length > 0 : false,
			authorRating: ratingByAuthor.get(review.userDid) ?? null,
		}));

		// Apply the rating tiebreak among equal-likeCount neighbours, preserving
		// the DB createdAt order for items with no/identical ratings. Stable sort
		// keeps the cursor-defining order intact across pages.
		enrichedItems.sort((a, b) => {
			if (b.likeCount !== a.likeCount) return 0;
			const ra = a.authorRating ?? -1;
			const rb = b.authorRating ?? -1;
			return rb - ra;
		});

		return {
			items: enrichedItems.map((review) => {
				const media = mediaByReviewId.get(review.id);
				return {
					...review,
					mediaLabel: media?.label,
					mediaTitle: media?.mediaTitle,
					posterPath: media?.posterPath ?? null,
				};
			}),
			total,
			nextCursor,
		};
	}

	/**
	 * Enumerate the user's own site.standard.publication records straight from
	 * their PDS. This live list — not the local cache — is the picker's source of
	 * truth and its ownership validation: only publications that exist in the
	 * requesting user's own repo can be returned. opnshelf no longer mints
	 * publications (ADR-0013), so there is no "opnshelf default" among them.
	 */
	async listMyPublications(
		userDid: string,
		session: ATSession,
	): Promise<
		Array<{
			uri: string;
			name: string;
			url: string;
			service: PublicationService;
		}>
	> {
		const user = await this.prisma.user.findUnique({
			where: { did: userDid },
			select: { handle: true },
		});
		if (!user) {
			throw new NotFoundException("User not found");
		}

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		const response = await agent.com.atproto.repo.listRecords({
			repo: session.did,
			collection: PUBLICATION_COLLECTION,
			limit: PUBLICATION_LIST_LIMIT,
		});

		return response.data.records.map((rec) => {
			const value = rec.value as {
				name?: string;
				url?: string;
				theme?: { $type?: string };
			};
			const url = value.url ?? "";
			return {
				uri: rec.uri,
				name: value.name ?? url,
				url,
				service: detectPublicationService(value),
			};
		});
	}

	async createReview(
		userDid: string,
		session: ATSession,
		dto: CreateReviewDto,
	) {
		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		const rkey = TID.nextStr();
		const now = new Date().toISOString();

		// mirrorToBlog is an opnshelf mirroring preference (like the publication
		// target on the User row), not review content — it lives only in the DB,
		// never on the federated review record.
		const mirrorToBlog = dto.mirrorToBlog ?? true;
		const record = reviewSchema.build({
			mediaType: dto.mediaType,
			mediaId: dto.mediaId,
			seasonNumber: dto.seasonNumber,
			episodeNumber: dto.episodeNumber,
			title: dto.title,
			content: dto.markdown,
			spoiler: dto.spoiler || undefined,
			createdAt: now as ReviewRecord["createdAt"],
			updatedAt: now as ReviewRecord["updatedAt"],
		});

		const response = await agent.com.atproto.repo.putRecord({
			repo: session.did,
			collection: REVIEW_COLLECTION,
			rkey,
			record,
			validate: false,
		});

		const created = await this.prisma.review.create({
			data: {
				rkey,
				uri: response.data.uri,
				cid: response.data.cid,
				userDid,
				mediaType: dto.mediaType,
				mediaId: dto.mediaId,
				seasonNumber: dto.seasonNumber ?? 0,
				episodeNumber: dto.episodeNumber ?? 0,
				title: dto.title,
				markdown: dto.markdown,
				spoiler: dto.spoiler ?? false,
				mirrorToBlog,
			},
		});

		const mirror = await this.blogMirror.sync(userDid, agent, created);
		let finalReview = created;
		if (mirror.blogDocumentUri !== created.blogDocumentUri) {
			finalReview = await this.prisma.review.update({
				where: { id: created.id },
				data: mirror,
			});
		}

		let blueskyCrossPost: BlueskyCrossPostResult = {
			status: "not_requested",
		};
		if (dto.postToBluesky) {
			try {
				blueskyCrossPost = await this.blueskyCrossPost.write(
					userDid,
					agent,
					finalReview,
				);
			} catch (error) {
				this.logger.warn(
					`Bluesky Cross-post failed for review ${finalReview.rkey}`,
					error instanceof Error ? error.stack : undefined,
				);
				blueskyCrossPost = { status: "failed" };
			}
		}

		return { ...finalReview, blueskyCrossPost };
	}

	async updateReview(
		userDid: string,
		session: ATSession,
		reviewId: string,
		dto: UpdateReviewDto,
	) {
		const existing = await this.prisma.review.findFirst({
			where: { id: reviewId, userDid },
		});
		if (!existing) {
			throw new NotFoundException("Review not found");
		}

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		const title = dto.title ?? existing.title;
		const markdown = dto.markdown ?? existing.markdown;
		const mirrorToBlog = dto.mirrorToBlog ?? existing.mirrorToBlog;
		const spoiler = dto.spoiler ?? existing.spoiler;

		const record = reviewSchema.build({
			mediaType: existing.mediaType,
			mediaId: existing.mediaId,
			seasonNumber: existing.seasonNumber || undefined,
			episodeNumber: existing.episodeNumber || undefined,
			title,
			content: markdown,
			spoiler: spoiler || undefined,
			createdAt: existing.createdAt.toISOString() as ReviewRecord["createdAt"],
			updatedAt: new Date().toISOString() as ReviewRecord["updatedAt"],
		});

		const response = await agent.com.atproto.repo.putRecord({
			repo: session.did,
			collection: REVIEW_COLLECTION,
			rkey: existing.rkey,
			record,
			validate: false,
		});

		const mirror = await this.blogMirror.sync(userDid, agent, {
			...existing,
			title,
			markdown,
			spoiler,
			mirrorToBlog,
		});

		return this.prisma.review.update({
			where: { id: existing.id },
			data: {
				cid: response.data.cid,
				title,
				markdown,
				spoiler,
				mirrorToBlog,
				...mirror,
			},
		});
	}

	async deleteReview(
		userDid: string,
		session: ATSession,
		reviewId: string,
	): Promise<void> {
		const review = await this.prisma.review.findFirst({
			where: { id: reviewId, userDid },
		});

		if (!review) {
			throw new NotFoundException("Review not found");
		}

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		await agent.com.atproto.repo.deleteRecord({
			repo: session.did,
			collection: REVIEW_COLLECTION,
			rkey: review.rkey,
		});

		await this.blogMirror.delete(session.did, agent, review);

		await this.prisma.review.delete({
			where: { id: reviewId },
		});
	}

	/**
	 * Mirror all of a user's existing reviews to their currently-configured blog
	 * (ADR-0013). Called when the author first selects a publication so reviews
	 * written *before* enabling the blog also appear there — not just new ones.
	 * Reviews opted out (mirrorToBlog === false) are skipped inside the mirror
	 * sync. Best-effort: each review syncs independently; the sync swallows its
	 * own failures, so one bad write never aborts the rest.
	 *
	 * ponytail: inline, one PDS write per mirrored review. Fine for the handful of
	 * long-form reviews a user typically has; move to a queued job if someone
	 * turns up with hundreds.
	 */
	async backfillBlogMirror(userDid: string, session: ATSession): Promise<void> {
		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);
		const reviews = await this.prisma.review.findMany({ where: { userDid } });
		for (const review of reviews) {
			const mirror = await this.blogMirror.sync(userDid, agent, review);
			if (
				mirror.blogDocumentUri !== review.blogDocumentUri ||
				mirror.blogDocumentCid !== review.blogDocumentCid
			) {
				await this.prisma.review.update({
					where: { id: review.id },
					data: mirror,
				});
			}
		}
	}

	async likeReview(userDid: string, session: ATSession, reviewId: string) {
		return this.reviewLikes.like(userDid, session, reviewId);
	}

	async unlikeReview(userDid: string, session: ATSession, reviewId: string) {
		return this.reviewLikes.unlike(userDid, session, reviewId);
	}

	async getReviewLikes(reviewId: string, requestingUserDid?: string) {
		return this.reviewLikes.list(reviewId, requestingUserDid);
	}

	/**
	 * Index an xyz.opnshelf.review record from the firehose (ADR-0013). The
	 * caller (ingester) is responsible for the tracked-user check. The optional
	 * blog mirror is a separate site.standard.document and is NOT indexed as a
	 * review — only the opnshelf record is the source of truth.
	 */
	async indexReviewRecord(
		uri: string,
		cid: string,
		rkey: string,
		userDid: string,
		record: ReviewRecord,
	): Promise<void> {
		// mirrorToBlog is opnshelf-local (DB-only), not on the record: the create
		// path takes the column default (true) and updates leave it untouched, so
		// a per-review opt-out set via the API survives firehose re-indexing.
		await this.prisma.review.upsert({
			where: { userDid_rkey: { userDid, rkey } },
			create: {
				rkey,
				uri,
				cid,
				userDid,
				mediaType: record.mediaType,
				mediaId: record.mediaId,
				seasonNumber: record.seasonNumber ?? 0,
				episodeNumber: record.episodeNumber ?? 0,
				title: record.title,
				markdown: record.content,
				spoiler: record.spoiler ?? false,
			},
			update: {
				cid,
				mediaType: record.mediaType,
				mediaId: record.mediaId,
				seasonNumber: record.seasonNumber ?? 0,
				episodeNumber: record.episodeNumber ?? 0,
				title: record.title,
				markdown: record.content,
				spoiler: record.spoiler ?? false,
			},
		});
	}

	async deleteReviewRecord(userDid: string, rkey: string): Promise<void> {
		await this.prisma.review.deleteMany({
			where: { userDid, rkey },
		});
	}

	async indexPublicationRecord(
		uri: string,
		cid: string,
		rkey: string,
		userDid: string,
		record: PublicationRecord,
	): Promise<void> {
		// A repo may hold MANY publications (key is `tid`), so index by the
		// repository-qualified record key.
		await this.prisma.publication.upsert({
			where: { userDid_rkey: { userDid, rkey } },
			create: {
				rkey,
				uri,
				cid,
				userDid,
				name: record.name,
				url: record.url,
			},
			update: {
				uri,
				cid,
				name: record.name,
				url: record.url,
			},
		});
	}

	async deletePublicationRecord(userDid: string, rkey: string): Promise<void> {
		await this.prisma.publication.deleteMany({
			where: { userDid, rkey },
		});
	}

	async indexReviewLikeRecord(
		uri: string,
		cid: string,
		rkey: string,
		userDid: string,
		record: ReviewLikeRecord,
	): Promise<void> {
		return this.reviewLikes.indexRecord(uri, cid, rkey, userDid, record);
	}

	async deleteReviewLikeRecord(userDid: string, rkey: string): Promise<void> {
		return this.reviewLikes.deleteRecord(userDid, rkey);
	}
}
