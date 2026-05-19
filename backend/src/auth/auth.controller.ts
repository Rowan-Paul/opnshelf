import {
	BadRequestException,
	Controller,
	Get,
	HttpStatus,
	Logger,
	Post,
	Query,
	Req,
	Res,
	UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { IngesterService } from "../ingester/ingester.service";
import { UsersService } from "../users/users.service";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { BlueskyProfileStatusDto } from "./dto/bluesky-profile-status.dto";
import { UserDto } from "./dto/user.dto";
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

	constructor(
		private readonly authService: AuthService,
		private readonly configService: ConfigService,
		private readonly ingesterService: IngesterService,
		private readonly usersService: UsersService,
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
		// Redirect to clean login route; frontend will show a friendly toast.
		void errorCode;
		return new URL("/login", frontendUrl).toString();
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
			const { isNewUser } = await this.authService.upsertUser(
				profile,
				timezone,
			);

			// Clear timezone cookie after use
			if (timezone) {
				res.clearCookie(TIMEZONE_COOKIE_NAME);
			}

			// Register user's DID with TAP for repo tracking and backfill
			try {
				await this.ingesterService.addRepo(session.did);
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
