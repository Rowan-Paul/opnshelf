import { randomBytes } from "node:crypto";
import {
	BadRequestException,
	Body,
	Controller,
	ForbiddenException,
	Get,
	HttpCode,
	HttpStatus,
	Logger,
	Post,
	Req,
	Res,
	ServiceUnavailableException,
	UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import {
	ApiExcludeEndpoint,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import { AppleOAuthService } from "../pds/apple-oauth.service";
import { CaptchaService } from "../pds/captcha.service";
import { TranquilAdminService } from "../pds/tranquil-admin.service";
import {
	flowCookieOptions,
	getFrontendUrl,
	isProduction,
	TIMEZONE_COOKIE_NAME,
} from "./auth-flow";
import { AuthService } from "./auth.service";
import {
	AppleRegisterDto,
	ApplePendingResponseDto,
	AppleRegisterResponseDto,
} from "./dto/apple-register.dto";
import { NativeSsoDto, NativeSsoResponseDto } from "./dto/native-sso.dto";
import { NativeAccountService } from "./native-account.service";
import { signProviderState, verifyProviderState } from "./provider-state";
import { SignupRateLimiter } from "./signup-rate-limiter";
import { getClientIp, mapCreateAccountError } from "./signup-support";

/** Holds the PDS pending-registration token between Apple and the handle picker. */
const APPLE_PENDING_COOKIE_NAME = "apple_pending";
const APPLE_COOKIE_MAX_AGE_MS = 15 * 60 * 1000;

type AppleSignupError =
	| "apple_unavailable"
	| "apple_failed"
	| "apple_email_unverified";

/** Apple's form_post body. `user` arrives only on a first authorization. */
interface AppleCallbackBody {
	code?: string;
	state?: string;
	error?: string;
	user?: string;
}

/**
 * "Continue with Apple" for the browser: the web app, and the Android app,
 * which cannot use a native credential (ADR 0027).
 *
 * Shaped like GoogleSignupController with one structural difference: the
 * callback is a POST. Apple requires `response_mode=form_post` whenever the
 * `email` scope is requested, so the browser cross-site POSTs here and a
 * SameSite=Lax cookie is not sent — hence signed state rather than a state
 * cookie (ADR 0028).
 */
@ApiTags("auth")
@Controller()
export class AppleSignupController {
	private readonly logger = new Logger(AppleSignupController.name);
	private readonly pendingAppleEmails = new Map<
		string,
		{ email: string; expiresAt: number }
	>();
	private readonly stateSecret: string;

	constructor(
		private readonly authService: AuthService,
		private readonly nativeAccounts: NativeAccountService,
		private readonly configService: ConfigService,
		private readonly tranquilAdmin: TranquilAdminService,
		private readonly captcha: CaptchaService,
		private readonly appleOAuth: AppleOAuthService,
		private readonly rateLimiter: SignupRateLimiter,
	) {
		const configured = this.configService.get<string>("PROVIDER_STATE_SECRET");
		if (configured) {
			this.stateSecret = configured;
		} else {
			// A per-process key still signs correctly, but every restart
			// invalidates the signups in flight — the exact failure mode ADR 0028
			// rejected an in-memory map for. Fine locally, not in production.
			this.stateSecret = randomBytes(32).toString("base64url");
			const message =
				"PROVIDER_STATE_SECRET is not set; Apple signup state will not survive a restart.";
			if (isProduction(this.configService)) this.logger.error(message);
			else this.logger.warn(message);
		}
	}

	/** Bounce back to the signup form with a code it turns into a toast. */
	private buildSignupErrorUrl(errorCode: AppleSignupError): string {
		const url = new URL("/signup", getFrontendUrl(this.configService));
		url.searchParams.set("error", errorCode);
		return url.toString();
	}

	/**
	 * Start "Continue with Apple".
	 *
	 * Unlike Google this is reachable from the Android app as well as the web,
	 * because `expo-apple-authentication` is iOS-only and omitting Apple on
	 * Android would lock out anyone who created their account on an iPhone.
	 */
	@Get("auth/apple/start")
	@ApiOperation({
		operationId: "AuthController_appleStart",
		summary: "Begin Continue with Apple",
	})
	@ApiResponse({ status: 302, description: "Redirect to Apple" })
	appleStart(@Res() res: Response): void {
		if (!this.appleOAuth.configured) {
			res.redirect(this.buildSignupErrorUrl("apple_unavailable"));
			return;
		}
		res.redirect(
			this.appleOAuth.buildAuthUrl(signProviderState(this.stateSecret)),
		);
	}

	/**
	 * Apple's form_post callback.
	 *
	 * Excluded from the OpenAPI document: it is a browser redirect target, never
	 * something the generated client calls, and its body is Apple's shape rather
	 * than ours.
	 */
	@Post("auth/apple/callback")
	@ApiExcludeEndpoint()
	async appleCallback(
		@Body() body: AppleCallbackBody,
		@Res() res: Response,
	): Promise<void> {
		if (body.error || !body.code) {
			// `user_cancelled_authorize` lands here too: the user backed out, which
			// is not worth distinguishing from a failure on the signup form.
			res.redirect(this.buildSignupErrorUrl("apple_failed"));
			return;
		}

		if (!verifyProviderState(this.stateSecret, body.state)) {
			this.logger.warn("Rejected an Apple callback with unusable state");
			res.redirect(this.buildSignupErrorUrl("apple_failed"));
			return;
		}

		let coreOAuthUrl: string | undefined;
		try {
			const idToken = await this.appleOAuth.exchangeCode(body.code);
			coreOAuthUrl = await this.authService.authorizeWithPds();
			const requestUri = new URL(coreOAuthUrl).searchParams.get("request_uri");
			if (!requestUri) {
				throw new Error("Core OAuth URL carried no request_uri");
			}

			const pending = await this.nativeAccounts.startSsoRegistration(
				idToken,
				requestUri,
				"apple",
			);

			// A returning user: the PDS bound the existing DID to the OAuth request
			// and told us where to continue (consent, or TOTP first).
			if (pending.redirectUrl) {
				res.redirect(pending.redirectUrl);
				return;
			}

			if (!pending.token) {
				throw new Error(
					"PDS returned neither a registration token nor redirect",
				);
			}

			// Apple verifies the address it reports, including a private relay one.
			// Without that the account would be created and then gated behind a code
			// Tranquil cannot email, so refuse before anything exists.
			if (!pending.email || !pending.emailVerified) {
				res.redirect(this.buildSignupErrorUrl("apple_email_unverified"));
				return;
			}

			res.cookie(
				APPLE_PENDING_COOKIE_NAME,
				pending.token,
				this.appleCookieOptions(),
			);
			this.rememberPendingEmail(pending.token, pending.email);

			// No `?suggested=`: Apple never reports a username, so the handle field
			// starts empty and Onboarding collects the display name later (ADR 0027).
			res.redirect(
				new URL("/signup/apple", getFrontendUrl(this.configService)).toString(),
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			// The PDS says this Apple identity already belongs to an account. That
			// is a sign-in, not an error: hand the browser to the PDS's own page
			// with a provider hint so it skips the picker.
			if (message.includes("already linked") && coreOAuthUrl) {
				const signInUrl = new URL(coreOAuthUrl);
				signInUrl.searchParams.set("sso", "apple");
				res.redirect(signInUrl.toString());
				return;
			}
			this.logger.error("Apple callback failed", error);
			res.redirect(this.buildSignupErrorUrl("apple_failed"));
		}
	}

	@Get("auth/apple/pending")
	@ApiOperation({
		operationId: "AuthController_applePending",
		summary: "Read the pending Apple signup identity",
	})
	@ApiResponse({
		status: 200,
		description: "Pending Apple signup identity",
		type: ApplePendingResponseDto,
	})
	applePending(
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	): ApplePendingResponseDto {
		res.setHeader("Cache-Control", "no-store");
		const token = this.readPendingToken(req);
		const pending = token ? this.pendingAppleEmails.get(token) : undefined;
		if (!pending || pending.expiresAt <= Date.now()) {
			if (token) this.pendingAppleEmails.delete(token);
			throw new UnauthorizedException("Apple signup is not pending");
		}
		return { email: pending.email };
	}

	/**
	 * Finish an Apple signup: create the account on our PDS and hand straight
	 * into Core OAuth. Apple already verified the email, so this skips the
	 * verification step exactly as the Google path does.
	 */
	@Post("auth/apple/register")
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		operationId: "AuthController_appleRegister",
		summary: "Create an account from a verified Apple identity",
	})
	@ApiResponse({ status: HttpStatus.CREATED, type: AppleRegisterResponseDto })
	@ApiResponse({ status: 400, description: "Apple signup was not started" })
	@ApiResponse({ status: 403, description: "Captcha verification failed" })
	@ApiResponse({ status: 409, description: "Username already taken" })
	@ApiResponse({ status: 429, description: "Too many signup attempts" })
	async appleRegister(
		@Body() dto: AppleRegisterDto,
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	): Promise<AppleRegisterResponseDto> {
		const ip = getClientIp(req);
		this.rateLimiter.enforceRegisterRateLimit(ip);

		const human = await this.captcha.verify(dto.captchaToken, ip);
		if (!human) {
			throw new ForbiddenException("Captcha verification failed");
		}

		const pendingToken = this.readPendingToken(req, dto);
		if (!pendingToken) {
			throw new BadRequestException(
				"Your Apple sign-in expired. Please start again.",
			);
		}

		const handleDomain = this.configService.get<string>("PDS_HANDLE_DOMAIN");
		if (!handleDomain) {
			this.logger.error("PDS_HANDLE_DOMAIN is not configured");
			throw new ServiceUnavailableException("Signup is not configured");
		}
		const handle = `${dto.username.toLowerCase()}.${handleDomain}`;

		let inviteCode: string;
		try {
			inviteCode = await this.tranquilAdmin.mintInviteCode(1);
		} catch (error) {
			this.logger.error("Failed to mint invite code for Apple signup", error);
			throw new ServiceUnavailableException(
				"Could not allocate an invite right now",
			);
		}

		let account: Awaited<
			ReturnType<typeof this.nativeAccounts.completeSsoRegistration>
		>;
		try {
			account = await this.nativeAccounts.completeSsoRegistration({
				token: pendingToken,
				handle,
				inviteCode,
			});
		} catch (error) {
			void this.tranquilAdmin
				.disableInviteCodes([inviteCode])
				.catch(() => undefined);
			// Keep the pending cookie: a taken username is worth retrying without
			// sending the user back through Apple.
			throw mapCreateAccountError(error, this.logger);
		}

		res.clearCookie(APPLE_PENDING_COOKIE_NAME, { path: "/" });
		this.pendingAppleEmails.delete(pendingToken);

		await this.authService.upsertUser(
			{
				did: account.did,
				handle: account.handle,
				displayName: null,
				avatar: null,
			},
			dto.timezone,
			// Native account on our PDS, but already verified by Apple, so it must
			// not be caught by the verify-email gate (see needsEmailVerification).
			{ isNativePds: true, emailVerified: true },
		);

		if (dto.timezone) {
			res.cookie(
				TIMEZONE_COOKIE_NAME,
				dto.timezone,
				flowCookieOptions(this.configService),
			);
		}

		return {
			did: account.did,
			handle: account.handle,
			coreOAuthUrl: account.redirectUrl,
		};
	}

	/**
	 * Park the email the handle picker shows. In-process like the Google map and
	 * for the same reason (ADR 0025): one replica, and it only has to outlive a
	 * redirect.
	 */
	private rememberPendingEmail(token: string, email: string): void {
		for (const [key, entry] of this.pendingAppleEmails) {
			if (entry.expiresAt <= Date.now()) this.pendingAppleEmails.delete(key);
		}
		this.pendingAppleEmails.set(token, {
			email,
			expiresAt: Date.now() + APPLE_COOKIE_MAX_AGE_MS,
		});
		const expiry = setTimeout(
			() => this.pendingAppleEmails.delete(token),
			APPLE_COOKIE_MAX_AGE_MS,
		);
		expiry.unref?.();
	}

	private appleCookieOptions() {
		return {
			httpOnly: true,
			secure: isProduction(this.configService),
			sameSite: "lax" as const,
			maxAge: APPLE_COOKIE_MAX_AGE_MS,
			path: "/",
		};
	}

	/**
	 * Sign in with a credential the operating system produced (ADR 0027).
	 *
	 * No browser round trip happens here, so there is no state to verify: the
	 * identity token's signature is the proof and the PDS is what checks it,
	 * exactly as it does for the browser flow. Throttled because the token
	 * arrives unauthenticated.
	 */
	@Post("auth/apple/native")
	@HttpCode(HttpStatus.OK)
	@Throttle({ default: { limit: 10, ttl: 60_000 } })
	@ApiOperation({
		operationId: "AuthController_appleNative",
		summary: "Sign in with a native Apple credential",
	})
	@ApiResponse({ status: 200, type: NativeSsoResponseDto })
	@ApiResponse({
		status: 400,
		description: "The credential could not be verified",
	})
	async appleNative(@Body() dto: NativeSsoDto): Promise<NativeSsoResponseDto> {
		const coreOAuthUrl = await this.authService.authorizeWithPds();
		const requestUri = new URL(coreOAuthUrl).searchParams.get("request_uri");
		if (!requestUri) {
			this.logger.error("Core OAuth URL carried no request_uri");
			throw new ServiceUnavailableException("Sign-in is not available");
		}

		let pending: Awaited<
			ReturnType<typeof this.nativeAccounts.startSsoRegistration>
		>;
		try {
			pending = await this.nativeAccounts.startSsoRegistration(
				dto.identityToken,
				requestUri,
				"apple",
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			// Already linked is a sign-in, not a failure: send the app to the PDS's
			// own page with a provider hint so it skips the picker.
			if (message.includes("already linked")) {
				const signInUrl = new URL(coreOAuthUrl);
				signInUrl.searchParams.set("sso", "apple");
				return { redirectUrl: signInUrl.toString() };
			}
			this.logger.warn(`Native Apple sign-in rejected: ${message}`);
			throw new BadRequestException("That Apple sign-in could not be verified");
		}

		// A returning user: continue in a browser at the PDS's consent (or TOTP)
		// screen. That screen is the authorization boundary and cannot be skipped.
		if (pending.redirectUrl) {
			return { redirectUrl: pending.redirectUrl };
		}
		if (!pending.token) {
			throw new ServiceUnavailableException("Sign-in is not available");
		}
		if (!pending.email || !pending.emailVerified) {
			throw new BadRequestException(
				"Apple has not verified that email address",
			);
		}

		// Handed to the app's own handle picker: a native client has no cookie
		// jar, so it holds the pending registration and sends it back to register.
		return { pendingToken: pending.token, email: pending.email };
	}

	private readPendingToken(
		req: Request,
		dto?: { pendingToken?: string },
	): string | null {
		return (
			(req.cookies as Record<string, string | undefined>)?.[
				APPLE_PENDING_COOKIE_NAME
			] ??
			dto?.pendingToken ??
			null
		);
	}
}
