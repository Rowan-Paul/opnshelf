import {
	BadRequestException,
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Post,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { DeviceSessionsService } from "./device-sessions.service";
import {
	MobileHandoffChallengeResponseDto,
	MobileHandoffExchangeDto,
	MobileHandoffExchangeResponseDto,
} from "./dto/mobile-handoff.dto";
import { MobileHandoffService } from "./mobile-handoff.service";

/**
 * The two anonymous ends of the Mobile Handoff Code flow (ADR 0026). Routes
 * keep their `AuthController_*` operationIds: the generated client names its
 * functions after them, so moving a route must not rename it.
 */
@ApiTags("auth")
@Controller()
export class MobileHandoffController {
	constructor(
		private readonly mobileHandoff: MobileHandoffService,
		private readonly sessions: DeviceSessionsService,
		private readonly authService: AuthService,
	) {}

	/**
	 * Mint the verifier/challenge pair for a Mobile Handoff Code flow. Anonymous
	 * and cheap, but bounded so it cannot be used as a random-number faucet.
	 */
	@Post("auth/mobile/challenge")
	@HttpCode(HttpStatus.OK)
	@Throttle({ default: { limit: 10, ttl: 60_000 } })
	@ApiOperation({
		operationId: "AuthController_mobileChallenge",
		summary: "Mint a verifier/challenge pair for the mobile OAuth handoff",
	})
	@ApiResponse({ status: 200, type: MobileHandoffChallengeResponseDto })
	mobileChallenge(): MobileHandoffChallengeResponseDto {
		const challenge = this.mobileHandoff.createMobileHandoffChallenge();
		return {
			codeVerifier: challenge.codeVerifier,
			codeChallenge: challenge.codeChallenge,
			expiresAt: challenge.expiresAt.toISOString(),
		};
	}

	/**
	 * Redeem the single-use code from the `opnshelf://auth/complete` redirect for
	 * the session it stands for. One attempt per code, right or wrong.
	 */
	@Post("auth/mobile/exchange")
	@HttpCode(HttpStatus.OK)
	@Throttle({ default: { limit: 10, ttl: 60_000 } })
	@ApiOperation({
		operationId: "AuthController_mobileExchange",
		summary: "Exchange a mobile OAuth handoff code for its session",
	})
	@ApiResponse({ status: 200, type: MobileHandoffExchangeResponseDto })
	@ApiResponse({
		status: 400,
		description: "Unknown, expired, or already used code, or wrong verifier",
	})
	async mobileExchange(
		@Body() dto: MobileHandoffExchangeDto,
	): Promise<MobileHandoffExchangeResponseDto> {
		const invalid = () =>
			new BadRequestException("Invalid or expired sign-in code");
		const exchanged = this.mobileHandoff.exchangeMobileHandoffCode(
			dto.code,
			dto.codeVerifier,
		);
		if (!exchanged) throw invalid();
		const session = await this.sessions.getSessionById(exchanged.sessionId);
		if (!session) throw invalid();
		const user = await this.authService.getUser(session.userDid);
		if (!user) throw invalid();
		return { sessionId: session.id, did: user.did, handle: user.handle };
	}
}
