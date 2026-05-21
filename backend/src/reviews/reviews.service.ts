import { Agent } from "@atproto/api";
import { TID } from "@atproto/common";
import { Injectable, NotFoundException } from "@nestjs/common";
import {
	$nsid as REVIEW_COLLECTION,
	main as reviewSchema,
} from "../lexicons/xyz/opnshelf/review";
import type { Main as ReviewRecord } from "../lexicons/xyz/opnshelf/review.defs";
import { $nsid as REVIEW_LIKE_COLLECTION } from "../lexicons/xyz/opnshelf/review/like";
import type { Main as ReviewLikeRecord } from "../lexicons/xyz/opnshelf/review/like.defs";
import { PrismaService } from "../prisma/prisma.service";
import type {
	BatchRatingRequestDto,
	MediaReviewsQueryDto,
	UpsertReviewDto,
} from "./dto/review.dto";

export interface ATSession {
	did: string;
}

@Injectable()
export class ReviewsService {
	constructor(private prisma: PrismaService) {}

	async getReview(
		userDid: string,
		mediaType: "movie" | "show" | "season" | "episode",
		mediaId: string,
		seasonNumber?: number,
		episodeNumber?: number,
	) {
		return this.prisma.review.findUnique({
			where: {
				userDid_mediaType_mediaId_seasonNumber_episodeNumber: {
					userDid,
					mediaType,
					mediaId,
					seasonNumber: seasonNumber ?? 0,
					episodeNumber: episodeNumber ?? 0,
				},
			},
		});
	}

