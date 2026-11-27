import {
	Body,
	Controller,
	Delete,
	Get,
	Header,
	Param,
	Post,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
import {
	ApiOkResponse,
	ApiCreatedResponse,
	ApiQuery,
	ApiTags,
} from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import {
	CheckInsDto,
	StartCheckInDto,
	WatchingCheckInDto,
} from "./check-ins.dto";
import { CheckInsService } from "./check-ins.service";

@ApiTags("check-ins")
@Controller("check-ins")
export class CheckInsController {
	constructor(private readonly checkIns: CheckInsService) {}

	@Get()
	@UseGuards(AuthGuard)
	@ApiOkResponse({ type: CheckInsDto })
	own(@Req() request: AuthenticatedRequest) {
		return this.checkIns.own(request.user.did);
	}

	@Get("profile/:did")
	@Header("Cache-Control", "no-store")
	@ApiOkResponse({ type: CheckInsDto })
	profile(@Param("did") did: string) {
		return this.checkIns.visible({ did });
	}

	@Get("following")
	@UseGuards(AuthGuard)
	@ApiQuery({ name: "circleId", required: false })
	@ApiOkResponse({ type: CheckInsDto })
	following(
		@Req() request: AuthenticatedRequest,
		@Query("circleId") circleId?: string,
	) {
		return this.checkIns.visible({
			followers: {
				some: {
					followerDid: request.user.did,
					...(circleId
						? {
								circleMembers: {
									some: { circleId, circle: { ownerDid: request.user.did } },
								},
							}
						: {}),
				},
			},
		});
	}

	@Post()
	@UseGuards(AuthGuard)
	@ApiCreatedResponse({ type: WatchingCheckInDto })
	start(@Req() request: AuthenticatedRequest, @Body() body: StartCheckInDto) {
		return this.checkIns.start(request.user.did, body);
	}

	@Post(":rkey/finish")
	@UseGuards(AuthGuard)
	@ApiCreatedResponse({ type: CheckInsDto })
	finish(@Req() request: AuthenticatedRequest, @Param("rkey") rkey: string) {
		return this.checkIns.finish(request.user.did, rkey, request.user.session);
	}

	@Delete(":rkey")
	@UseGuards(AuthGuard)
	@ApiOkResponse({ type: CheckInsDto })
	cancel(@Req() request: AuthenticatedRequest, @Param("rkey") rkey: string) {
		return this.checkIns.cancel(request.user.did, rkey);
	}
}
