import { Injectable } from "@nestjs/common";
import type { Main as FollowRecord } from "../lexicons/xyz/opnshelf/follow.defs";
import type {
	CircleDto,
	FollowedActivityFeedDto,
	FollowedWatchersDto,
	PaginatedSocialUsersDto,
	UserRelationshipDto,
} from "./dto/social.dto";
import { ActivityFeedService } from "./activity-feed.service";
import { CirclesService } from "./circles.service";
import { type ATSession, FollowsService } from "./follows.service";
import {
	DEFAULT_FEED_PAGE_SIZE,
	DEFAULT_SOCIAL_PAGE_SIZE,
	DEFAULT_WATCHERS_PAGE_SIZE,
} from "./social-pagination";
import { SocialUsersService } from "./social-users.service";

export type { ATSession };

/**
 * Facade over the social domain, kept so the controllers, the ingester and
 * the users module keep one entry point. Behaviour lives in the focused
 * services: `SocialUsersService` (cards, search, suggestions),
 * `FollowsService` (Follow graph and PDS writes), `CirclesService` (local-only
 * Circles) and `ActivityFeedService` (Activity Feed and followed watchers).
 */
@Injectable()
export class SocialService {
	constructor(
		private readonly users: SocialUsersService,
		private readonly follows: FollowsService,
		private readonly circles: CirclesService,
		private readonly activityFeed: ActivityFeedService,
	) {}

	getSuggestions(
		viewerDid: string,
		limit = 10,
	): Promise<PaginatedSocialUsersDto> {
		return this.users.getSuggestions(viewerDid, limit);
	}

	searchPeople(
		viewerDid: string,
		query: string,
		page = 1,
		pageSize = DEFAULT_SOCIAL_PAGE_SIZE,
	): Promise<PaginatedSocialUsersDto> {
		return this.users.searchPeople(viewerDid, query, page, pageSize);
	}

	follow(
		viewerDid: string,
		session: ATSession,
		targetDid: string,
	): Promise<UserRelationshipDto> {
		return this.follows.follow(viewerDid, session, targetDid);
	}

	unfollow(
		viewerDid: string,
		session: ATSession,
		targetDid: string,
	): Promise<void> {
		return this.follows.unfollow(viewerDid, session, targetDid);
	}

	getRelationship(
		viewerDid: string,
		targetDid: string,
	): Promise<UserRelationshipDto> {
		return this.follows.getRelationship(viewerDid, targetDid);
	}

	getFollowers(
		viewerDid: string | null,
		handle: string,
		page = 1,
		pageSize = DEFAULT_SOCIAL_PAGE_SIZE,
	): Promise<PaginatedSocialUsersDto> {
		return this.follows.getFollowers(viewerDid, handle, page, pageSize);
	}

	getFollowing(
		viewerDid: string | null,
		handle: string,
		page = 1,
		pageSize = DEFAULT_SOCIAL_PAGE_SIZE,
	): Promise<PaginatedSocialUsersDto> {
		return this.follows.getFollowing(viewerDid, handle, page, pageSize);
	}

	getFollowedActivityFeed(
		viewerDid: string,
		page = 1,
		pageSize = DEFAULT_FEED_PAGE_SIZE,
		circleId?: string,
	): Promise<FollowedActivityFeedDto> {
		return this.activityFeed.getFollowedActivityFeed(
			viewerDid,
			page,
			pageSize,
			circleId,
		);
	}

	listCircles(viewerDid: string): Promise<CircleDto[]> {
		return this.circles.listCircles(viewerDid);
	}

	createCircle(viewerDid: string, name: string): Promise<CircleDto> {
		return this.circles.createCircle(viewerDid, name);
	}

	renameCircle(
		viewerDid: string,
		circleId: string,
		name: string,
	): Promise<CircleDto> {
		return this.circles.renameCircle(viewerDid, circleId, name);
	}

	deleteCircle(viewerDid: string, circleId: string): Promise<void> {
		return this.circles.deleteCircle(viewerDid, circleId);
	}

	addCircleMember(
		viewerDid: string,
		circleId: string,
		targetDid: string,
	): Promise<void> {
		return this.circles.addCircleMember(viewerDid, circleId, targetDid);
	}

	removeCircleMember(
		viewerDid: string,
		circleId: string,
		targetDid: string,
	): Promise<void> {
		return this.circles.removeCircleMember(viewerDid, circleId, targetDid);
	}

	/** Members of one of the viewer's circles (paginated), as social cards. */
	getCircleMembers(
		viewerDid: string,
		circleId: string,
		page = 1,
		pageSize = DEFAULT_SOCIAL_PAGE_SIZE,
	): Promise<PaginatedSocialUsersDto> {
		return this.circles.getCircleMembers(viewerDid, circleId, page, pageSize);
	}

	getFollowedWatchers(
		viewerDid: string,
		mediaType: "movie" | "show",
		mediaId: string,
		pageSize = DEFAULT_WATCHERS_PAGE_SIZE,
	): Promise<FollowedWatchersDto> {
		return this.activityFeed.getFollowedWatchers(
			viewerDid,
			mediaType,
			mediaId,
			pageSize,
		);
	}

	indexFollowRecord(
		followerDid: string,
		rkey: string,
		cid: string | undefined,
		record: FollowRecord,
		uri?: string,
	) {
		return this.follows.indexFollowRecord(followerDid, rkey, cid, record, uri);
	}

	deleteFollowRecordIndex(followerDid: string, rkey: string) {
		return this.follows.deleteFollowRecordIndex(followerDid, rkey);
	}
}
