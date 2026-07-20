import { Agent } from "@atproto/api";
import { TID } from "@atproto/common";
import { Injectable, NotFoundException } from "@nestjs/common";
import {
	$nsid as RATING_COLLECTION,
	main as ratingSchema,
} from "../lexicons/xyz/opnshelf/rating";
import type { Main as RatingRecord } from "../lexicons/xyz/opnshelf/rating.defs";
import { PrismaService } from "../prisma/prisma.service";
import type {
	BatchRatingRequestDto,
	MediaRatingQueryDto,
	SetRatingDto,
} from "./dto/rating.dto";

export interface ATSession {
	did: string;
}

@Injectable()
export class RatingsService {
	constructor(private prisma: PrismaService) {}

	async getRating(
		userDid: string,
		mediaType: "movie" | "show" | "season" | "episode",
		mediaId: string,
		seasonNumber?: number,
		episodeNumber?: number,
	) {
		return this.prisma.rating.findUnique({
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

	async getMediaRating(query: MediaRatingQueryDto) {
		const { mediaType, mediaId, seasonNumber, episodeNumber } = query;

		const where = {
			mediaType,
			mediaId,
			seasonNumber: seasonNumber ?? 0,
			episodeNumber: episodeNumber ?? 0,
		};

		const [aggregate, count] = await Promise.all([
			this.prisma.rating.aggregate({
				where,
				_avg: { rating: true },
			}),
			this.prisma.rating.count({ where }),
		]);

		return {
			averageRating: aggregate._avg.rating ?? undefined,
			ratingCount: count,
		};
	}

	async getBatchRatings(dto: BatchRatingRequestDto) {
		const { mediaType, mediaIds } = dto;
		const uniqueMediaIds = [...new Set(mediaIds)];
		if (uniqueMediaIds.length === 0) {
			return { items: [] };
		}

		// Scope to top-level ratings (season/episode 0), matching getMediaRating.
		const groupedRatings = await this.prisma.rating.groupBy({
			by: ["mediaId"],
			where: {
				mediaType,
				mediaId: { in: uniqueMediaIds },
				seasonNumber: 0,
				episodeNumber: 0,
			},
			_avg: { rating: true },
			_count: { _all: true },
		});
		const ratingsByMediaId = new Map(
			groupedRatings.map((rating) => [rating.mediaId, rating]),
		);

		return {
			items: uniqueMediaIds.map((mediaId) => {
				const groupedRating = ratingsByMediaId.get(mediaId);
				return {
					mediaId,
					averageRating: groupedRating?._avg.rating ?? undefined,
					ratingCount: groupedRating?._count._all ?? 0,
				};
			}),
		};
	}

	async setRating(userDid: string, session: ATSession, dto: SetRatingDto) {
		const existing = await this.prisma.rating.findUnique({
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
			// Update existing rating in PDS
			const record: RatingRecord = ratingSchema.build({
				mediaType: dto.mediaType,
				mediaId: dto.mediaId,
				seasonNumber: dto.seasonNumber,
				episodeNumber: dto.episodeNumber,
				rating: dto.rating,
				createdAt: existing.createdAt.toISOString(),
			});

			const response = await agent.com.atproto.repo.putRecord({
				repo: session.did,
				collection: RATING_COLLECTION,
				rkey: existing.rkey,
				record,
				validate: false,
			});

			const updated = await this.prisma.rating.update({
				where: { id: existing.id },
				data: {
					cid: response.data.cid,
					rating: dto.rating,
				},
			});

			return updated;
		}

		// Create new rating
		const rkey = TID.nextStr();
		const now = new Date().toISOString();

		const record: RatingRecord = ratingSchema.build({
			mediaType: dto.mediaType,
			mediaId: dto.mediaId,
			seasonNumber: dto.seasonNumber,
			episodeNumber: dto.episodeNumber,
			rating: dto.rating,
			createdAt: now,
		});

		const response = await agent.com.atproto.repo.putRecord({
			repo: session.did,
			collection: RATING_COLLECTION,
			rkey,
			record,
			validate: false,
		});

		const rating = await this.prisma.rating.create({
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
			},
		});

		return rating;
	}

	async clearRating(
		userDid: string,
		session: ATSession,
		ratingId: string,
	): Promise<void> {
		const rating = await this.prisma.rating.findFirst({
			where: { id: ratingId, userDid },
		});

		if (!rating) {
			throw new NotFoundException("Rating not found");
		}

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		await agent.com.atproto.repo.deleteRecord({
			repo: session.did,
			collection: RATING_COLLECTION,
			rkey: rating.rkey,
		});

		await this.prisma.rating.delete({
			where: { id: ratingId },
		});
	}

	async indexRatingRecord(
		uri: string,
		cid: string,
		rkey: string,
		userDid: string,
		record: RatingRecord,
	): Promise<void> {
		await this.prisma.rating.upsert({
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
				rating: record.rating,
			},
			update: {
				cid,
				mediaType: record.mediaType,
				mediaId: record.mediaId,
				seasonNumber: record.seasonNumber ?? 0,
				episodeNumber: record.episodeNumber ?? 0,
				rating: record.rating,
			},
		});
	}

	async deleteRatingRecord(userDid: string, rkey: string): Promise<void> {
		await this.prisma.rating.deleteMany({
			where: { userDid, rkey },
		});
	}
}
