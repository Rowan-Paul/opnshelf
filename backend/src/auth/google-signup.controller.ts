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
	Query,
	Req,
	Res,
	ServiceUnavailableException,
	UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { CaptchaService } from "../pds/captcha.service";
import { GoogleOAuthService } from "../pds/google-oauth.service";
import { TranquilAdminService } from "../pds/tranquil-admin.service";
import {
	flowCookieOptions,
	getFrontendUrl,
	isProduction,
	TIMEZONE_COOKIE_NAME,
} from "./auth-flow";
import { AuthService } from "./auth.service";
import {
	GoogleRegisterDto,
	GoogleRegisterResponseDto,
} from "./dto/google-register.dto";
import { NativeAccountService } from "./native-account.service";
import { SignupRateLimiter } from "./signup-rate-limiter";
import { getClientIp, mapCreateAccountError } from "./signup-support";

/** CSRF state for the Google consent round trip. */
const GOOGLE_STATE_COOKIE_NAME = "google_state";
/** Holds the PDS pending-registration token between Google and the handle picker. */
const GOOGLE_PENDING_COOKIE_NAME = "google_pending";
const GOOGLE_COOKIE_MAX_AGE_MS = 15 * 60 * 1000;
type GoogleSignupError =
	| "google_unavailable"
	| "google_failed"
	| "google_email_unverified";

/**
 * "Continue with Google": opnshelf runs the Google round trip itself so it
 * keeps its own signup UI, and the PDS verifies the resulting identity. Routes
 * keep their `AuthController_*` operationIds: the generated client names its
 * functions after them, so moving a route must not rename it.
 */
@ApiTags("auth")
@Controller()
export class GoogleSignupController {
	private readonly logger = new Logger(GoogleSignupController.name);
	private readonly pendingGoogleEmails = new Map<
		string,
		{ email: string; expiresAt: number }
	>();

	constructor(
		private readonly authService: AuthService,
		private readonly nativeAccounts: NativeAccountService,
		private readonly configService: ConfigService,
		private readonly tranquilAdmin: TranquilAdminService,
		private readonly captcha: CaptchaService,
		private readonly googleOAuth: GoogleOAuthService,
		private readonly rateLimiter: SignupRateLimiter,
	) {}

	/** Bounce back to the signup form with a code it turns into a toast. */
	private buildSignupErrorUrl(errorCode: GoogleSignupError): string {
		const url = new URL("/signup", getFrontendUrl(this.configService));
		url.searchParams.set("error", errorCode);
		return url.toString();
	}

	/**
	 * Start "Continue with Google".
	 *
	 * opnshelf runs the Google round trip itself so it keeps its own signup UI;
	 * the PDS's Svelte pages are never involved. Web only on purpose: shipping a
	 * Google button in the iOS app trips App Store guideline 4.8, which needs
	 * Apple SSO alongside it.
	 */
	@Get("auth/google/start")
	@ApiOperation({
		operationId: "AuthController_googleStart",
		summary: "Start a Google-backed signup",
	})
	@ApiResponse({ status: 302, description: "Redirect to Google" })
	googleStart(@Res() res: Response) {
		if (!this.googleOAuth.configured) {
			return res.redirect(this.buildSignupErrorUrl("google_unavailable"));
		}
		// No timezone here: the handle picker posts the browser's timezone with the
		// account details, which is the only place it's read.
		const state = randomUUID();
		res.cookie(GOOGLE_STATE_COOKIE_NAME, state, this.googleCookieOptions());
		return res.redirect(this.googleOAuth.buildAuthUrl(state));
	}

