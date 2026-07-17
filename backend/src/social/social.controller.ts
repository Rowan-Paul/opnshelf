import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
	Post,
	Put,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import {
	CircleDto,
	CircleFeedPaginationQueryDto,
	FollowedActivityFeedDto,
	PaginatedSocialUsersDto,
	FollowedWatchersDto,
	SocialPaginationQueryDto,
	SocialSearchQueryDto,
	SocialWatchersQueryDto,
	UpsertCircleDto,
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
	@ApiOperation({ summary: "Search Opnshelf people by handle or display name" })
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
	@ApiOperation({ summary: "Follow an Opnshelf user" })
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
	@ApiOperation({ summary: "Unfollow an Opnshelf user" })
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
	@ApiOperation({
		summary:
			"Get recent watched activity from followed users, optionally scoped to a circle",
	})
	@ApiResponse({ status: 200, type: FollowedActivityFeedDto })
	async getFeed(
		@Req() req: AuthenticatedRequest,
		@Query() query: CircleFeedPaginationQueryDto,
	): Promise<FollowedActivityFeedDto> {
		return this.socialService.getFollowedActivityFeed(
			getViewerDid(req),
			query.page ?? 1,
			query.pageSize ?? 10,
			query.circleId,
		);
	}

	@Get("circles")
	@ApiOperation({ summary: "List the viewer's circles" })
	@ApiResponse({ status: 200, type: [CircleDto] })
	async listCircles(@Req() req: AuthenticatedRequest): Promise<CircleDto[]> {
		return this.socialService.listCircles(getViewerDid(req));
	}

	@Post("circles")
	@ApiOperation({ summary: "Create a circle" })
	@ApiResponse({ status: 201, type: CircleDto })
	async createCircle(
		@Req() req: AuthenticatedRequest,
		@Body() body: UpsertCircleDto,
	): Promise<CircleDto> {
		return this.socialService.createCircle(getViewerDid(req), body.name);
	}

	@Patch("circles/:circleId")
	@ApiOperation({ summary: "Rename a circle" })
	@ApiResponse({ status: 200, type: CircleDto })
	async renameCircle(
		@Req() req: AuthenticatedRequest,
		@Param("circleId") circleId: string,
		@Body() body: UpsertCircleDto,
	): Promise<CircleDto> {
		return this.socialService.renameCircle(
			getViewerDid(req),
			circleId,
			body.name,
		);
	}

	@Delete("circles/:circleId")
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ summary: "Delete a circle" })
	@ApiResponse({ status: 204, description: "Circle removed" })
	async deleteCircle(
		@Req() req: AuthenticatedRequest,
		@Param("circleId") circleId: string,
	): Promise<void> {
		await this.socialService.deleteCircle(getViewerDid(req), circleId);
	}

	@Get("circles/:circleId/members")
	@ApiOperation({ summary: "List the members of one of the viewer's circles" })
	@ApiResponse({ status: 200, type: PaginatedSocialUsersDto })
	async getCircleMembers(
		@Req() req: AuthenticatedRequest,
		@Param("circleId") circleId: string,
		@Query() query: SocialPaginationQueryDto,
	): Promise<PaginatedSocialUsersDto> {
		return this.socialService.getCircleMembers(
			getViewerDid(req),
			circleId,
			query.page ?? 1,
			query.pageSize ?? 20,
		);
	}

	@Put("circles/:circleId/members/:targetDid")
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ summary: "Add a followed user to a circle" })
	@ApiResponse({ status: 204, description: "Member added" })
	async addCircleMember(
		@Req() req: AuthenticatedRequest,
		@Param("circleId") circleId: string,
		@Param("targetDid") targetDid: string,
	): Promise<void> {
		await this.socialService.addCircleMember(
			getViewerDid(req),
			circleId,
			targetDid,
		);
	}

	@Delete("circles/:circleId/members/:targetDid")
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ summary: "Remove a user from a circle" })
	@ApiResponse({ status: 204, description: "Member removed" })
	async removeCircleMember(
		@Req() req: AuthenticatedRequest,
		@Param("circleId") circleId: string,
		@Param("targetDid") targetDid: string,
	): Promise<void> {
		await this.socialService.removeCircleMember(
			getViewerDid(req),
			circleId,
			targetDid,
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
