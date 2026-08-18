import { rebaseAvatarUrl } from "../users/avatar-url";
import {
	BadRequestException,
	Body,
	ConflictException,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	HttpCode,
	HttpException,
	HttpStatus,
	Logger,
	NotFoundException,
	Param,
	Post,
	Query,
	Req,
	Res,
	ServiceUnavailableException,
	UnauthorizedException,
	UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { IngesterService } from "../ingester/ingester.service";
import { CaptchaService } from "../pds/captcha.service";
import { GoogleOAuthService } from "../pds/google-oauth.service";
import { TranquilAdminService } from "../pds/tranquil-admin.service";
import { UsersService } from "../users/users.service";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import type { OAuthIntegration, OAuthScopePreferences } from "./oauth-scopes";
import { ActorSuggestionDto } from "./dto/actor-suggestion.dto";
import { BlueskyProfileStatusDto } from "./dto/bluesky-profile-status.dto";
import { DeviceDto, RevokeDevicesResponseDto } from "./dto/device.dto";
import {
	PermissionChangeDto,
	PermissionChangeResponseDto,
} from "./dto/permission-change.dto";
import {
	GoogleRegisterDto,
	GoogleRegisterResponseDto,
} from "./dto/google-register.dto";
import { RegisterDto, RegisterResponseDto } from "./dto/register.dto";
import { UserDto } from "./dto/user.dto";
import { VerifyEmailDto, VerifyEmailResponseDto } from "./dto/verify-email.dto";
import {
	extractSessionId,
	LEGACY_SESSION_COOKIE_NAME,
	SESSION_COOKIE_NAME,
} from "./session-id";
import type { AuthenticatedRequest } from "./types";

const PLATFORM_COOKIE_NAME = "auth_platform";
const TIMEZONE_COOKIE_NAME = "auth_timezone";
/** CSRF state for the Google consent round trip. */
const GOOGLE_STATE_COOKIE_NAME = "google_state";
/** Holds the PDS pending-registration token between Google and the handle picker. */
const GOOGLE_PENDING_COOKIE_NAME = "google_pending";
const GOOGLE_COOKIE_MAX_AGE_MS = 15 * 60 * 1000;
type GoogleSignupError =
	| "google_unavailable"
	| "google_failed"
	| "google_email_unverified";
type OAuthErrorCode =
	| "handle_required"
	| "auth_failed"
	| "callback_failed"
	| "permission_declined";
type AuthPlatform = "mobile" | undefined;

@ApiTags("auth")
@Controller()
export class AuthController {
	private readonly logger = new Logger(AuthController.name);

	/** Per-IP signup attempts, used by a lightweight in-memory rate limiter. */
	private readonly registerAttempts = new Map<string, number[]>();
	private static readonly REGISTER_WINDOW_MS = 60 * 60 * 1000; // 1 hour
	private static readonly REGISTER_MAX_PER_WINDOW = 5;

	/** Per-DID resend attempts for verification emails (in-memory rate limiter). */
	private readonly resendAttempts = new Map<string, number[]>();
	private static readonly RESEND_WINDOW_MS = 60 * 60 * 1000; // 1 hour
	private static readonly RESEND_MAX_PER_WINDOW = 5;

	constructor(
		private readonly authService: AuthService,
		private readonly configService: ConfigService,
		private readonly ingesterService: IngesterService,
		private readonly usersService: UsersService,
		private readonly tranquilAdmin: TranquilAdminService,
		private readonly captcha: CaptchaService,
		private readonly googleOAuth: GoogleOAuthService,
	) {}

	/**
	 * Scope used only to clear session cookies issued before sessions became
	 * host-only. New session cookies must never use this domain.
	 */
	private getCookieDomain(): string | undefined {
		const isProduction =
			this.configService.get<string>("NODE_ENV") === "production";
		if (!isProduction) return undefined;
		const frontendUrl = this.configService.get<string>("FRONTEND_URL") || "";
		try {
			const host = new URL(frontendUrl).hostname;
			if (host && !host.startsWith("localhost") && !host.startsWith("127.")) {
				// Bare domain (e.g. opnshelf.xyz) works for apex + subdomains; leading dot can be unreliable on apex
				return host.startsWith(".") ? host.slice(1) : host;
			}
		} catch {
			// ignore invalid FRONTEND_URL
		}
		return undefined;
	}

	private buildWebErrorUrl(errorCode: OAuthErrorCode): string {
		const frontendUrl =
			this.configService.get<string>("FRONTEND_URL") || "http://127.0.0.1:3000";
		// Pass the error code so the /login route can show a friendly toast.
		const url = new URL("/login", frontendUrl);
		url.searchParams.set("error", errorCode);
		return url.toString();
	}

	/** Bounce back to the signup form with a code it turns into a toast. */
	private buildSignupErrorUrl(errorCode: GoogleSignupError): string {
		const frontendUrl =
			this.configService.get<string>("FRONTEND_URL") || "http://127.0.0.1:3000";
		const url = new URL("/signup", frontendUrl);
		url.searchParams.set("error", errorCode);
		return url.toString();
	}

	private buildMobileErrorUrl(errorCode: OAuthErrorCode): string {
		return `opnshelf://auth/complete?error=${encodeURIComponent(errorCode)}`;
	}

	private resolveErrorRedirect(
		errorCode: OAuthErrorCode,
		platform: AuthPlatform,
	): string {
		if (platform === "mobile") {
			return this.buildMobileErrorUrl(errorCode);
		}
		return this.buildWebErrorUrl(errorCode);
	}

	/**
	 * Client metadata endpoint for AT Protocol OAuth
	 */
	@Get(".well-known/oauth-client-metadata.json")
	@ApiOperation({ summary: "OAuth client metadata" })
	getClientMetadata() {
		return this.authService.getClientMetadata();
	}

	/**
	 * Start OAuth login flow
	 */
	@Get("auth/login")
	@ApiOperation({ summary: "Start AT Protocol OAuth login" })
	@ApiQuery({
		name: "handle",
		required: true,
		description: "User handle (e.g., user.bsky.social or user.custompds.com)",
	})
	@ApiQuery({
		name: "platform",
		required: false,
		description: 'Platform identifier (e.g., "mobile") for redirect handling',
	})
	@ApiQuery({
		name: "timezone",
		required: false,
		description: "User's IANA timezone (e.g., Europe/London)",
	})
	@ApiResponse({ status: 302, description: "Redirect to authorization server" })
	async login(
		@Query("handle") handle: string | undefined,
		@Query("platform") platform: string | undefined,
		@Query("timezone") timezone: string | undefined,
		@Res() res: Response,
	) {
		const mobilePlatform: "mobile" | undefined =
			platform === "mobile" ? "mobile" : undefined;

		// Require handle to be provided
		if (!handle || handle.trim() === "") {
			return res.redirect(
				this.resolveErrorRedirect("handle_required", mobilePlatform),
			);
		}

		const userHandle = handle.trim();
		const oauthAppState = {
			platform: mobilePlatform,
			timezone,
		};

		// Set platform cookie if mobile, so callback knows where to redirect
		if (mobilePlatform) {
			res.cookie(PLATFORM_COOKIE_NAME, "mobile", {
				httpOnly: true,
				maxAge: 5 * 60 * 1000, // 5 minutes
				sameSite: "lax",
			});
		}

		// Store timezone in cookie for use during callback (only for new users)
		if (timezone) {
			res.cookie(TIMEZONE_COOKIE_NAME, timezone, {
				httpOnly: true,
				maxAge: 5 * 60 * 1000, // 5 minutes
				sameSite: "lax",
			});
		}

		try {
			const authUrl = await this.authService.authorize(
				userHandle,
				oauthAppState,
			);
			return res.redirect(authUrl);
		} catch (error) {
			this.logger.error("OAuth authorization failed", error);
			return res.redirect(
				this.resolveErrorRedirect("auth_failed", mobilePlatform),
			);
		}
	}

	/**
	 * Start OAuth signup flow via the configured PDS.
	 * Redirects to the PDS's built-in authorization page which supports account creation.
	 */
	@Get("auth/signup")
	@ApiOperation({ summary: "Start AT Protocol OAuth signup via PDS" })
	@ApiQuery({
		name: "platform",
		required: false,
		description: 'Platform identifier (e.g., "mobile") for redirect handling',
	})
	@ApiQuery({
		name: "timezone",
		required: false,
		description: "User's IANA timezone (e.g., Europe/London)",
	})
	@ApiResponse({
		status: 302,
		description: "Redirect to PDS authorization server",
	})
	async signup(
		@Query("platform") platform: string | undefined,
		@Query("timezone") timezone: string | undefined,
		@Res() res: Response,
	) {
		return this.startPdsAuthorize(platform, timezone, res, "create");
	}

	// NB: there is deliberately no public "sign in via the PDS page" route.
	// Sending an unlinked Google account to that page makes Tranquil turn the
	// sign-in into its own registration, invite-code field and all. Every Google
	// entry point goes through `auth/google/start` instead, and the callback
	// hands an already-linked account on to the PDS sign-in page itself.

	private async startPdsAuthorize(
		platform: string | undefined,
		timezone: string | undefined,
		res: Response,
		prompt: "create" | undefined,
	) {
		const mobilePlatform: "mobile" | undefined =
			platform === "mobile" ? "mobile" : undefined;
		const oauthAppState = {
			platform: mobilePlatform,
			timezone,
		};

		if (mobilePlatform) {
			res.cookie(PLATFORM_COOKIE_NAME, "mobile", {
				httpOnly: true,
				maxAge: 5 * 60 * 1000,
				sameSite: "lax",
			});
		}

		if (timezone) {
			res.cookie(TIMEZONE_COOKIE_NAME, timezone, {
				httpOnly: true,
				maxAge: 5 * 60 * 1000,
				sameSite: "lax",
			});
		}

		try {
			const authUrl = await this.authService.authorizeWithPds(
				oauthAppState,
				prompt,
			);
			return res.redirect(authUrl);
		} catch (error) {
			this.logger.error("OAuth PDS authorization failed", error);
			return res.redirect(
				this.resolveErrorRedirect("auth_failed", mobilePlatform),
			);
		}
	}

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
		const ip = this.getClientIp(req);
		this.enforceRegisterRateLimit(ip);

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
		let account: Awaited<ReturnType<typeof this.authService.registerAccount>>;
		try {
			account = await this.authService.registerAccount({
				handle,
				email: dto.email,
				password: dto.password,
				inviteCode,
			});
		} catch (error) {
			void this.tranquilAdmin
				.disableInviteCodes([inviteCode])
				.catch(() => undefined);
			throw this.mapCreateAccountError(error);
		}

		// Persist a credential session so the guard can resume it.
		const sessionId = await this.authService.createCredentialSession({
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

		const isProduction =
			this.configService.get<string>("NODE_ENV") === "production";
		res.cookie(SESSION_COOKIE_NAME, sessionId, {
			httpOnly: true,
			secure: isProduction,
			sameSite: "lax",
			maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
			path: "/",
		});

		return {
			did: account.did,
			handle: account.handle,
			sessionId,
		};
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
	@ApiOperation({ summary: "Start a Google-backed signup" })
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
	@ApiOperation({ summary: "Google OAuth callback for signup" })
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
			const pending = await this.authService.startSsoRegistration(
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

			const url = new URL("/signup/google", this.getFrontendUrl());
			// Display only. The account is created from the cookie-held token and
			// the email the PDS already has, never from these params.
			url.searchParams.set("email", pending.email);
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
		const ip = this.getClientIp(req);
		this.enforceRegisterRateLimit(ip);

		const human = await this.captcha.verify(dto.captchaToken, ip);
		if (!human) {
			throw new ForbiddenException("Captcha verification failed");
		}

		const cookies = req.cookies as Record<string, string | undefined>;
		const pendingToken = cookies?.[GOOGLE_PENDING_COOKIE_NAME];
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
			ReturnType<typeof this.authService.completeSsoRegistration>
		>;
		try {
			account = await this.authService.completeSsoRegistration({
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
			throw this.mapCreateAccountError(error);
		}

		res.clearCookie(GOOGLE_PENDING_COOKIE_NAME, { path: "/" });

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
			res.cookie(TIMEZONE_COOKIE_NAME, dto.timezone, {
				httpOnly: true,
				maxAge: 5 * 60 * 1000,
				sameSite: "lax",
			});
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
			secure: this.configService.get<string>("NODE_ENV") === "production",
			sameSite: "lax" as const,
			maxAge: GOOGLE_COOKIE_MAX_AGE_MS,
			path: "/",
		};
	}

	private getFrontendUrl(): string {
		return (
			this.configService.get<string>("FRONTEND_URL") || "http://127.0.0.1:3000"
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

	private getClientIp(req: Request): string {
		// With Express "trust proxy" configured (see main.ts), req.ip already
		// resolves to the real client address from X-Forwarded-For. Prefer it;
		// fall back to manual header parsing only if req.ip is unavailable.
		if (req.ip) {
			return req.ip;
		}
		const forwarded = req.headers["x-forwarded-for"];
		if (typeof forwarded === "string" && forwarded.length > 0) {
			return forwarded.split(",")[0].trim();
		}
		if (Array.isArray(forwarded) && forwarded.length > 0) {
			return forwarded[0];
		}
		return "unknown";
	}

	private enforceRegisterRateLimit(ip: string): void {
		const now = Date.now();
		const windowStart = now - AuthController.REGISTER_WINDOW_MS;
		const recent = (this.registerAttempts.get(ip) || []).filter(
			(t) => t > windowStart,
		);
		if (recent.length >= AuthController.REGISTER_MAX_PER_WINDOW) {
			throw new HttpException(
				"Too many signup attempts. Please try again later.",
				HttpStatus.TOO_MANY_REQUESTS,
			);
		}
		recent.push(now);
		this.registerAttempts.set(ip, recent);
	}

	/** Map a PDS createAccount XRPC error to an appropriate HTTP response. */
	private mapCreateAccountError(error: unknown): HttpException {
		const code =
			error && typeof error === "object" && "error" in error
				? String((error as { error?: unknown }).error)
				: undefined;
		const message =
			error && typeof error === "object" && "message" in error
				? String((error as { message?: unknown }).message)
				: "Account creation failed";

		switch (code) {
			case "HandleNotAvailable":
			case "HandleTaken":
			case "AccountAlreadyExists":
				return new ConflictException("That username is already taken");
			case "EmailTaken":
				return new ConflictException("That email is already in use");
			case "InvalidHandle":
				return new BadRequestException("That username is not allowed");
			case "InvalidEmail":
				return new BadRequestException("That email address is invalid");
			case "InvalidInviteCode":
			case "InviteCodeRequired":
				// Our minted code was rejected — that's a server-side problem.
				this.logger.error(`Invite code rejected by PDS: ${message}`);
				return new ServiceUnavailableException(
					"Signup is temporarily unavailable",
				);
			default:
				this.logger.error(`createAccount failed (${code}): ${message}`);
				return new BadRequestException(message);
		}
	}

	/**
	 * Search for actor suggestions by handle prefix
	 */
	@Get("auth/suggestions")
	@ApiOperation({ summary: "Search for actor suggestions by handle prefix" })
	@ApiQuery({
		name: "q",
		required: true,
		type: String,
		description: "Search query (handle prefix)",
	})
	@ApiResponse({
		status: 200,
		description: "Array of actor suggestions",
		type: [ActorSuggestionDto],
	})
	async suggestions(
		@Query("q") query: string | undefined,
	): Promise<ActorSuggestionDto[]> {
		if (!query || query.trim().length < 2) {
			return [];
		}
		return this.authService.searchActors(query);
	}

	/**
	 * OAuth callback handler
	 */
	@Get("auth/callback")
	@ApiOperation({ summary: "AT Protocol OAuth callback" })
	@ApiResponse({
		status: 302,
		description: "Redirect to frontend after authentication",
	})
	async callback(@Req() req: import("express").Request, @Res() res: Response) {
		const frontendUrl =
			this.configService.get<string>("FRONTEND_URL") || "http://127.0.0.1:3000";
		const isProduction =
			this.configService.get<string>("NODE_ENV") === "production";
		const cookies = req.cookies as Record<string, string | undefined>;

		try {
			// Parse callback query params
			const params = new URLSearchParams(req.url.split("?")[1] || "");

			const { session, state, sessionId } =
				await this.authService.callback(params);
			const statePayload = this.authService.parseOAuthAppState(state);
			// Every callback must carry Core plus the complete saved/requested set.
			// A partial grant never replaces a working session.
			try {
				await this.authService.assertGrantedScopes(
					session,
					statePayload.requestedPreferences ?? {},
				);
			} catch (error) {
				await this.authService.revokeBySessionId(sessionId);
				throw error;
			}

			// Prefer OAuth state (survives iOS auth sessions), then cookie fallback.
			const timezone = statePayload.timezone || cookies?.[TIMEZONE_COOKIE_NAME];

			// Fetch user profile and upsert in database (timezone only set for new users)
			const profile = await this.authService.fetchProfile(session);
			// OAuth accounts authenticate against their own (external) PDS, which
			// has already verified them upstream — mark them verified and external
			// so they are never caught by the native verify-email gate.
			const existingUser = await this.authService.getUser(session.did);
			const { isNewUser } = await this.authService.upsertUser(
				profile,
				timezone,
				{
					emailVerified: true,
					isNativePds: existingUser?.isNativePds ?? false,
				},
			);

			if (statePayload.permissionChange && statePayload.requestedPreferences) {
				await this.applyPermissionChange(
					session.did,
					sessionId,
					statePayload.permissionChange,
					statePayload.requestedPreferences,
				);
			}

			// Clear timezone cookie after use
			if (timezone) {
				res.clearCookie(TIMEZONE_COOKIE_NAME);
			}

			// Register user's DID with Tab for repo tracking and backfill.
			// markBackfillStart opens the shelf's "syncing your watch history…"
			// window so a freshly-linked account isn't shown an empty shelf while
			// its historical records are still streaming in over the firehose.
			try {
				await this.ingesterService.addRepo(session.did, {
					markBackfillStart: true,
				});
			} catch (tabError) {
				// Log but don't fail login if Tab registration fails
				this.logger.error(
					`Failed to register ${session.did} with Tab`,
					tabError,
				);
			}

			const persistedUser = await this.authService.getUser(session.did);
			// A native account already has a DB row before it reaches OAuth. Its
			// first scoped callback, not its credential bootstrap, performs seeding.
			if (
				isNewUser ||
				(persistedUser?.isNativePds &&
					persistedUser.emailVerifiedAt &&
					!persistedUser.profileUri)
			) {
				await this.usersService.initializeProfileForNewUser(
					session.did,
					session,
					{
						handle: profile.handle,
						displayName: profile.displayName,
						avatarUrl: profile.avatar,
					},
				);
			}

			// Keep the session cookie host-only to isolate api.opnshelf.xyz from
			// api.staging.opnshelf.xyz. The frontend sends it to the API with
			// credentials: include; it never needs to receive the cookie itself.
			res.cookie(SESSION_COOKIE_NAME, sessionId, {
				httpOnly: true,
				secure: isProduction,
				sameSite: "lax",
				maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
				path: "/",
			});

			// Check if request originated from mobile app (reuse cookies variable)
			const platform =
				statePayload.platform ||
				(cookies?.[PLATFORM_COOKIE_NAME] === "mobile" ? "mobile" : undefined);

			// Clear platform cookie after use
			if (platform) {
				res.clearCookie(PLATFORM_COOKIE_NAME);
			}

			// Redirect to mobile deep link (with session token) or web frontend (uses cookie)
			const permissionQuery =
				statePayload.permissionChange === "atstore"
					? "?permission=atstore"
					: "";
			const completeUrl =
				platform === "mobile"
					? `opnshelf://auth/complete?session=${encodeURIComponent(sessionId)}${permissionQuery ? "&permission=atstore" : ""}`
					: new URL(`/auth/complete${permissionQuery}`, frontendUrl).toString();

			return res.redirect(completeUrl);
		} catch (error) {
			this.logger.error("OAuth callback failed", error);

			const stateFromError =
				typeof error === "object" &&
				error &&
				"state" in error &&
				typeof (error as { state?: unknown }).state === "string"
					? (error as { state: string }).state
					: undefined;
			const statePayload = this.authService.parseOAuthAppState(stateFromError);
			const callbackError = error as {
				params?: { get(name: string): string | null };
			};
			const declined =
				callbackError.params?.get("error") === "access_denied" &&
				Boolean(statePayload.accountDid);
			if (declined && statePayload.accountDid) {
				const declinedConnection =
					statePayload.permissionChange === "atstore"
						? statePayload.requestedPreferences?.atStoreReviewEnabled
						: statePayload.permissionChange === "blog"
							? statePayload.requestedPreferences?.blogEnabled
							: statePayload.permissionChange === "bluesky"
								? statePayload.requestedPreferences?.blueskyEnabled
								: false;
				if (statePayload.permissionChange) {
					if (declinedConnection) {
						await this.authService.disableIntegration(
							statePayload.accountDid,
							statePayload.permissionChange,
						);
					}
				} else if (statePayload.requestedPreferences) {
					// A returning user declined saved optional access. Downscope the
					// account and restart Core-only without touching prior sessions.
					if (statePayload.requestedPreferences.blogEnabled) {
						await this.authService.disableIntegration(
							statePayload.accountDid,
							"blog",
						);
					}
					if (statePayload.requestedPreferences.blueskyEnabled) {
						await this.authService.disableIntegration(
							statePayload.accountDid,
							"bluesky",
						);
					}
					if (statePayload.accountHandle) {
						return res.redirect(
							await this.authService.authorize(statePayload.accountHandle),
						);
					}
				}
			}
			const platform =
				statePayload.platform ||
				(cookies?.[PLATFORM_COOKIE_NAME] === "mobile" ? "mobile" : undefined);
			if (statePayload.permissionChange === "atstore") {
				if (platform === "mobile") {
					return res.redirect(
						`opnshelf://auth/complete?error=${declined ? "permission_declined" : "callback_failed"}&permission=atstore`,
					);
				}
				const dashboardUrl = new URL("/", frontendUrl);
				dashboardUrl.searchParams.set(
					"review",
					declined ? "permission-declined" : "permission-failed",
				);
				return res.redirect(dashboardUrl.toString());
			}
			if (platform === "mobile") {
				return res.redirect(
					this.resolveErrorRedirect(
						declined ? "permission_declined" : "callback_failed",
						platform,
					),
				);
			}

			return res.redirect(
				this.resolveErrorRedirect(
					declined ? "permission_declined" : "callback_failed",
					platform,
				),
			);
		}
	}

	/** Explicitly request (or remove) one external integration's cumulative scope. */
	@Post("auth/permissions")
	@HttpCode(HttpStatus.OK)
	@UseGuards(AuthGuard)
	@ApiOperation({
		summary: "Start an account-wide external integration permission change",
	})
	@ApiResponse({ status: 200, type: PermissionChangeResponseDto })
	async permissions(
		@Req() req: AuthenticatedRequest,
		@Body() dto: PermissionChangeDto,
	): Promise<PermissionChangeResponseDto> {
		const did = req.user?.did;
		if (!did) throw new BadRequestException("User not found in request");
		const { integration, action, platform } = dto;
		const enable = action === "connect";
		const user = await this.authService.getUser(did);
		if (!user) throw new BadRequestException("User not found");
		if (enable && integration === "blog" && !user.reviewsPublicationUri) {
			throw new BadRequestException(
				"Choose a public publication before connecting blog mirroring",
			);
		}
		if (enable && integration === "bluesky") {
			const hasProfile = await this.authService.hasBlueskyProfile(
				req.user.session as { did: string } | undefined,
			);
			if (!hasProfile) {
				throw new BadRequestException(
					"A public Bluesky profile is required before connecting Cross-posts",
				);
			}
		}
		const preferences: OAuthScopePreferences = {
			...(integration === "atstore" ? { atStoreReviewEnabled: enable } : {}),
			blogEnabled:
				integration === "blog" ? enable : user.blogIntegrationEnabled,
			blueskyEnabled:
				integration === "bluesky" ? enable : user.blueskyCrossPostEnabled,
			reviewsMirrorFormat: user.reviewsMirrorFormat,
		};
		const authorizationUrl = platform
			? await this.authService.authorizePermissionChange(
					user.handle,
					integration,
					preferences,
					{ platform },
				)
			: await this.authService.authorizePermissionChange(
					user.handle,
					integration,
					preferences,
				);
		return { authorizationUrl };
	}

	private async applyPermissionChange(
		did: string,
		sessionId: string,
		_integration: OAuthIntegration,
		preferences: OAuthScopePreferences,
	): Promise<void> {
		// A scope replacement is deliberately disruptive: saved settings are
		// account-wide, so every other device must authenticate with this set.
		await this.authService.completePermissionChange(
			did,
			sessionId,
			preferences,
		);
	}

	/**
	 * Get current authenticated user
	 */
	@Get("auth/me")
	@UseGuards(AuthGuard)
	@ApiOperation({ summary: "Get current authenticated user" })
	@ApiResponse({ status: 200, type: UserDto })
	@ApiResponse({ status: 401, description: "Not authenticated" })
	async me(@Req() req: AuthenticatedRequest): Promise<UserDto> {
		const did = req.user?.did;
		if (!did) {
			throw new BadRequestException("User not found in request");
		}

		const user = await this.authService.getUser(did);
		if (!user) {
			// AuthSession has no FK to User, so a session can outlive its user row
			// (account deletion, restored DB). That is an auth failure, not a bad
			// request: 401 is what makes the clients drop the stale session instead
			// of crashing every route on an unexpected 400.
			throw new UnauthorizedException("Not authenticated");
		}

		return {
			did: user.did,
			handle: user.handle,
			displayName: user.displayName,
			avatar: rebaseAvatarUrl(user.avatar),
			onboardingCompletedAt: user.onboardingCompletedAt
				? user.onboardingCompletedAt.toISOString()
				: null,
			needsOnboarding: user.onboardingCompletedAt === null,
			emailVerifiedAt: user.emailVerifiedAt
				? user.emailVerifiedAt.toISOString()
				: null,
			// Only native-PDS accounts must verify; external OAuth accounts are
			// verified upstream and must never be gated, even if the timestamp is
			// null (e.g. legacy rows created before verified-on-creation existed).
			needsEmailVerification: user.isNativePds && user.emailVerifiedAt === null,
			blueskyProfileUrl: user.blueskyProfileUrl ?? null,
			tangledProfileUrl: user.tangledProfileUrl ?? null,
			showBlueskyOnProfile: user.showBlueskyOnProfile,
			showTangledOnProfile: user.showTangledOnProfile,
		};
	}

	/**
	 * Get whether the current authenticated user has a Bluesky profile record.
	 */
	@Get("auth/me/bluesky-profile-status")
	@UseGuards(AuthGuard)
	@ApiOperation({
		summary: "Get current authenticated user's Bluesky profile status",
	})
	@ApiResponse({ status: 200, type: BlueskyProfileStatusDto })
	@ApiResponse({ status: 401, description: "Not authenticated" })
	async blueskyProfileStatus(
		@Req() req: AuthenticatedRequest,
	): Promise<BlueskyProfileStatusDto> {
		const did = req.user?.did;
		if (!did) {
			throw new BadRequestException("User not found in request");
		}

		// Reuse the session the guard already restored for this device rather than
		// restoring again (a second restore races the single-use refresh token).
		return {
			hasBlueskyProfile: await this.authService.hasBlueskyProfile(
				req.user?.session as { did: string } | undefined,
			),
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
	@ApiOperation({ summary: "Confirm the signup email verification code" })
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
			await this.authService.confirmEmailWithCode(session, dto.code);
		} catch (error) {
			throw this.mapConfirmEmailError(error);
		}

		await this.authService.markEmailVerified(did);
		const coreOAuthUrl = await this.authService.authorize(user.handle);
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
	@ApiOperation({ summary: "Resend the signup email verification code" })
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
		this.enforceResendRateLimit(did);
		// Tranquil's resendVerification is unauthenticated and keyed by DID, so
		// no session restore is needed (it re-enqueues the signup code).
		await this.authService.resendEmailConfirmation(did);
		return { message: "Verification email sent" };
	}

	private enforceResendRateLimit(did: string): void {
		const now = Date.now();
		const windowStart = now - AuthController.RESEND_WINDOW_MS;
		const recent = (this.resendAttempts.get(did) || []).filter(
			(t) => t > windowStart,
		);
		if (recent.length >= AuthController.RESEND_MAX_PER_WINDOW) {
			throw new HttpException(
				"Too many resend attempts. Please try again later.",
				HttpStatus.TOO_MANY_REQUESTS,
			);
		}
		recent.push(now);
		this.resendAttempts.set(did, recent);
	}

	/** Map a PDS confirmEmail XRPC error to an appropriate HTTP response. */
	private mapConfirmEmailError(error: unknown): HttpException {
		const code =
			error && typeof error === "object" && "error" in error
				? String((error as { error?: unknown }).error)
				: undefined;
		switch (code) {
			case "ExpiredToken":
				return new BadRequestException(
					"That code has expired. Request a new one.",
				);
			case "InvalidToken":
				return new BadRequestException("That code is invalid.");
			default:
				this.logger.error(`confirmEmail failed (${code})`, error);
				return new BadRequestException(
					"Could not verify that code. Please try again.",
				);
		}
	}

	/**
	 * The user's signed-in devices, most recently used first (ADR-0015).
	 */
	@Get("auth/devices")
	@UseGuards(AuthGuard)
	@ApiOperation({ summary: "List the signed-in devices for this account" })
	@ApiResponse({ status: 200, type: [DeviceDto] })
	async listDevices(@Req() req: AuthenticatedRequest): Promise<DeviceDto[]> {
		const sessionId = extractSessionId(req) ?? "";
		const devices = await this.authService.listDevices(req.user.did, sessionId);
		return devices.map((device) => ({
			...device,
			lastUsedAt: device.lastUsedAt.toISOString(),
			createdAt: device.createdAt.toISOString(),
		}));
	}

	/**
	 * Sign out every device except the one making the request. The current
	 * device keeps its session — settings already has a Sign out button for that.
	 */
	@Delete("auth/devices")
	@UseGuards(AuthGuard)
	@ApiOperation({ summary: "Sign out all other devices" })
	@ApiResponse({ status: 200, type: RevokeDevicesResponseDto })
	async revokeOtherDevices(
		@Req() req: AuthenticatedRequest,
	): Promise<RevokeDevicesResponseDto> {
		const sessionId = extractSessionId(req) ?? "";
		const revoked = await this.authService.revokeOtherDevices(
			req.user.did,
			sessionId,
		);
		return { revoked };
	}

	/**
	 * Sign out one device. deviceId comes from the client, so the revoke is
	 * scoped by DID — an unknown or someone else's device is a 404, never a
	 * successful revoke.
	 */
	@Delete("auth/devices/:deviceId")
	@UseGuards(AuthGuard)
	@ApiOperation({ summary: "Sign out one device" })
	@ApiResponse({ status: 200, type: RevokeDevicesResponseDto })
	async revokeDevice(
		@Req() req: AuthenticatedRequest,
		@Param("deviceId") deviceId: string,
	): Promise<RevokeDevicesResponseDto> {
		const revoked = await this.authService.revokeDevice(req.user.did, deviceId);
		if (revoked === 0) {
			throw new NotFoundException("Device not found");
		}
		return { revoked };
	}

	/**
	 * Logout - clear session
	 */
	@Post("auth/logout")
	@ApiOperation({ summary: "Logout and clear session" })
	@ApiResponse({ status: 200, description: "Logged out successfully" })
	async logout(@Req() req: AuthenticatedRequest, @Res() res: Response) {
		const sessionId = extractSessionId(req);
		const isProduction =
			this.configService.get<string>("NODE_ENV") === "production";
		const cookieDomain = this.getCookieDomain();

		// Clear the current host-only cookie.
		res.clearCookie(SESSION_COOKIE_NAME, {
			httpOnly: true,
			secure: isProduction,
			sameSite: "lax",
			path: "/",
		});
		// Also clear legacy cookies issued by this environment. Staging's legacy
		// domain is staging.opnshelf.xyz, so this does not sign the user out of the
		// production parent-domain session.
		res.clearCookie(LEGACY_SESSION_COOKIE_NAME, {
			httpOnly: true,
			secure: isProduction,
			sameSite: "lax",
			path: "/",
		});
		if (cookieDomain) {
			res.clearCookie(LEGACY_SESSION_COOKIE_NAME, {
				httpOnly: true,
				secure: isProduction,
				sameSite: "lax",
				path: "/",
				domain: cookieDomain,
			});
		}

		if (sessionId) {
			await this.authService.revokeBySessionId(sessionId);
		}

		return res
			.status(HttpStatus.OK)
			.json({ message: "Logged out successfully" });
	}
}
