import {
	BadRequestException,
	Body,
	Controller,
	ForbiddenException,
	HttpCode,
	HttpStatus,
	Logger,
	Post,
	Req,
	Res,
	ServiceUnavailableException,
	UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { IngesterService } from "../ingester/ingester.service";
import { CaptchaService } from "../pds/captcha.service";
import { TranquilAdminService } from "../pds/tranquil-admin.service";
import { sessionCookieOptions } from "./auth-flow";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { DeviceSessionsService } from "./device-sessions.service";
import { RegisterDto, RegisterResponseDto } from "./dto/register.dto";
import { VerifyEmailDto, VerifyEmailResponseDto } from "./dto/verify-email.dto";
import { NativeAccountService } from "./native-account.service";
import { extractSessionId, SESSION_COOKIE_NAME } from "./session-id";
import { SignupRateLimiter } from "./signup-rate-limiter";
import {
	getClientIp,
	mapConfirmEmailError,
	mapCreateAccountError,
} from "./signup-support";
import type { AuthenticatedRequest } from "./types";

/**
 * Password signup on Opnshelf's own PDS and the email verification that
 * follows it. Routes keep their `AuthController_*` operationIds: the generated
 * client names its functions after them, so moving a route must not rename it.
 */
@ApiTags("auth")
@Controller()
export class SignupController {
	private readonly logger = new Logger(SignupController.name);

	constructor(
		private readonly authService: AuthService,
		private readonly nativeAccounts: NativeAccountService,
		private readonly sessions: DeviceSessionsService,
		private readonly configService: ConfigService,
		private readonly ingesterService: IngesterService,
		private readonly tranquilAdmin: TranquilAdminService,
		private readonly captcha: CaptchaService,
		private readonly rateLimiter: SignupRateLimiter,
	) {}

	/**
	 * Create an account directly on opnshelf's own Tranquil PDS.
	 *
	 * This is the spam-resistant alternative to the OAuth `prompt=create` flow:
	 * opnshelf is the gatekeeper. A request must clear a captcha, then we mint a
	 * single-use invite code (our PDS runs with invite_code_required=true) and
	 * create the account ourselves. The caller never reaches the PDS directly,
	 * so bots can't self-register.
	 */
	@Post("auth/register")
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		operationId: "AuthController_register",
		summary: "Create an account on opnshelf's PDS (captcha + invite gated)",
	})
	@ApiResponse({ status: HttpStatus.CREATED, type: RegisterResponseDto })
	@ApiResponse({ status: 403, description: "Captcha verification failed" })
	@ApiResponse({ status: 409, description: "Username or email already taken" })
	@ApiResponse({ status: 429, description: "Too many signup attempts" })
	async register(
		@Body() dto: RegisterDto,
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	): Promise<RegisterResponseDto> {
		const ip = getClientIp(req);
		this.rateLimiter.enforceRegisterRateLimit(ip);

		const human = await this.captcha.verify(dto.captchaToken, ip);
		if (!human) {
			throw new ForbiddenException("Captcha verification failed");
		}

		const handleDomain = this.configService.get<string>("PDS_HANDLE_DOMAIN");
		if (!handleDomain) {
			this.logger.error("PDS_HANDLE_DOMAIN is not configured");
			throw new ServiceUnavailableException("Signup is not configured");
		}
		const handle = `${dto.username.toLowerCase()}.${handleDomain}`;

		// Mint a fresh single-use invite code from our PDS admin account.
		let inviteCode: string;
		try {
			inviteCode = await this.tranquilAdmin.mintInviteCode(1);
		} catch (error) {
			this.logger.error("Failed to mint invite code for signup", error);
			throw new ServiceUnavailableException(
				"Could not allocate an invite right now",
			);
		}

		// Create the account on the PDS. On failure, free the unused code.
		let account: Awaited<
			ReturnType<typeof this.nativeAccounts.registerAccount>
		>;
		try {
			account = await this.nativeAccounts.registerAccount({
				handle,
				email: dto.email,
				password: dto.password,
				inviteCode,
			});
		} catch (error) {
			void this.tranquilAdmin
				.disableInviteCodes([inviteCode])
				.catch(() => undefined);
			throw mapCreateAccountError(error, this.logger);
		}

		// Persist a credential session so the guard can resume it.
		const sessionId = await this.sessions.createCredentialSession({
			did: account.did,
			handle: account.handle,
			accessJwt: account.accessJwt,
			refreshJwt: account.refreshJwt,
			pdsUrl: account.pdsUrl,
		});

		await this.authService.upsertUser(
			{
				did: account.did,
				handle: account.handle,
				displayName: null,
				avatar: null,
			},
			dto.timezone,
			// Native account on our own PDS: starts unverified and is gated until
			// the email is confirmed (see needsEmailVerification / ADR-0004).
			{ isNativePds: true },
		);

		// Register the new repo with Tab for tracking/backfill (best-effort).
		// markBackfillStart opens the shelf's "syncing your watch history…" window.
		try {
			await this.ingesterService.addRepo(account.did, {
				markBackfillStart: true,
			});
		} catch (error) {
			this.logger.error(`Failed to register ${account.did} with Tab`, error);
		}

		// NB: we do NOT seed the profile/default lists here. The PDS rejects all
		// record writes until the account verifies its email (notification
		// channel), so seeding happens in `verifyEmail` once the code is
		// confirmed. See docs/adr/0004-verify-email-before-seeding-records.md.

		res.cookie(
			SESSION_COOKIE_NAME,
			sessionId,
			sessionCookieOptions(this.configService),
		);

		return {
			did: account.did,
			handle: account.handle,
			sessionId,
		};
	}

	/**
	 * Confirm the signup verification code for a native PDS account.
	 *
	 * On success the bootstrap credential is revoked and the client is handed
	 * into Core OAuth. Seeding happens only in that scoped OAuth callback.
	 */
	@Post("auth/verify-email")
	@HttpCode(HttpStatus.OK)
	@UseGuards(AuthGuard)
	@ApiOperation({
		operationId: "AuthController_verifyEmail",
		summary: "Confirm the signup email verification code",
	})
	@ApiResponse({ status: 200, type: VerifyEmailResponseDto })
	@ApiResponse({ status: 400, description: "Invalid or expired code" })
	@ApiResponse({ status: 401, description: "Not authenticated" })
	async verifyEmail(
		@Req() req: AuthenticatedRequest,
		@Body() dto: VerifyEmailDto,
	): Promise<VerifyEmailResponseDto> {
		const did = req.user?.did;
		if (!did) {
			throw new BadRequestException("User not found in request");
		}
		// Reuse the session the guard already restored. Restoring again here would
		// spin up a competing credential session that races the guard's on the
		// PDS's single-use refresh token; the loser's refresh is rejected, the
		// agent treats the session as expired, and revoke() deletes it — logging
		// the user out mid-verification. One restore per request avoids that.
		const session = req.user?.session;

		const user = await this.authService.getUser(did);
		if (!user) {
			throw new BadRequestException("User not found");
		}

		try {
			await this.nativeAccounts.confirmEmailWithCode(session, dto.code);
		} catch (error) {
			throw mapConfirmEmailError(error, this.logger);
		}

		await this.nativeAccounts.markEmailVerified(did);
		// The Mobile App names itself so the Core callback lands back in the app
		// (with a handoff code when it also sent a challenge) instead of on the web.
		const coreOAuthUrl = dto.platform
			? await this.authService.authorize(user.handle, {
					platform: dto.platform,
					codeChallenge: dto.codeChallenge,
				})
			: await this.authService.authorize(user.handle);
		const bootstrapSessionId = extractSessionId(req);
		if (bootstrapSessionId) {
			await this.authService.revokeBySessionId(bootstrapSessionId);
		}

		return { verified: true, coreOAuthUrl };
	}

	/**
	 * Ask the PDS to resend the signup verification email.
	 */
	@Post("auth/resend-verification")
	@HttpCode(HttpStatus.OK)
	@UseGuards(AuthGuard)
	@ApiOperation({
		operationId: "AuthController_resendVerification",
		summary: "Resend the signup email verification code",
	})
	@ApiResponse({ status: 200, description: "Verification email resent" })
	@ApiResponse({ status: 401, description: "Not authenticated" })
	@ApiResponse({ status: 429, description: "Too many resend attempts" })
	async resendVerification(
		@Req() req: AuthenticatedRequest,
	): Promise<{ message: string }> {
		const did = req.user?.did;
		if (!did) {
			throw new BadRequestException("User not found in request");
		}
		this.rateLimiter.enforceResendRateLimit(did);
		// Tranquil's resendVerification is unauthenticated and keyed by DID, so
		// no session restore is needed (it re-enqueues the signup code).
		await this.nativeAccounts.resendEmailConfirmation(did);
		return { message: "Verification email sent" };
	}
}
