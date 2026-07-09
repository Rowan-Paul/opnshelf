import { Agent } from "@atproto/api";
import { TID } from "@atproto/common";
import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import {
	$nsid as FOLLOW_COLLECTION,
	main as followSchema,
} from "../lexicons/xyz/opnshelf/follow";
import type { Main as FollowRecord } from "../lexicons/xyz/opnshelf/follow.defs";
import { Prisma } from "../generated/client";
import { PrismaService } from "../prisma/prisma.service";
import type {
	CircleDto,
	FollowedActivityFeedDto,
	FollowedActivityItemDto,
	FollowedWatcherActorDto,
	FollowedWatcherDto,
	FollowedWatchersDto,
	PaginatedSocialUsersDto,
	SocialActorDto,
	SocialUserCardDto,
	UserRelationshipDto,
} from "./dto/social.dto";

type SocialUserRecord = {
	did: string;
	handle: string;
	displayName: string | null;
	avatar: string | null;
	_count: {
		followers: number;
		following: number;
	};
};

type FollowedActivityRow = {
	actorDid: string;
	id: string;
	type: "movie" | "episode" | "review";
	activityAt: Date;
	watchedDate: Date | null;
	createdAt: Date;
	movieId: string | null;
	title: string | null;
	showId: string | null;
	showTitle: string | null;
	seasonNumber: number | null;
	episodeNumber: number | null;
	episodeName: string | null;
	episodeOverview: string | null;
	stillPath: string | null;
	posterPath: string | null;
	backdropPath: string | null;
	releaseYear: number | null;
	firstAirYear: number | null;
	overview: string | null;
	rating: number | null;
	reviewContent: string | null;
};

type FollowedWatcherRow = {
	actorDid: string;
	activityAt: Date;
	createdAt: Date;
};

type PaginatedResult<T> = {
	items: T[];
	page: number;
	pageSize: number;
	total: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPreviousPage: boolean;
};

export interface ATSession {
	did: string;
}

const DEFAULT_SOCIAL_PAGE_SIZE = 20;
const MAX_SOCIAL_PAGE_SIZE = 50;
const DEFAULT_FEED_PAGE_SIZE = 10;
const MAX_FEED_PAGE_SIZE = 25;
const DEFAULT_WATCHERS_PAGE_SIZE = 3;
const MAX_WATCHERS_PAGE_SIZE = 10;

@Injectable()
export class SocialService {
	private readonly logger = new Logger(SocialService.name);

	constructor(private readonly prisma: PrismaService) {}

	async getSuggestions(
		viewerDid: string,
		limit = 10,
	): Promise<PaginatedSocialUsersDto> {
		const safeLimit = Math.min(Math.max(limit, 1), 20);

		const alreadyFollowing = await this.prisma.follow.findMany({
			where: { followerDid: viewerDid },
			select: { followingDid: true },
		});
		const excludeDids = new Set([
			viewerDid,
			...alreadyFollowing.map((f) => f.followingDid),
		]);

		const blueskyMatchDids = await this.fetchBlueskyOpnShelfMatches(
			viewerDid,
			excludeDids,
			safeLimit,
		);
		const blueskyMatches =
			blueskyMatchDids.length > 0
				? await this.prisma.user.findMany({
						where: { did: { in: blueskyMatchDids } },
						select: socialUserSelect,
						take: safeLimit,
					})
				: [];

		if (blueskyMatches.length > 0) {
			const cards = await this.buildSocialUserCards(
				blueskyMatches.map((u) => u.did),
				viewerDid,
				new Map(blueskyMatches.map((u) => [u.did, u])),
			);
			const items = blueskyMatches
				.map((u) => cards.get(u.did))
				.filter((u): u is SocialUserCardDto => Boolean(u));
			return {
				items,
				total: items.length,
				page: 1,
				pageSize: safeLimit,
				totalPages: 1,
				hasNextPage: false,
				hasPreviousPage: false,
			};
		}

		const activeUsers = await this.prisma.user.findMany({
			where: { did: { notIn: [...excludeDids] } },
			select: socialUserSelect,
			orderBy: { trackedMovies: { _count: "desc" } },
			take: safeLimit,
		});

		const cards = await this.buildSocialUserCards(
			activeUsers.map((u) => u.did),
			viewerDid,
			new Map(activeUsers.map((u) => [u.did, u])),
		);
		const items = activeUsers
			.map((u) => cards.get(u.did))
			.filter((u): u is SocialUserCardDto => Boolean(u));
		return {
			items,
			total: items.length,
			page: 1,
			pageSize: safeLimit,
			totalPages: items.length > 0 ? 1 : 0,
			hasNextPage: false,
			hasPreviousPage: false,
		};
	}