	/**
	 * Google's redirect target. Exchanges the code, has the PDS verify the
	 * resulting `id_token`, and parks the pending-registration token in an
	 * httpOnly cookie so the handle picker can spend it.
	 *
	 * No account exists yet at this point — that happens in `googleRegister`
	 * once the user has picked a handle and cleared the captcha.
	 */
	@Get("auth/google/callback")
	@ApiOperation({
		operationId: "AuthController_googleCallback",
		summary: "Google OAuth callback for signup",
	})
	@ApiResponse({ status: 302, description: "Redirect to the handle picker" })
	async googleCallback(
		@Query("code") code: string | undefined,
		@Query("state") state: string | undefined,
		@Query("error") error: string | undefined,
		@Req() req: Request,
		@Res() res: Response,
	) {
		const cookies = req.cookies as Record<string, string | undefined>;
		const expectedState = cookies?.[GOOGLE_STATE_COOKIE_NAME];
		res.clearCookie(GOOGLE_STATE_COOKIE_NAME, { path: "/" });

		if (error || !code || !state || !expectedState || state !== expectedState) {
			if (error) {
				this.logger.warn(`Google returned an error on callback: ${error}`);
			}
			return res.redirect(this.buildSignupErrorUrl("google_failed"));
		}

		let coreOAuthUrl: string | undefined;
		try {
			const idToken = await this.googleOAuth.exchangeCode(code);
			// Create the Core OAuth request before account creation and bind the
			// verified Google registration to it. Tranquil can then take the newly
			// created account straight to consent without authenticating with Google
			// a second time.
			coreOAuthUrl = await this.authService.authorizeWithPds();
			const requestUri = new URL(coreOAuthUrl).searchParams.get("request_uri");
			if (!requestUri) {
				throw new Error("PDS authorization URL omitted request_uri");
			}
			const pending = await this.nativeAccounts.startSsoRegistration(
				idToken,
				requestUri,
			);
			if (pending.redirectUrl) {
				// Returning account: the verified id_token authenticated it and the PDS
				// already bound its DID to Core OAuth. No second Google round trip.
				return res.redirect(pending.redirectUrl);
			}
			if (!pending.token) {
				throw new Error(
					"PDS returned neither a registration token nor redirect",
				);
			}

			// The PDS only auto-verifies the email channel when Google says the
			// address is verified. Without that the account would be created and
			// then gated behind a code Tranquil currently cannot email, so refuse
			// before anything is created.
			if (!pending.email || !pending.emailVerified) {
				return res.redirect(
					this.buildSignupErrorUrl("google_email_unverified"),
				);
			}

			res.cookie(
				GOOGLE_PENDING_COOKIE_NAME,
				pending.token,
				this.googleCookieOptions(),
			);
			for (const [token, entry] of this.pendingGoogleEmails) {
				if (entry.expiresAt <= Date.now())
					this.pendingGoogleEmails.delete(token);
			}
			this.pendingGoogleEmails.set(pending.token, {
				email: pending.email,
				expiresAt: Date.now() + GOOGLE_COOKIE_MAX_AGE_MS,
			});

			const url = new URL("/signup/google", getFrontendUrl(this.configService));
			const suggested = this.suggestUsername(pending.providerUsername);
			if (suggested) {
				url.searchParams.set("suggested", suggested);
			}
			return res.redirect(url.toString());
		} catch (err) {
			// ponytail: substring match on the PDS message. It is the only way to
			// tell "already has an account" from a bad token, and getting it wrong
			// only costs a returning user a vaguer error.
			const message =
				err && typeof err === "object" && "message" in err
					? String((err as { message?: unknown }).message)
					: "";
			if (message.includes("already linked")) {
				// Not an error: this Google account already has an opnshelf account,
				// so the same button has to sign them in. Only the PDS can mint a
				// session for an existing account, so hand it an explicit Google hint
				// (and no `prompt=create`) to skip the PDS's provider picker.
				//
				// Never send them through the PDS page *before* this check: for an
				// unlinked Google account Tranquil turns a sign-in into its own
				// registration, invite-code field and all (handle_sso_login in
				// sso_endpoints.rs). Going through us first is what avoids that.
				if (!coreOAuthUrl) {
					this.logger.error("Google sign-in handoff had no OAuth request");
					return res.redirect(this.buildSignupErrorUrl("google_failed"));
				}
				const signInUrl = new URL(coreOAuthUrl);
				signInUrl.searchParams.set("sso", "google");
				return res.redirect(signInUrl.toString());
			}
			this.logger.error("Google signup callback failed", err);
			return res.redirect(this.buildSignupErrorUrl("google_failed"));
		}
	}

