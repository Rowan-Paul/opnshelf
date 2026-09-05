import { rebaseAvatarUrl } from "../users/avatar-url";
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { safeFetch } from "../common/safe-fetch";
import type {
	FollowedWatcherActorDto,
	PaginatedSocialUsersDto,
	SocialActorDto,
	SocialUserCardDto,
} from "./dto/social.dto";
import {
	clampPage,
	clampPageSize,
	DEFAULT_SOCIAL_PAGE_SIZE,
	MAX_SOCIAL_PAGE_SIZE,
	paginateItems,
} from "./social-pagination";

const SEARCH_CANDIDATE_LIMIT = 500;
const BLUESKY_FOLLOWS_MAX_PAGES = 100;

export type SocialUserRecord = {
	did: string;
	handle: string;
	displayName: string | null;
	avatar: string | null;
	_count: {
		followers: number;
		following: number;
	};
};

/**
 * User lookups shared by the social surfaces: the card/actor projections of a
 * User, existence checks, people search and follow suggestions.
 */
@Injectable()
export class SocialUsersService {
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

		const blueskyMatchDids = await this.fetchBlueskyOpnshelfMatches(
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
			take: SEARCH_CANDIDATE_LIMIT,
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

	async assertTargetUserExists(targetDid: string) {
		const user = await this.prisma.user.findUnique({
			where: { did: targetDid },
			select: { did: true },
		});

		if (!user) {
			throw new NotFoundException("User not found");
		}
	}

	async findUserByHandle(handle: string) {
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

	async buildSocialUserCards(
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
							avatar: rebaseAvatarUrl(user.avatar),
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

	async buildSocialActorMap(
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
					avatar: rebaseAvatarUrl(user.avatar),
					followersCount: user._count.followers,
					followingCount: user._count.following,
				} satisfies SocialActorDto,
			]),
		);
	}

	async buildFollowedWatcherActorMap(
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
					avatar: rebaseAvatarUrl(user.avatar),
				} satisfies FollowedWatcherActorDto,
			]),
		);
	}

	private async fetchBlueskyOpnshelfMatches(
		did: string,
		excludeDids: Set<string>,
		limit: number,
	): Promise<string[]> {
		const matchedDids: string[] = [];
		let cursor: string | undefined;
		let pageCount = 0;
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 30_000);

		try {
			do {
				pageCount += 1;
				let pageDids: string[];
				let nextCursor: string | undefined;

				try {
					const params = new URLSearchParams({
						actor: did,
						limit: "100",
						...(cursor ? { cursor } : {}),
					});
					const response = await safeFetch(
						`https://public.api.bsky.app/xrpc/app.bsky.graph.getFollows?${params}`,
						{
							headers: { Accept: "application/json" },
							signal: controller.signal,
						},
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
			} while (
				cursor !== undefined &&
				matchedDids.length < limit &&
				pageCount < BLUESKY_FOLLOWS_MAX_PAGES
			);
		} finally {
			clearTimeout(timeout);
		}

		return matchedDids;
	}
}

export const socialUserSelect = {
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

export function normalizeHandle(handle: string) {
	return handle.trim().replace(/^@/, "").toLowerCase();
}

export function normalizeSearchQuery(query: string) {
	return query.trim().replace(/^@/, "").toLowerCase();
}

export function compareSocialSearch(
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

export function getSearchRank(user: SocialUserRecord, query: string) {
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
