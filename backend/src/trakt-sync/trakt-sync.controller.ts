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
import { ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import {
	SyncActionDto,
	SyncAuthorizeDto,
	SyncConnectDto,
	SyncIssuesDto,
	SyncIssuesQueryDto,
	SyncResolveDto,
	SyncSettingsDto,
	SyncStatusDto,
} from "./trakt-sync.dto";
import { TraktSyncService } from "./trakt-sync.service";
import { TraktMatchCandidateDto } from "../users/dto/import-history.dto";

@ApiTags("trakt-sync")
@Controller("trakt-sync")
export class TraktSyncController {
	constructor(private readonly sync: TraktSyncService) {}
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
	@ApiResponse({ status: 200, type: SyncIssuesDto })
	issues(@Req() req: AuthenticatedRequest, @Query() query: SyncIssuesQueryDto) {
		return this.sync.issues(req.user.did, query);
	}
	@Post("issues/:id")
	@UseGuards(AuthGuard)
	@ApiResponse({ status: 201, type: SyncStatusDto })
	resolve(
		@Req() req: AuthenticatedRequest,
		@Param("id") id: string,
		@Body() dto: SyncResolveDto,
	) {
		return this.sync.resolve(req.user.did, id, dto);
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