	async getUserReviews(userDid: string, limit: number = 20, cursor?: string) {
		const take = limit + 1;

		const reviews = await this.prisma.review.findMany({
			where: { userDid },
			orderBy: { createdAt: "desc" },
			take,
			...(cursor && {
				skip: 1,
				cursor: { id: cursor },
			}),
		});

		const hasMore = reviews.length > limit;
		const items = hasMore ? reviews.slice(0, limit) : reviews;
		const nextCursor = hasMore ? items[items.length - 1]?.id : null;

		const total = await this.prisma.review.count({
			where: { userDid },
		});

		// Fetch related movie/show/season/episode data for each review
		const movieIds = items
			.filter((r) => r.mediaType === "movie")
			.map((r) => r.mediaId);
		const showIds = items
			.filter((r) => r.mediaType === "show")
			.map((r) => r.mediaId);
		const seasonConditions = items
			.filter((r) => r.mediaType === "season")
			.map((r) => ({ showId: r.mediaId, seasonNumber: r.seasonNumber }));
		const episodeConditions = items
			.filter((r) => r.mediaType === "episode")
			.map((r) => ({
				showId: r.mediaId,
				seasonNumber: r.seasonNumber,
				episodeNumber: r.episodeNumber,
			}));

		const [movies, shows, seasons, episodes] = await Promise.all([
			movieIds.length > 0
				? this.prisma.movie.findMany({
						where: { movieId: { in: movieIds } },
					})
				: Promise.resolve([]),
			showIds.length > 0
				? this.prisma.show.findMany({
						where: { showId: { in: showIds } },
					})
				: Promise.resolve([]),
			seasonConditions.length > 0
				? this.prisma.season.findMany({
						where: { OR: seasonConditions },
						include: { show: true },
					})
				: Promise.resolve([]),
			episodeConditions.length > 0
				? this.prisma.episode.findMany({
						where: { OR: episodeConditions },
						include: { season: { include: { show: true } } },
					})
				: Promise.resolve([]),
		]);

		const movieMap = new Map<
			string,
			{ title: string; posterPath: string | null }
		>();
		for (const m of movies) {
			movieMap.set(m.movieId, { title: m.title, posterPath: m.posterPath });
		}
		const showMap = new Map<
			string,
			{ title: string; posterPath: string | null }
		>();
		for (const s of shows) {
			showMap.set(s.showId, { title: s.title, posterPath: s.posterPath });
		}
		const seasonMap = new Map<
			string,
			{ title: string; posterPath: string | null }
		>();
		for (const s of seasons) {
			const key = `${s.showId}:${s.seasonNumber}`;
			seasonMap.set(key, {
				title: `${s.show.title} — ${s.name}`,
				posterPath: s.posterPath ?? s.show.posterPath,
			});
		}
		const episodeMap = new Map<
			string,
			{ title: string; posterPath: string | null }
		>();
		for (const e of episodes) {
			const key = `${e.showId}:${e.seasonNumber}:${e.episodeNumber}`;
			episodeMap.set(key, {
				title: `${e.season.show.title} — S${e.seasonNumber}E${e.episodeNumber}: ${e.name}`,
				posterPath:
					e.stillPath ?? e.season.posterPath ?? e.season.show.posterPath,
			});
		}

		const enrichedItems = items.map((review) => {
			let media: { title: string; posterPath: string | null } | undefined;
			if (review.mediaType === "movie") {
				media = movieMap.get(review.mediaId);
			} else if (review.mediaType === "show") {
				media = showMap.get(review.mediaId);
			} else if (review.mediaType === "season") {
				media = seasonMap.get(`${review.mediaId}:${review.seasonNumber}`);
			} else if (review.mediaType === "episode") {
				media = episodeMap.get(
					`${review.mediaId}:${review.seasonNumber}:${review.episodeNumber}`,
				);
			}
			return {
				...review,
				title: media?.title,
				posterPath: media?.posterPath,
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
		} = query;
		const take = limit + 1;

		const where = {
			mediaType,
			mediaId,
			seasonNumber: seasonNumber ?? 0,
			episodeNumber: episodeNumber ?? 0,
		};

		const reviews = await this.prisma.review.findMany({
			where,
			orderBy: [
				{ likes: { _count: "desc" } },
				{ rating: "desc" },
				{ createdAt: "desc" },
			],
			take,
			...(query.cursor && {
				skip: 1,
				cursor: { id: query.cursor },
			}),
			include: {
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
					: false,
			},
		});

		const hasMore = reviews.length > limit;
		const items = hasMore ? reviews.slice(0, limit) : reviews;
		const nextCursor = hasMore ? items[items.length - 1]?.id : null;

		const total = await this.prisma.review.count({ where });

		// Calculate average rating
		const aggregate = await this.prisma.review.aggregate({
			where,
			_avg: { rating: true },
		});

		return {
			items: items.map((review) => ({
				...review,
				likeCount: review._count.likes,
				hasLiked: requestingUserDid ? review.likes.length > 0 : false,
			})),
			averageRating: aggregate._avg.rating ?? undefined,
			total,
			nextCursor,
		};
	}

	async getBatchRatings(dto: BatchRatingRequestDto) {
		const { mediaType, mediaIds } = dto;

		const results = await Promise.all(
			mediaIds.map(async (mediaId) => {
				const [aggregate, count] = await Promise.all([
					this.prisma.review.aggregate({
						where: { mediaType, mediaId },
						_avg: { rating: true },
					}),
					this.prisma.review.count({
						where: { mediaType, mediaId },
					}),
				]);

				return {
					mediaId,
					averageRating: aggregate._avg.rating ?? undefined,
					reviewCount: count,
				};
			}),
		);

		return { items: results };
	}

	async upsertReview(
		userDid: string,
		session: ATSession,
		dto: UpsertReviewDto,
	) {
		const existing = await this.prisma.review.findUnique({
			where: {
				userDid_mediaType_mediaId_seasonNumber_episodeNumber: {
					userDid,
					mediaType: dto.mediaType,
					mediaId: dto.mediaId,
					seasonNumber: dto.seasonNumber ?? 0,
					episodeNumber: dto.episodeNumber ?? 0,
				},
			},
		});

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		if (existing) {
			// Update existing review in PDS
			const record: ReviewRecord = reviewSchema.build({
				mediaType: dto.mediaType,
				mediaId: dto.mediaId,
				seasonNumber: dto.seasonNumber,
				episodeNumber: dto.episodeNumber,
				rating: dto.rating,
				content: dto.content,
				createdAt: existing.createdAt.toISOString(),
			});

			const response = await agent.com.atproto.repo.putRecord({
				repo: session.did,
				collection: REVIEW_COLLECTION,
				rkey: existing.rkey,
				record,
				validate: false,
			});

			const updated = await this.prisma.review.update({
				where: { id: existing.id },
				data: {
					cid: response.data.cid,
					rating: dto.rating,
					content: dto.content ?? null,
				},
			});

			return updated;
		}

		// Create new review
		const rkey = TID.nextStr();
		const now = new Date().toISOString();

		const record: ReviewRecord = reviewSchema.build({
			mediaType: dto.mediaType,
			mediaId: dto.mediaId,
			seasonNumber: dto.seasonNumber,
			episodeNumber: dto.episodeNumber,
			rating: dto.rating,
			content: dto.content,
			createdAt: now,
		});

		const response = await agent.com.atproto.repo.putRecord({
			repo: session.did,
			collection: REVIEW_COLLECTION,
			rkey,
			record,
			validate: false,
		});

		const review = await this.prisma.review.create({
			data: {
				rkey,
				uri: response.data.uri,
				cid: response.data.cid,
				userDid,
				mediaType: dto.mediaType,
				mediaId: dto.mediaId,
				seasonNumber: dto.seasonNumber ?? 0,
				episodeNumber: dto.episodeNumber ?? 0,
				rating: dto.rating,
				content: dto.content ?? null,
			},
		});

		return review;
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

		await this.prisma.review.delete({
			where: { id: reviewId },
		});
	}

	async likeReview(userDid: string, session: ATSession, reviewId: string) {
		const review = await this.prisma.review.findUnique({
			where: { id: reviewId },
		});

		if (!review) {
			throw new NotFoundException("Review not found");
		}

		if (review.userDid === userDid) {
			throw new Error("Cannot like your own review");
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
			throw new Error("Already liked this review");
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

	async unlikeReview(userDid: string, session: ATSession, reviewId: string) {
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

		await agent.com.atproto.repo.deleteRecord({
			repo: session.did,
			collection: REVIEW_LIKE_COLLECTION,
			rkey: like.rkey,
		});

		await this.prisma.reviewLike.delete({
			where: { id: like.id },
		});
	}

	async getReviewLikes(reviewId: string, requestingUserDid?: string) {
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

	async indexReviewRecord(
		uri: string,
		cid: string,
		rkey: string,
		userDid: string,
		record: ReviewRecord,
	): Promise<void> {
		await this.prisma.review.upsert({
			where: { rkey },
			create: {
				rkey,
				uri,
				cid,
				userDid,
				mediaType: record.mediaType,
				mediaId: record.mediaId,
				seasonNumber: record.seasonNumber ?? 0,
				episodeNumber: record.episodeNumber ?? 0,
				rating: record.rating,
				content: record.content ?? null,
			},
			update: {
				cid,
				mediaType: record.mediaType,
				mediaId: record.mediaId,
				seasonNumber: record.seasonNumber ?? 0,
				episodeNumber: record.episodeNumber ?? 0,
				rating: record.rating,
				content: record.content ?? null,
			},
		});
	}

	async deleteReviewRecord(rkey: string): Promise<void> {
		await this.prisma.review.deleteMany({
			where: { rkey },
		});
	}

	async indexReviewLikeRecord(
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
			where: { rkey },
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

	async deleteReviewLikeRecord(rkey: string): Promise<void> {
		await this.prisma.reviewLike.deleteMany({
			where: { rkey },
		});
	}
}
