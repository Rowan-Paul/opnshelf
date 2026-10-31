import {
	Body,
	Controller,
	Get,
	Param,
	Patch,
	Post,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import {
	IntegrationIssuesDto,
	IntegrationResolveDto,
	SyncActionDto,
	SyncIssuesQueryDto,
	SyncSettingsDto,
	SyncStatusDto,
} from "../integrations/integration.dto";
import { TraktMatchCandidateDto } from "../trakt-sync/trakt-sync.dto";
import { PopfeedSyncService } from "./popfeed-sync.service";

@ApiTags("popfeed-sync")
@Controller("popfeed-sync")
@UseGuards(AuthGuard)
export class PopfeedSyncController {
	constructor(private readonly sync: PopfeedSyncService) {}
	@Get()
	@ApiResponse({ status: 200, type: SyncStatusDto })
	status(@Req() req: AuthenticatedRequest) {
		return this.sync.status(req.user.did);
	}
	@Post("connect")
	@ApiResponse({ status: 201, type: SyncStatusDto })
	connect(@Req() req: AuthenticatedRequest) {
		return this.sync.connect(req.user.did);
	}
	@Patch()
	@ApiResponse({ status: 200, type: SyncStatusDto })
	configure(@Req() req: AuthenticatedRequest, @Body() dto: SyncSettingsDto) {
		return this.sync.configure(req.user.did, dto);
	}
	@Post("action")
	@ApiResponse({ status: 201, type: SyncStatusDto })
	action(@Req() req: AuthenticatedRequest, @Body() dto: SyncActionDto) {
		return this.sync.action(req.user.did, dto.action);
	}
	@Get("issues")
	@ApiResponse({ status: 200, type: IntegrationIssuesDto })
	issues(@Req() req: AuthenticatedRequest, @Query() query: SyncIssuesQueryDto) {
		return this.sync.listIssues(req.user.did, query);
	}
	@Post("issues/:id")
	@ApiResponse({ status: 201, type: SyncStatusDto })
	resolve(
		@Req() req: AuthenticatedRequest,
		@Param("id") id: string,
		@Body() dto: IntegrationResolveDto,
	) {
		return this.sync.resolveIssue(req.user.did, id, dto);
	}
	@Get("issues/:id/matches")
	@ApiQuery({ name: "q", required: false })
	@ApiResponse({ status: 200, type: [TraktMatchCandidateDto] })
	matches(
		@Req() req: AuthenticatedRequest,
		@Param("id") id: string,
		@Query("q") q: string,
	) {
		return this.sync.matches(req.user.did, id, q);
	}
}
