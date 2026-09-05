import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type {
	FollowedActivityFeedDto,
	FollowedWatchersDto,
} from "./dto/social.dto";
import {
	type ActivityColorMap,
	type FollowedActivityRow,
	type FollowedWatcherRow,
	parseScopedShowMediaId,
	toFollowedActivityItem,
	toFollowedWatcherItem,
} from "./activity-feed.mapping";
import {
	followedActivityFeedQuery,
	movieWatchersQuery,
	type ShowWatcherScope,
	showWatchersQuery,
} from "./activity-feed.sql";
import { CirclesService } from "./circles.service";
import {
	clampPage,
	clampPageSize,
	DEFAULT_FEED_PAGE_SIZE,
	DEFAULT_WATCHERS_PAGE_SIZE,
	emptyPaginatedResult,
	getPaginationMeta,
	MAX_FEED_PAGE_SIZE,
	MAX_WATCHERS_PAGE_SIZE,
} from "./social-pagination";
import { SocialUsersService } from "./social-users.service";

/**
 * The Activity Feed (Watches and Reviews of the people the viewer follows,
 * optionally narrowed to one Circle) and the compact "followed users who
 * watched this" summaries on media pages.
 */
@Injectable()
export class ActivityFeedService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly users: SocialUsersService,
		private readonly circles: CirclesService,
	) {}

	async getFollowedActivityFeed(
		viewerDid: string,
		page = 1,
		pageSize = DEFAULT_FEED_PAGE_SIZE,
		circleId?: string,
	): Promise<FollowedActivityFeedDto> {
		const safePageSize = clampPageSize(pageSize, MAX_FEED_PAGE_SIZE);
		const safePage = clampPage(page);

		const followedDids = circleId
			? await this.circles.getCircleMemberDids(viewerDid, circleId)
			: await this.getFollowedDids(viewerDid);

		if (followedDids.length === 0) {
			return emptyPaginatedResult(safePage, safePageSize);
		}

		const [movieCount, episodeCount, reviewCount] = await Promise.all([
			this.prisma.trackedMovie.count({
				where: {
					userDid: { in: followedDids },
					watchedDate: { not: null },
				},
			}),
			this.prisma.trackedEpisode.count({
				where: {
					userDid: { in: followedDids },
					watchedDate: { not: null },
				},
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

		const rows = await this.prisma.$queryRaw<FollowedActivityRow[]>(
			followedActivityFeedQuery(
				followedDids,
				(pagination.page - 1) * safePageSize,
				safePageSize,
			),
		);

		const actorMap = await this.users.buildSocialActorMap(
			rows.map((row) => row.actorDid),
		);
		const colorMap = await this.loadActivityColorMap(rows);
		const items = rows.map((row) =>
			toFollowedActivityItem(row, actorMap.get(row.actorDid) ?? null, colorMap),
		);

		return {
			...pagination,
			items,
		};
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
		const actorMap = await this.users.buildFollowedWatcherActorMap(
			limitedRows.map((row) => row.actorDid),
		);

		return {
			items: limitedRows.map((row) =>
				toFollowedWatcherItem(row, actorMap.get(row.actorDid) ?? null),
			),
			pageSize: safePageSize,
			total: rows.length,
		};
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
		return this.prisma.$queryRaw<FollowedWatcherRow[]>(
			movieWatchersQuery(followedDids, movieId),
		);
	}

	private async loadShowWatcherRows(
		followedDids: string[],
		scope: ShowWatcherScope,
	): Promise<FollowedWatcherRow[]> {
		return this.prisma.$queryRaw<FollowedWatcherRow[]>(
			showWatchersQuery(followedDids, scope),
		);
	}

	private async loadActivityColorMap(
		rows: FollowedActivityRow[],
	): Promise<ActivityColorMap> {
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
}