	async searchPeople(
		viewerDid: string,
		query: string,
		page = 1,
		pageSize = DEFAULT_SOCIAL_PAGE_SIZE,
	): Promise<PaginatedSocialUsersDto> {
		const trimmedQuery = normalizeSearchQuery(query);
		if (trimmedQuery.length < 2) {
			throw new BadRequestException("Query must be at least 2 characters");
		}

		const safePageSize = clampPageSize(pageSize, MAX_SOCIAL_PAGE_SIZE);
		const safePage = clampPage(page);

		const matches = await this.prisma.user.findMany({
			where: {
				did: { not: viewerDid },
				OR: [
					{ handle: { contains: trimmedQuery, mode: "insensitive" } },
					{ displayName: { contains: trimmedQuery, mode: "insensitive" } },
				],
			},
			select: socialUserSelect,
		});

		const sortedMatches = [...matches].sort((left, right) =>
			compareSocialSearch(left, right, trimmedQuery),
		);

		const paginated = paginateItems(sortedMatches, safePage, safePageSize);
		const cards = await this.buildSocialUserCards(
			paginated.items.map((user) => user.did),
			viewerDid,
			new Map(paginated.items.map((user) => [user.did, user])),
		);

		return {
			...paginated,
			items: paginated.items
				.map((user) => cards.get(user.did))
				.filter((item): item is SocialUserCardDto => Boolean(item)),
		};
	}

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
		await this.assertTargetUserExists(targetDid);

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
		await this.assertTargetUserExists(targetDid);

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
		const targetUser = await this.findUserByHandle(handle);
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