	@Get("auth/google/pending")
	@ApiOperation({
		operationId: "AuthController_googlePending",
		summary: "Read the pending Google signup identity",
	})
	@ApiResponse({ status: 200, description: "Pending Google signup identity" })
	googlePending(@Req() req: Request): { email: string } {
		const token = this.readPendingToken(req);
		const pending = token ? this.pendingGoogleEmails.get(token) : undefined;
		if (!pending || pending.expiresAt <= Date.now()) {
			if (token) this.pendingGoogleEmails.delete(token);
			throw new UnauthorizedException("Google signup is not pending");
		}
		return { email: pending.email };
	}

	/**
	 * Finish a Google signup: create the account on our PDS and hand straight
	 * into Core OAuth.
	 *
	 * Unlike password signup there is no verification step to wait for — Google
	 * already verified the email — so this skips the bootstrap credential session
	 * entirely and lets the OAuth callback do the Tab registration and seeding.
	 */
	@Post("auth/google/register")
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		operationId: "AuthController_googleRegister",
		summary: "Create an account from a verified Google identity",
	})
	@ApiResponse({ status: HttpStatus.CREATED, type: GoogleRegisterResponseDto })
	@ApiResponse({ status: 400, description: "Google signup was not started" })
	@ApiResponse({ status: 403, description: "Captcha verification failed" })
	@ApiResponse({ status: 409, description: "Username already taken" })
	@ApiResponse({ status: 429, description: "Too many signup attempts" })
	async googleRegister(
		@Body() dto: GoogleRegisterDto,
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	): Promise<GoogleRegisterResponseDto> {
		const ip = getClientIp(req);
		this.rateLimiter.enforceRegisterRateLimit(ip);

		const human = await this.captcha.verify(dto.captchaToken, ip);
		if (!human) {
			throw new ForbiddenException("Captcha verification failed");
		}

		const pendingToken = this.readPendingToken(req);
		if (!pendingToken) {
			throw new BadRequestException(
				"Your Google sign-in expired. Please start again.",
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
			this.logger.error("Failed to mint invite code for Google signup", error);
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
			// sending the user back through Google.
			throw mapCreateAccountError(error, this.logger);
		}

		res.clearCookie(GOOGLE_PENDING_COOKIE_NAME, { path: "/" });
		this.pendingGoogleEmails.delete(pendingToken);

		await this.authService.upsertUser(
			{
				did: account.did,
				handle: account.handle,
				displayName: null,
				avatar: null,
			},
			dto.timezone,
			// Native account on our PDS, but already verified by Google, so it must
			// not be caught by the verify-email gate (see needsEmailVerification).
			{ isNativePds: true, emailVerified: true },
		);

		// The pending registration is already bound to Core OAuth. Preserve the
		// picker timezone through its callback and continue directly to consent.
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

	private googleCookieOptions() {
		return {
			httpOnly: true,
			secure: isProduction(this.configService),
			sameSite: "lax" as const,
			maxAge: GOOGLE_COOKIE_MAX_AGE_MS,
			path: "/",
		};
	}

	private readPendingToken(req: Request): string | null {
		return (
			(req.cookies as Record<string, string | undefined>)?.[
				GOOGLE_PENDING_COOKIE_NAME
			] ?? null
		);
	}

	/** Turn a Google display name into something the username field accepts. */
	private suggestUsername(providerUsername: string | null): string | null {
		if (!providerUsername) return null;
		const slug = providerUsername
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 63)
			.replace(/-+$/g, "");
		return slug.length >= 3 ? slug : null;
	}
}
