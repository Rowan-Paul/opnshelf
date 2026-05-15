import {
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import {
	FollowedActivityFeedDto,
	PaginatedSocialUsersDto,
	FollowedWatchersDto,
	SocialFeedPaginationQueryDto,
	SocialPaginationQueryDto,
	SocialSearchQueryDto,
	SocialWatchersQueryDto,
	UserRelationshipDto,
} from "./dto/social.dto";
import { type ATSession, SocialService } from "./social.service";

@ApiTags("social")
@UseGuards(AuthGuard)
@Controller("social")
export class SocialController {
	constructor(private readonly socialService: SocialService) {}

	@Get("suggestions")
	@ApiOperation({
		summary:
			"Get follow suggestions based on Bluesky follows, falling back to active users",
	})
	@ApiResponse({ status: 200, type: PaginatedSocialUsersDto })
	async getSuggestions(
		@Req() req: AuthenticatedRequest,
	): Promise<PaginatedSocialUsersDto> {
		return this.socialService.getSuggestions(getViewerDid(req));
	}

	@Get("search")
	@ApiOperation({ summary: "Search OpnShelf people by handle or display name" })
	@ApiResponse({ status: 200, type: PaginatedSocialUsersDto })
	async searchPeople(
		@Req() req: AuthenticatedRequest,
		@Query() query: SocialSearchQueryDto,
	): Promise<PaginatedSocialUsersDto> {
		return this.socialService.searchPeople(
			getViewerDid(req),
			query.q,
			query.page ?? 1,
			query.pageSize ?? 20,
		);
	}

	@Post("follows/:targetDid")
	@ApiOperation({ summary: "Follow an OpnShelf user" })
	@ApiResponse({ status: 200, type: UserRelationshipDto })
	async follow(
		@Req() req: AuthenticatedRequest,
		@Param("targetDid") targetDid: string,
	): Promise<UserRelationshipDto> {
		return this.socialService.follow(
			getViewerDid(req),
			req.user.session as ATSession,
			targetDid,
		);
	}

	@Delete("follows/:targetDid")
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ summary: "Unfollow an OpnShelf user" })
	@ApiResponse({ status: 204, description: "Relationship removed" })
	async unfollow(
		@Req() req: AuthenticatedRequest,
		@Param("targetDid") targetDid: string,
	): Promise<void> {
		await this.socialService.unfollow(
			getViewerDid(req),
			req.user.session as ATSession,
			targetDid,
		);
	}

	@Get("relationship/:targetDid")
	@ApiOperation({ summary: "Get the viewer's relationship to a user" })
	@ApiResponse({ status: 200, type: UserRelationshipDto })
	async getRelationship(
		@Req() req: AuthenticatedRequest,
		@Param("targetDid") targetDid: string,
	): Promise<UserRelationshipDto> {
		return this.socialService.getRelationship(getViewerDid(req), targetDid);
	}

	@Get("profiles/:handle/followers")
	@ApiOperation({ summary: "Get followers for a public profile" })
	@ApiResponse({ status: 200, type: PaginatedSocialUsersDto })
	async getFollowers(
		@Req() req: AuthenticatedRequest,
		@Param("handle") handle: string,
		@Query() query: SocialPaginationQueryDto,
	): Promise<PaginatedSocialUsersDto> {
		return this.socialService.getFollowers(
			getViewerDid(req),
			handle,
			query.page ?? 1,
			query.pageSize ?? 20,
		);
	}

	@Get("profiles/:handle/following")
	@ApiOperation({ summary: "Get following for a public profile" })
	@ApiResponse({ status: 200, type: PaginatedSocialUsersDto })
	async getFollowing(
		@Req() req: AuthenticatedRequest,
		@Param("handle") handle: string,
		@Query() query: SocialPaginationQueryDto,
	): Promise<PaginatedSocialUsersDto> {
		return this.socialService.getFollowing(
			getViewerDid(req),
			handle,
			query.page ?? 1,
			query.pageSize ?? 20,
		);
	}

	@Get("feed")
	@ApiOperation({ summary: "Get recent watched activity from followed users" })
	@ApiResponse({ status: 200, type: FollowedActivityFeedDto })
	async getFeed(
		@Req() req: AuthenticatedRequest,
		@Query() query: SocialFeedPaginationQueryDto,
	): Promise<FollowedActivityFeedDto> {
		return this.socialService.getFollowedActivityFeed(
			getViewerDid(req),
			query.page ?? 1,
			query.pageSize ?? 10,
		);
	}

	@Get("watchers")
	@ApiOperation({
		summary:
			"Get followed users who watched a scoped movie, show, season, or episode",
	})
	@ApiResponse({ status: 200, type: FollowedWatchersDto })
	async getWatchers(
		@Req() req: AuthenticatedRequest,
		@Query() query: SocialWatchersQueryDto,
	): Promise<FollowedWatchersDto> {
		return this.socialService.getFollowedWatchers(
			getViewerDid(req),
			query.mediaType,
			query.mediaId,
			query.pageSize ?? 3,
		);
	}
}

function getViewerDid(req: AuthenticatedRequest) {
	const did = req.user?.did;
	if (!did) {
		throw new Error("User not found in request");
	}

	return did;
}
