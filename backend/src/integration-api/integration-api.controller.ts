import {
	Body,
	Controller,
	Get,
	NotFoundException,
	Param,
	Patch,
	Post,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiParam, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import { BingersSyncService } from "../bingers-sync/bingers-sync.service";
import {
	IntegrationConnectDto,
	IntegrationConnectResultDto,
	IntegrationIssuesDto,
	IntegrationMatchCandidateDto,
	IntegrationResolveDto,
	SyncActionDto,
	SyncIssuesQueryDto,
	SyncSettingsDto,
	SyncStatusDto,
} from "../integrations/integration.dto";
import type { IntegrationSyncService } from "../integrations/integration-sync.service";
import {
	INTEGRATION_PROVIDERS,
	type IntegrationProviderId,
} from "../integrations/providers";
import { PopfeedSyncService } from "../popfeed-sync/popfeed-sync.service";
import { TraktSyncService } from "../trakt-sync/trakt-sync.service";

const Provider = () =>
	ApiParam({ name: "provider", enum: Object.keys(INTEGRATION_PROVIDERS) });

/**
 * One API for every Integration (ADR 0051): the same requests and responses
 * whichever provider is named. OAuth callbacks stay on each provider's own
 * controller because their URLs are registered with the provider.
 */
@ApiTags("integrations")
@Controller("integrations/:provider")
@UseGuards(AuthGuard)
export class IntegrationApiController {
	private readonly services: Record<
		IntegrationProviderId,
		// biome-ignore lint/suspicious/noExplicitAny: each provider has its own credential type
		IntegrationSyncService<any>
	>;
	constructor(
		trakt: TraktSyncService,
		popfeed: PopfeedSyncService,
		bingers: BingersSyncService,
	) {
		this.services = { trakt, popfeed, bingers };
	}
	private sync(provider: string) {
		if (!Object.hasOwn(this.services, provider))
			throw new NotFoundException("Unknown Integration.");
		return this.services[provider as IntegrationProviderId];
	}
	@Get()
	@Provider()
	@ApiResponse({ status: 200, type: SyncStatusDto })
	status(
		@Req() req: AuthenticatedRequest,
		@Param("provider") provider: string,
	) {
		return this.sync(provider).status(req.user.did);
	}
	@Post("connect")
	@Provider()
	@ApiResponse({ status: 201, type: IntegrationConnectResultDto })
	connect(
		@Req() req: AuthenticatedRequest,
		@Param("provider") provider: string,
		@Body() dto: IntegrationConnectDto,
	) {
		return this.sync(provider).connectRequest(
			req.user.did,
			dto.platform,
			dto.returnTo,
		);
	}
	@Patch()
	@Provider()
	@ApiResponse({ status: 200, type: SyncStatusDto })
	configure(
		@Req() req: AuthenticatedRequest,
		@Param("provider") provider: string,
		@Body() dto: SyncSettingsDto,
	) {
		return this.sync(provider).configure(req.user.did, dto);
	}
	@Post("action")
	@Provider()
	@ApiResponse({ status: 201, type: SyncStatusDto })
	action(
		@Req() req: AuthenticatedRequest,
		@Param("provider") provider: string,
		@Body() dto: SyncActionDto,
	) {
		return this.sync(provider).action(req.user.did, dto.action);
	}
	@Get("issues")
	@Provider()
	@ApiResponse({ status: 200, type: IntegrationIssuesDto })
	issues(
		@Req() req: AuthenticatedRequest,
		@Param("provider") provider: string,
		@Query() query: SyncIssuesQueryDto,
	) {
		return this.sync(provider).listIssues(req.user.did, query);
	}
	@Post("issues/:id")
	@Provider()
	@ApiResponse({ status: 201, type: SyncStatusDto })
	resolve(
		@Req() req: AuthenticatedRequest,
		@Param("provider") provider: string,
		@Param("id") id: string,
		@Body() dto: IntegrationResolveDto,
	) {
		return this.sync(provider).resolveIssue(req.user.did, id, dto);
	}
	@Get("issues/:id/matches")
	@Provider()
	@ApiQuery({ name: "q", required: false })
	@ApiResponse({ status: 200, type: [IntegrationMatchCandidateDto] })
	matches(
		@Req() req: AuthenticatedRequest,
		@Param("provider") provider: string,
		@Param("id") id: string,
		@Query("q") q: string,
	) {
		return this.sync(provider).matches(req.user.did, id, q);
	}
}
