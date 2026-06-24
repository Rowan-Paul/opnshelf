import {
	BadRequestException,
	Body,
	ConflictException,
	Controller,
	ForbiddenException,
	Get,
	HttpCode,
	HttpException,
	HttpStatus,
	Logger,
	Post,
	Query,
	Req,
	Res,
	ServiceUnavailableException,
	UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { IngesterService } from "../ingester/ingester.service";
import { CaptchaService } from "../pds/captcha.service";
import { TranquilAdminService } from "../pds/tranquil-admin.service";
import { UsersService } from "../users/users.service";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { BlueskyProfileStatusDto } from "./dto/bluesky-profile-status.dto";
import { RegisterDto, RegisterResponseDto } from "./dto/register.dto";
import { UserDto } from "./dto/user.dto";
import { VerifyEmailDto, VerifyEmailResponseDto } from "./dto/verify-email.dto";
import type { AuthenticatedRequest } from "./types";

const SESSION_COOKIE_NAME = "session";
const PLATFORM_COOKIE_NAME = "auth_platform";
const TIMEZONE_COOKIE_NAME = "auth_timezone";
type OAuthErrorCode = "handle_required" | "auth_failed" | "callback_failed";
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
	) {}

	/**
	 * Root domain for cookie in production (e.g. opnshelf.xyz) so cookie is sent to apex and all subdomains (api, www, etc.).
	 * Use bare hostname without leading dot for reliable behavior on apex domain.
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
			const authUrl = await this.authService.authorizeWithPds(oauthAppState);
			return res.redirect(authUrl);
		} catch (error) {
			this.logger.error("OAuth PDS signup authorization failed", error);
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
		await this.authService.createCredentialSession({
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

		// Register the new repo with TAP for tracking/backfill (best-effort).
		// markBackfillStart opens the shelf's "syncing your watch history…" window.
		try {
			await this.ingesterService.addRepo(account.did, {
				markBackfillStart: true,
			});
		} catch (error) {
			this.logger.error(`Failed to register ${account.did} with TAP`, error);
		}

		// NB: we do NOT seed the profile/default lists here. The PDS rejects all
		// record writes until the account verifies its email (notification
		// channel), so seeding happens in `verifyEmail` once the code is
		// confirmed. See docs/adr/0004-verify-email-before-seeding-records.md.

		const sessionRecord = await this.authService.getSessionByUserDid(
			account.did,
		);
		if (!sessionRecord) {
			this.logger.error("AuthSession not found after register");
			throw new ServiceUnavailableException("Could not establish session");
		}

		const isProduction =
			this.configService.get<string>("NODE_ENV") === "production";
		const cookieDomain = this.getCookieDomain();
		res.cookie(SESSION_COOKIE_NAME, sessionRecord.id, {
			httpOnly: true,
			secure: isProduction,
			sameSite: "lax",
			maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
			path: "/",
			...(cookieDomain && { domain: cookieDomain }),
		});

		return {
			did: account.did,
			handle: account.handle,
			sessionId: sessionRecord.id,
		};
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
		description: "Search query (handle prefix)",
	})
	@ApiResponse({
		status: 200,
		description: "Array of actor suggestions",
	})
	async suggestions(@Query("q") query: string | undefined) {
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
		const cookieDomain = this.getCookieDomain();
		const cookies = req.cookies as Record<string, string | undefined>;

		try {
			// Parse callback query params
			const params = new URLSearchParams(req.url.split("?")[1] || "");

			const { session, state } = await this.authService.callback(params);
			const statePayload = this.authService.parseOAuthAppState(state);

			// Prefer OAuth state (survives iOS auth sessions), then cookie fallback.
			const timezone = statePayload.timezone || cookies?.[TIMEZONE_COOKIE_NAME];

			// Fetch user profile and upsert in database (timezone only set for new users)
			const profile = await this.authService.fetchProfile(session);
			// OAuth accounts authenticate against their own (external) PDS, which
			// has already verified them upstream — mark them verified and external
			// so they are never caught by the native verify-email gate.
			const { isNewUser } = await this.authService.upsertUser(
				profile,
				timezone,
				{ emailVerified: true, isNativePds: false },
			);

			// Clear timezone cookie after use
			if (timezone) {
				res.clearCookie(TIMEZONE_COOKIE_NAME);
			}

			// Register user's DID with TAP for repo tracking and backfill.
			// markBackfillStart opens the shelf's "syncing your watch history…"
			// window so a freshly-linked account isn't shown an empty shelf while
			// its historical records are still streaming in over the firehose.
			try {
				await this.ingesterService.addRepo(session.did, {
					markBackfillStart: true,
				});
			} catch (tapError) {
				// Log but don't fail login if TAP registration fails
				this.logger.error(
					`Failed to register ${session.did} with TAP`,
					tapError,
				);
			}

			if (isNewUser) {
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

			// Resolve opaque session id (cookie stores this, not DID)
			const sessionRecord = await this.authService.getSessionByUserDid(
				session.did,
			);
			if (!sessionRecord) {
				this.logger.error("AuthSession not found after callback");
				return res.redirect(
					this.resolveErrorRedirect("callback_failed", statePayload.platform),
				);
			}

			// Set session cookie with opaque id (domain set so frontend at opnshelf.xyz receives it)
			res.cookie(SESSION_COOKIE_NAME, sessionRecord.id, {
				httpOnly: true,
				secure: isProduction,
				sameSite: "lax",
				maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
				path: "/",
				...(cookieDomain && { domain: cookieDomain }),
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
			const completeUrl =
				platform === "mobile"
					? `opnshelf://auth/complete?session=${encodeURIComponent(sessionRecord.id)}`
					: new URL("/auth/complete", frontendUrl).toString();

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
			const platform =
				statePayload.platform ||
				(cookies?.[PLATFORM_COOKIE_NAME] === "mobile" ? "mobile" : undefined);
			if (platform === "mobile") {
				return res.redirect(
					this.resolveErrorRedirect("callback_failed", platform),
				);
			}

			return res.redirect(
				this.resolveErrorRedirect("callback_failed", platform),
			);
		}
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
			throw new BadRequestException("User not found");
		}

		return {
			did: user.did,
			handle: user.handle,
			displayName: user.displayName,
			avatar: user.avatar,
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

		return {
			hasBlueskyProfile: await this.authService.hasBlueskyProfile(did),
		};
	}

	/**
	 * Confirm the signup verification code for a native PDS account.
	 *
	 * On success the account is verified (records can be written), so we seed the
	 * profile + default lists that signup deliberately skipped, and mirror the
	 * verified status into our DB.
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

		// Only seed if this verification is the transition from unverified.
		const wasUnverified = user.emailVerifiedAt === null;

		try {
			await this.authService.confirmEmailWithCode(session, dto.code);
		} catch (error) {
			throw this.mapConfirmEmailError(error);
		}

		await this.authService.markEmailVerified(did);

		if (wasUnverified && session) {
			try {
				await this.usersService.initializeProfileForNewUser(
					did,
					session as unknown as { did: string },
					{
						handle: user.handle,
						displayName: user.displayName,
						avatarUrl: null,
					},
				);
			} catch (error) {
				// Verification succeeded; seeding is idempotent and retried lazily
				// on the next profile write, so don't fail the request.
				this.logger.error(`Profile seeding failed for ${did}`, error);
			}
		}

		return { verified: true };
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
		// Reuse the guard's restored session (see verifyEmail) rather than
		// restoring again and racing the refresh token.
		await this.authService.resendEmailConfirmation(req.user.session);
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
	 * Logout - clear session
	 */
	@Post("auth/logout")
	@ApiOperation({ summary: "Logout and clear session" })
	@ApiResponse({ status: 200, description: "Logged out successfully" })
	async logout(@Req() req: AuthenticatedRequest, @Res() res: Response) {
		const cookies = req.cookies as Record<string, string | undefined>;
		const sessionId = cookies?.[SESSION_COOKIE_NAME];

		if (sessionId) {
			await this.authService.revokeBySessionId(sessionId);
		}

		const isProduction =
			this.configService.get<string>("NODE_ENV") === "production";
		const cookieDomain = this.getCookieDomain();

		// Clear the session cookie (same options as set, including domain)
		res.clearCookie(SESSION_COOKIE_NAME, {
			httpOnly: true,
			secure: isProduction,
			sameSite: "lax",
			path: "/",
			...(cookieDomain && { domain: cookieDomain }),
		});

		return res
			.status(HttpStatus.OK)
			.json({ message: "Logged out successfully" });
	}
}
