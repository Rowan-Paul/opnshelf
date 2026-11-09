import {
	Body,
	Controller,
	Get,
	Param,
	Patch,
	Post,
	Query,
	Req,
	Res,
	UseGuards,
} from "@nestjs/common";
import {
	ApiExcludeEndpoint,
	ApiQuery,
	ApiResponse,
	ApiTags,
} from "@nestjs/swagger";
import type { Response } from "express";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import {
	SyncActionDto,
	IntegrationIssuesDto,
	SyncIssuesQueryDto,
	IntegrationResolveDto,
	SyncSettingsDto,
	SyncStatusDto,
} from "../integrations/integration.dto";
import { BingersSyncService } from "./bingers-sync.service";
import {
	TraktMatchCandidateDto,
	SyncConnectDto,
	SyncAuthorizeDto,
} from "../trakt-sync/trakt-sync.dto";

@ApiTags("bingers-sync")
@Controller("bingers-sync")
export class BingersSyncController {
	constructor(private readonly sync: BingersSyncService) {}
	@Get("client-metadata")
	metadata() {
		return this.sync.metadata();
	}
	@Get("client")
	@ApiExcludeEndpoint()
	client(@Res() res: Response) {
		res.redirect(this.sync.homepage());
	}
	@Get()
	@UseGuards(AuthGuard)
	@ApiResponse({ status: 200, type: SyncStatusDto })
	status(@Req() req: AuthenticatedRequest) {
		return this.sync.status(req.user.did);
	}
	@Post("connect")
	@UseGuards(AuthGuard)
	@ApiResponse({ status: 201, type: SyncAuthorizeDto })
	connect(@Req() req: AuthenticatedRequest, @Body() dto: SyncConnectDto) {
		return this.sync.authorize(req.user.did, dto.platform, dto.returnTo);
	}
	@Get("callback")
	async callback(
		@Query("state") state: string,
		@Query("code") code: string | undefined,
		@Res() res: Response,
	) {
		res.redirect(await this.sync.callback(state, code));
	}
	@Patch()
	@UseGuards(AuthGuard)
	@ApiResponse({ status: 200, type: SyncStatusDto })
	configure(@Req() req: AuthenticatedRequest, @Body() dto: SyncSettingsDto) {
		return this.sync.configure(req.user.did, dto);
	}
	@Post("action")
	@UseGuards(AuthGuard)
	@ApiResponse({ status: 201, type: SyncStatusDto })
	action(@Req() req: AuthenticatedRequest, @Body() dto: SyncActionDto) {
		return this.sync.action(req.user.did, dto.action);
	}
	@Get("issues")
	@UseGuards(AuthGuard)
	@ApiResponse({ status: 200, type: IntegrationIssuesDto })
	issues(@Req() req: AuthenticatedRequest, @Query() query: SyncIssuesQueryDto) {
		return this.sync.listIssues(req.user.did, query);
	}
	@Post("issues/:id")
	@UseGuards(AuthGuard)
	@ApiResponse({ status: 201, type: SyncStatusDto })
	resolve(
		@Req() req: AuthenticatedRequest,
		@Param("id") id: string,
		@Body() dto: IntegrationResolveDto,
	) {
		return this.sync.resolveIssue(req.user.did, id, dto);
	}
	@Get("issues/:id/matches")
	@UseGuards(AuthGuard)
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