		const cards = await this.buildSocialUserCards(
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
		const targetUser = await this.findUserByHandle(handle);
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

		const cards = await this.buildSocialUserCards(
			follows.map((follow) => follow.followingDid),
			viewerDid,
		);

		// Circles are the viewer's private grouping of their own follows, so only
		// attach membership when the viewer is looking at their own following list.
		if (viewerDid && viewerDid === targetUser.did) {
			await this.attachCircleMembership(
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

	private async attachCircleMembership(
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

	async getFollowedActivityFeed(
		viewerDid: string,
		page = 1,
		pageSize = DEFAULT_FEED_PAGE_SIZE,
		circleId?: string,
	): Promise<FollowedActivityFeedDto> {
		const safePageSize = clampPageSize(pageSize, MAX_FEED_PAGE_SIZE);
		const safePage = clampPage(page);

		const followedDids = circleId
			? await this.getCircleMemberDids(viewerDid, circleId)
			: (
					await this.prisma.follow.findMany({
						where: { followerDid: viewerDid },
						select: { followingDid: true },
					})
				).map((follow) => follow.followingDid);

		if (followedDids.length === 0) {
			return emptyPaginatedResult(safePage, safePageSize);
		}

		const [movieCount, episodeCount, reviewCount] = await Promise.all([
			this.prisma.trackedMovie.count({
				where: { userDid: { in: followedDids } },
			}),
			this.prisma.trackedEpisode.count({
				where: { userDid: { in: followedDids } },
			}),
			this.prisma.review.count({
				where: { userDid: { in: followedDids } },
			}),
		]);
		const total = movieCount + episodeCount + reviewCount;
		const pagination = getPaginationMeta(total, safePage, safePageSize);

		if (total === 0) {
			return {
				...pagination,
				items: [],
			};
		}

		const followedDidValues = Prisma.join(
			followedDids.map((did) => Prisma.sql`${did}`),
		);
		const rows = await this.prisma.$queryRaw<FollowedActivityRow[]>(Prisma.sql`
			SELECT
				activity."actorDid",
				activity.id,
				activity.type,
				activity."activityAt",
				activity."watchedDate",
				activity."createdAt",
				activity."movieId",
				activity.title,
				activity."showId",
				activity."showTitle",
				activity."seasonNumber",
				activity."episodeNumber",
				activity."episodeName",
				activity."episodeOverview",
				activity."stillPath",
				activity."posterPath",
				activity."backdropPath",
				activity."releaseYear",
				activity."firstAirYear",
				activity.overview,
				activity.rating,
				activity."reviewContent"
			FROM (
				SELECT
					tm."userDid" AS "actorDid",
					'movie:' || tm.id AS id,
					'movie' AS type,
					COALESCE(tm."watchedDate", tm."createdAt") AS "activityAt",
					tm."watchedDate",
					tm."createdAt",
					tm."movieId",
					m.title,
					NULL::text AS "showId",
					NULL::text AS "showTitle",
					NULL::integer AS "seasonNumber",
					NULL::integer AS "episodeNumber",
					NULL::text AS "episodeName",
					NULL::text AS "episodeOverview",
					NULL::text AS "stillPath",
					m."posterPath",
					m."backdropPath",
					m."releaseYear",
					NULL::integer AS "firstAirYear",
					m.overview,
					NULL::integer AS rating,
					NULL::text AS "reviewContent"
				FROM "TrackedMovie" tm
				INNER JOIN "Movie" m ON m."movieId" = tm."movieId"
				WHERE tm."userDid" IN (${followedDidValues})

				UNION ALL

				SELECT
					te."userDid" AS "actorDid",
					'episode:' || te.id AS id,
					'episode' AS type,
					COALESCE(te."watchedDate", te."createdAt") AS "activityAt",
					te."watchedDate",
					te."createdAt",
					NULL::text AS "movieId",
					NULL::text AS title,
					te."showId",
					s.title AS "showTitle",
					te."seasonNumber",
					te."episodeNumber",
					e.name AS "episodeName",
					e.overview AS "episodeOverview",
					e."stillPath",
					s."posterPath",
					s."backdropPath",
					NULL::integer AS "releaseYear",
					s."firstAirYear",
					s.overview,
					NULL::integer AS rating,
					NULL::text AS "reviewContent"
				FROM "TrackedEpisode" te
				INNER JOIN "Show" s ON s."showId" = te."showId"
				LEFT JOIN "Episode" e ON e."showId" = te."showId"
					AND e."seasonNumber" = te."seasonNumber"
					AND e."episodeNumber" = te."episodeNumber"
				WHERE te."userDid" IN (${followedDidValues})

				UNION ALL

				SELECT
					r."userDid" AS "actorDid",
					'review:' || r.id AS id,
					'review' AS type,
					r."createdAt" AS "activityAt",
					NULL::timestamp AS "watchedDate",
					r."createdAt",
					CASE WHEN r."mediaType" = 'movie' THEN r."mediaId" ELSE NULL::text END AS "movieId",
					COALESCE(m.title, s.title) AS title,
					CASE WHEN r."mediaType" != 'movie' THEN r."mediaId" ELSE NULL::text END AS "showId",
					s.title AS "showTitle",
					CASE WHEN r."mediaType" IN ('season', 'episode') THEN r."seasonNumber" ELSE NULL::integer END AS "seasonNumber",
					CASE WHEN r."mediaType" = 'episode' THEN r."episodeNumber" ELSE NULL::integer END AS "episodeNumber",
					NULL::text AS "episodeName",
					NULL::text AS "episodeOverview",
					NULL::text AS "stillPath",
					COALESCE(m."posterPath", s."posterPath") AS "posterPath",
					COALESCE(m."backdropPath", s."backdropPath") AS "backdropPath",
					m."releaseYear",
					s."firstAirYear",
					COALESCE(m.overview, s.overview) AS overview,
					rt.rating,
					r.markdown AS "reviewContent"
				FROM "Review" r
				LEFT JOIN "Movie" m ON m."movieId" = r."mediaId" AND r."mediaType" = 'movie'
				LEFT JOIN "Show" s ON s."showId" = r."mediaId" AND r."mediaType" != 'movie'
				LEFT JOIN "Rating" rt ON rt."userDid" = r."userDid"
					AND rt."mediaType" = r."mediaType"
					AND rt."mediaId" = r."mediaId"
					AND rt."seasonNumber" = r."seasonNumber"
					AND rt."episodeNumber" = r."episodeNumber"
				WHERE r."userDid" IN (${followedDidValues})
			) activity
			ORDER BY
				activity."activityAt" DESC,
				activity."createdAt" DESC,
				activity.type DESC,
				activity.id DESC
			OFFSET ${(pagination.page - 1) * safePageSize}
			LIMIT ${safePageSize}
		`);

		const actorMap = await this.buildSocialActorMap(
			rows.map((row) => row.actorDid),
		);
		const colorMap = await this.loadActivityColorMap(rows);
		const items = rows.map((row) =>
			this.toFollowedActivityItem(
				row,
				actorMap.get(row.actorDid) ?? null,
				colorMap,
			),
		);

		return {
			...pagination,
			items,
		};
	}

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
		const cards = await this.buildSocialUserCards(dids, viewerDid);
		await this.attachCircleMembership(viewerDid, dids, cards);

		return {
			...pagination,
			items: dids
				.map((did) => cards.get(did))
				.filter((item): item is SocialUserCardDto => Boolean(item)),
		};
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

	private async getCircleMemberDids(
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

	async getFollowedWatchers(
		viewerDid: string,
		mediaType: "movie" | "show",
		mediaId: string,
		pageSize = DEFAULT_WATCHERS_PAGE_SIZE,
	): Promise<FollowedWatchersDto> {
		const safePageSize = clampPageSize(pageSize, MAX_WATCHERS_PAGE_SIZE);
		const followedDids = await this.getFollowedDids(viewerDid);

		if (followedDids.length === 0) {
			return {
				items: [],
				pageSize: safePageSize,
				total: 0,
			};
		}

		const rows =
			mediaType === "movie"
				? await this.loadMovieWatcherRows(followedDids, mediaId)
				: await this.loadShowWatcherRows(
						followedDids,
						parseScopedShowMediaId(mediaId),
					);

		if (rows.length === 0) {
			return {
				items: [],
				pageSize: safePageSize,
				total: 0,
			};
		}

		const limitedRows = rows.slice(0, safePageSize);
		const actorMap = await this.buildFollowedWatcherActorMap(
			limitedRows.map((row) => row.actorDid),
		);

		return {
			items: limitedRows.map((row) =>
				this.toFollowedWatcherItem(row, actorMap.get(row.actorDid) ?? null),
			),
			pageSize: safePageSize,
			total: rows.length,
		};
	}

	async indexFollowRecord(
		followerDid: string,
		rkey: string,
		cid: string | undefined,
		record: FollowRecord,
		uri?: string,
	) {
		await this.assertTargetUserExists(record.subjectDid);

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

		await this.assertTargetUserExists(targetDid);
	}

	private async assertTargetUserExists(targetDid: string) {
		const user = await this.prisma.user.findUnique({
			where: { did: targetDid },
			select: { did: true },
		});

		if (!user) {
			throw new NotFoundException("User not found");
		}
	}

	private async findUserByHandle(handle: string) {
		const normalizedHandle = normalizeHandle(handle);
		const user = await this.prisma.user.findUnique({
			where: { handle: normalizedHandle },
			select: { did: true, handle: true },
		});

		if (!user) {
			throw new NotFoundException("User not found");
		}

		return user;
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
			this.logger.debug(
				`Failed to delete follow record ${rkey} from PDS`,
				error,
			);
		}
	}

	private async buildSocialUserCards(
		userDids: string[],
		viewerDid: string | null,
		baseUsers?: Map<string, SocialUserRecord>,
	): Promise<Map<string, SocialUserCardDto>> {
		const uniqueUserDids = [...new Set(userDids)];
		if (uniqueUserDids.length === 0) {
			return new Map();
		}

		const usersMap =
			baseUsers ??
			new Map(
				(
					await this.prisma.user.findMany({
						where: { did: { in: uniqueUserDids } },
						select: socialUserSelect,
					})
				).map((user) => [user.did, user]),
			);

		let followingSet = new Set<string>();
		let followerSet = new Set<string>();

		if (viewerDid) {
			const [viewerFollowing, viewerFollowers] = await Promise.all([
				this.prisma.follow.findMany({
					where: {
						followerDid: viewerDid,
						followingDid: { in: uniqueUserDids },
					},
					select: { followingDid: true },
				}),
				this.prisma.follow.findMany({
					where: {
						followingDid: viewerDid,
						followerDid: { in: uniqueUserDids },
					},
					select: { followerDid: true },
				}),
			]);

			followingSet = new Set(
				viewerFollowing.map((follow) => follow.followingDid),
			);
			followerSet = new Set(
				viewerFollowers.map((follow) => follow.followerDid),
			);
		}

		return new Map(
			uniqueUserDids
				.map((did) => {
					const user = usersMap.get(did);
					if (!user) {
						return null;
					}

					return [
						did,
						{
							did: user.did,
							handle: user.handle,
							displayName: user.displayName,
							avatar: user.avatar,
							followersCount: user._count.followers,
							followingCount: user._count.following,
							isFollowing: followingSet.has(did),
							isFollowedBy: followerSet.has(did),
						} satisfies SocialUserCardDto,
					] as const;
				})
				.filter((entry): entry is readonly [string, SocialUserCardDto] =>
					Boolean(entry),
				),
		);
	}

	private async buildSocialActorMap(
		userDids: string[],
	): Promise<Map<string, SocialActorDto>> {
		const uniqueUserDids = [...new Set(userDids)];
		if (uniqueUserDids.length === 0) {
			return new Map();
		}

		const users = await this.prisma.user.findMany({
			where: { did: { in: uniqueUserDids } },
			select: socialUserSelect,
		});

		return new Map(
			users.map((user) => [
				user.did,
				{
					did: user.did,
					handle: user.handle,
					displayName: user.displayName,
					avatar: user.avatar,
					followersCount: user._count.followers,
					followingCount: user._count.following,
				} satisfies SocialActorDto,
			]),
		);
	}

	private async buildFollowedWatcherActorMap(
		userDids: string[],
	): Promise<Map<string, FollowedWatcherActorDto>> {
		const uniqueUserDids = [...new Set(userDids)];
		if (uniqueUserDids.length === 0) {
			return new Map();
		}

		const users = await this.prisma.user.findMany({
			where: { did: { in: uniqueUserDids } },
			select: watcherUserSelect,
		});

		return new Map(
			users.map((user) => [
				user.did,
				{
					did: user.did,
					handle: user.handle,
					displayName: user.displayName,
					avatar: user.avatar,
				} satisfies FollowedWatcherActorDto,
			]),
		);
	}

	private async getFollowedDids(viewerDid: string) {
		const followedUsers = await this.prisma.follow.findMany({
			where: { followerDid: viewerDid },
			select: { followingDid: true },
		});

		return followedUsers.map((follow) => follow.followingDid);
	}

	private async loadMovieWatcherRows(
		followedDids: string[],
		movieId: string,
	): Promise<FollowedWatcherRow[]> {
		const followedDidValues = Prisma.join(
			followedDids.map((did) => Prisma.sql`${did}`),
		);

		return this.prisma.$queryRaw<FollowedWatcherRow[]>(Prisma.sql`
			SELECT
				watchers."actorDid",
				watchers."activityAt",
				watchers."createdAt"
			FROM (
				SELECT DISTINCT ON (tm."userDid")
					tm."userDid" AS "actorDid",
					COALESCE(tm."watchedDate", tm."createdAt") AS "activityAt",
					tm."createdAt"
				FROM "TrackedMovie" tm
				WHERE tm."userDid" IN (${followedDidValues})
					AND tm."movieId" = ${movieId}
				ORDER BY
					tm."userDid",
					COALESCE(tm."watchedDate", tm."createdAt") DESC,
					tm."createdAt" DESC,
					tm.id DESC
			) watchers
			ORDER BY
				watchers."activityAt" DESC,
				watchers."createdAt" DESC,
				watchers."actorDid" ASC
		`);
	}

	private async loadShowWatcherRows(
		followedDids: string[],
		scope: {
			showId: string;
			seasonNumber?: number;
			episodeNumber?: number;
		},
	): Promise<FollowedWatcherRow[]> {
		const followedDidValues = Prisma.join(
			followedDids.map((did) => Prisma.sql`${did}`),
		);
		const seasonCondition =
			typeof scope.seasonNumber === "number"
				? Prisma.sql` AND te."seasonNumber" = ${scope.seasonNumber}`
				: Prisma.empty;
		const episodeCondition =
			typeof scope.episodeNumber === "number"
				? Prisma.sql` AND te."episodeNumber" = ${scope.episodeNumber}`
				: Prisma.empty;

		return this.prisma.$queryRaw<FollowedWatcherRow[]>(Prisma.sql`
			SELECT
				watchers."actorDid",
				watchers."activityAt",
				watchers."createdAt"
			FROM (
				SELECT DISTINCT ON (te."userDid")
					te."userDid" AS "actorDid",
					COALESCE(te."watchedDate", te."createdAt") AS "activityAt",
					te."createdAt"
				FROM "TrackedEpisode" te
				WHERE te."userDid" IN (${followedDidValues})
					AND te."showId" = ${scope.showId}
					${seasonCondition}
					${episodeCondition}
				ORDER BY
					te."userDid",
					COALESCE(te."watchedDate", te."createdAt") DESC,
					te."createdAt" DESC,
					te.id DESC
			) watchers
			ORDER BY
				watchers."activityAt" DESC,
				watchers."createdAt" DESC,
				watchers."actorDid" ASC
		`);
	}

	private async loadActivityColorMap(rows: FollowedActivityRow[]) {
		const movieIds = [
			...new Set(
				rows
					.filter((row) => row.type === "movie" && row.movieId)
					.map((row) => row.movieId as string),
			),
		];
		const showIds = [
			...new Set(
				rows
					.filter((row) => row.type === "episode" && row.showId)
					.map((row) => row.showId as string),
			),
		];

		const [movies, shows] = await Promise.all([
			movieIds.length > 0
				? this.prisma.movie.findMany({
						where: { movieId: { in: movieIds } },
						select: { movieId: true, colors: true },
					})
				: Promise.resolve([]),
			showIds.length > 0
				? this.prisma.show.findMany({
						where: { showId: { in: showIds } },
						select: { showId: true, colors: true },
					})
				: Promise.resolve([]),
		]);

		return {
			movies: new Map<string, unknown>(
				movies.map((movie): [string, unknown] => [movie.movieId, movie.colors]),
			),
			shows: new Map<string, unknown>(
				shows.map((show): [string, unknown] => [show.showId, show.colors]),
			),
		};
	}

	private toFollowedActivityItem(
		row: FollowedActivityRow,
		actor: SocialActorDto | null,
		colorMap: {
			movies: Map<string, unknown>;
			shows: Map<string, unknown>;
		},
	): FollowedActivityItemDto {
		return {
			actor:
				actor ??
				({
					did: row.actorDid,
					handle: row.actorDid,
					displayName: null,
					avatar: null,
					followersCount: 0,
					followingCount: 0,
				} satisfies SocialActorDto),
			id: row.id,
			type: row.type,
			activityAt: row.activityAt.toISOString(),
			movieId: row.movieId ?? undefined,
			title: row.title ?? undefined,
			showId: row.showId ?? undefined,
			showTitle: row.showTitle ?? undefined,
			seasonNumber: row.seasonNumber ?? undefined,
			episodeNumber: row.episodeNumber ?? undefined,
			episodeName: row.episodeName ?? undefined,
			episodeOverview: row.episodeOverview ?? undefined,
			stillPath: row.stillPath ?? undefined,
			posterPath: row.posterPath ?? undefined,
			backdropPath: row.backdropPath ?? undefined,
			releaseYear: row.releaseYear ?? undefined,
			firstAirYear: row.firstAirYear ?? undefined,
			overview: row.overview ?? undefined,
			colors:
				row.type === "movie"
					? ((row.movieId ? colorMap.movies.get(row.movieId) : undefined) as
							| FollowedActivityItemDto["colors"]
							| undefined)
					: ((row.showId ? colorMap.shows.get(row.showId) : undefined) as
							| FollowedActivityItemDto["colors"]
							| undefined),
			watchedDate: row.watchedDate?.toISOString(),
			rating: row.rating ?? undefined,
			reviewContent: row.reviewContent ?? undefined,
			createdAt: row.createdAt.toISOString(),
		};
	}

	private toFollowedWatcherItem(
		row: FollowedWatcherRow,
		actor: FollowedWatcherActorDto | null,
	): FollowedWatcherDto {
		return {
			actor:
				actor ??
				({
					did: row.actorDid,
					handle: row.actorDid,
					displayName: null,
					avatar: null,
				} satisfies FollowedWatcherActorDto),
			activityAt: row.activityAt.toISOString(),
		};
	}

	private async fetchBlueskyOpnShelfMatches(
		did: string,
		excludeDids: Set<string>,
		limit: number,
	): Promise<string[]> {
		const matchedDids: string[] = [];
		let cursor: string | undefined;

		do {
			let pageDids: string[];
			let nextCursor: string | undefined;

			try {
				const params = new URLSearchParams({
					actor: did,
					limit: "100",
					...(cursor ? { cursor } : {}),
				});
				const response = await fetch(
					`https://public.api.bsky.app/xrpc/app.bsky.graph.getFollows?${params}`,
					{ headers: { Accept: "application/json" } },
				);
				if (!response.ok) break;
				const data = (await response.json()) as {
					follows?: { did?: string }[];
					cursor?: string;
				};
				pageDids = (data.follows ?? [])
					.map((f) => f.did)
					.filter((d): d is string => typeof d === "string" && d.length > 0);
				nextCursor = data.cursor;
			} catch {
				break;
			}

			const candidates = pageDids.filter((d) => !excludeDids.has(d));
			if (candidates.length > 0) {
				const found = await this.prisma.user.findMany({
					where: { did: { in: candidates } },
					select: { did: true },
				});
				matchedDids.push(...found.map((u) => u.did));
			}

			cursor = nextCursor;
		} while (cursor !== undefined && matchedDids.length < limit);

		return matchedDids;
	}
}

const socialUserSelect = {
	did: true,
	handle: true,
	displayName: true,
	avatar: true,
	_count: {
		select: {
			followers: true,
			following: true,
		},
	},
} as const;

const watcherUserSelect = {
	did: true,
	handle: true,
	displayName: true,
	avatar: true,
} as const;

function isUniqueConstraintError(error: unknown): boolean {
	return (
		error instanceof Prisma.PrismaClientKnownRequestError &&
		error.code === "P2002"
	);
}

function normalizeHandle(handle: string) {
	return handle.trim().replace(/^@/, "").toLowerCase();
}

function normalizeSearchQuery(query: string) {
	return query.trim().replace(/^@/, "").toLowerCase();
}

function parseScopedShowMediaId(mediaId: string): {
	showId: string;
	seasonNumber?: number;
	episodeNumber?: number;
} {
	const episodeMatch = mediaId.match(/^([^:]+):season:(\d+):episode:(\d+)$/);
	if (episodeMatch) {
		return {
			showId: episodeMatch[1],
			seasonNumber: Number(episodeMatch[2]),
			episodeNumber: Number(episodeMatch[3]),
		};
	}

	const seasonMatch = mediaId.match(/^([^:]+):season:(\d+)$/);
	if (seasonMatch) {
		return {
			showId: seasonMatch[1],
			seasonNumber: Number(seasonMatch[2]),
		};
	}

	return { showId: mediaId };
}

function compareSocialSearch(
	left: SocialUserRecord,
	right: SocialUserRecord,
	query: string,
) {
	const rankDifference =
		getSearchRank(left, query) - getSearchRank(right, query);
	if (rankDifference !== 0) {
		return rankDifference;
	}

	const followersDifference = right._count.followers - left._count.followers;
	if (followersDifference !== 0) {
		return followersDifference;
	}

	return left.handle.localeCompare(right.handle);
}

function getSearchRank(user: SocialUserRecord, query: string) {
	const handle = user.handle.toLowerCase();
	const displayName = user.displayName?.toLowerCase() ?? "";

	if (handle === query) {
		return 0;
	}

	if (handle.startsWith(query)) {
		return 1;
	}

	if (displayName.startsWith(query)) {
		return 2;
	}

	if (handle.includes(query)) {
		return 3;
	}

	if (displayName.includes(query)) {
		return 4;
	}

	return 5;
}

function clampPage(page: number) {
	return Math.max(page, 1);
}

function clampPageSize(pageSize: number, maxPageSize: number) {
	return Math.min(Math.max(pageSize, 1), maxPageSize);
}

function paginateItems<T>(
	items: T[],
	page: number,
	pageSize: number,
): PaginatedResult<T> {
	const pagination = getPaginationMeta(items.length, page, pageSize);
	const start = (pagination.page - 1) * pageSize;

	return {
		...pagination,
		items: items.slice(start, start + pageSize),
	};
}

function getPaginationMeta(
	total: number,
	page: number,
	pageSize: number,
): Omit<PaginatedResult<never>, "items"> {
	const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;
	const currentPage = totalPages > 0 ? Math.min(page, totalPages) : 1;

	return {
		page: currentPage,
		pageSize,
		total,
		totalPages,
		hasNextPage: totalPages > 0 && currentPage < totalPages,
		hasPreviousPage: totalPages > 0 && currentPage > 1,
	};
}

function emptyPaginatedResult(
	page: number,
	pageSize: number,
): FollowedActivityFeedDto {
	return {
		items: [],
		page,
		pageSize,
		total: 0,
		totalPages: 0,
		hasNextPage: false,
		hasPreviousPage: false,
	};
}
