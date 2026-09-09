import { rebaseAvatarUrl } from "../users/avatar-url";
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
	UnauthorizedException,
	UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { IngesterService } from "../ingester/ingester.service";
import { UsersService } from "../users/users.service";
import {
	type AuthPlatform,
	flowCookieOptions,
	getCookieDomain,
	getFrontendUrl,
	isProduction,
	type OAuthErrorCode,
	PLATFORM_COOKIE_NAME,
	resolveErrorRedirect,
	sessionCookieOptions,
	TIMEZONE_COOKIE_NAME,
} from "./auth-flow";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { ActorSuggestionDto } from "./dto/actor-suggestion.dto";
import { BlueskyProfileStatusDto } from "./dto/bluesky-profile-status.dto";
import { UserDto } from "./dto/user.dto";
import { MobileHandoffService } from "./mobile-handoff.service";
import { isValidCodeChallenge } from "./oauth-app-state";
import type { OAuthIntegration, OAuthScopePreferences } from "./oauth-scopes";
import {
	extractSessionId,
	LEGACY_SESSION_COOKIE_NAME,
	SESSION_COOKIE_NAME,
} from "./session-id";
import type { AuthenticatedRequest } from "./types";

/**
 * The OAuth sign-in surface: starting a login or PDS signup, the callback that
 * mints the session, the signed-in user, and logout. Native-account signup,
 * Google signup, permission changes, the Mobile Handoff Code exchange and
 * Devices each have their own controller in this directory.
 */
@ApiTags("auth")
@Controller()
export class AuthController {
	private readonly logger = new Logger(AuthController.name);

	constructor(
		private readonly authService: AuthService,
		private readonly configService: ConfigService,
		private readonly ingesterService: IngesterService,
		private readonly usersService: UsersService,
		private readonly mobileHandoff: MobileHandoffService,
	) {}

	/**
	 * The `opnshelf://` scheme can be claimed by any installed app, so the link
	 * carries a single-use Mobile Handoff Code (ADR 0026) that only the app
	 * holding the matching verifier can redeem via POST /auth/mobile/exchange.
	 */
	private buildMobileCompleteUrl(
		sessionId: string,
		codeChallenge: string | undefined,
		permission: "atstore" | undefined,
	): string {
		const url = new URL("opnshelf://auth/complete");
		if (codeChallenge) {
			url.searchParams.set(
				"code",
				this.mobileHandoff.issueMobileHandoffCode(sessionId, codeChallenge),
			);
		} else {
			// Deprecated: app builds that started the flow without a code_challenge
			// still expect the session id itself. Remove once every client sends
			// a challenge.
			url.searchParams.set("session", sessionId);
		}
		if (permission) url.searchParams.set("permission", permission);
		return url.toString();
	}

	private resolveErrorRedirect(
		errorCode: OAuthErrorCode,
		platform: AuthPlatform,
	): string {
		return resolveErrorRedirect(
			getFrontendUrl(this.configService),
			errorCode,
			platform,
		);
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
	@ApiQuery({
		name: "code_challenge",
		required: false,
		description:
			"S256 challenge from POST /auth/mobile/challenge. Mobile only: the callback then hands the app a single-use code instead of the session id.",
	})
	@ApiResponse({ status: 302, description: "Redirect to authorization server" })
	async login(
		@Query("handle") handle: string | undefined,
		@Query("platform") platform: string | undefined,
		@Query("timezone") timezone: string | undefined,
		@Query("code_challenge") codeChallenge: string | undefined,
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
		if (codeChallenge !== undefined && !isValidCodeChallenge(codeChallenge)) {
			return res.redirect(
				this.resolveErrorRedirect("auth_failed", mobilePlatform),
			);
		}

		const userHandle = handle.trim();
		const oauthAppState = {
			platform: mobilePlatform,
			timezone,
			codeChallenge,
		};

		// Set platform cookie if mobile, so callback knows where to redirect
		if (mobilePlatform) {
			res.cookie(
				PLATFORM_COOKIE_NAME,
				"mobile",
				flowCookieOptions(this.configService),
			);
		}

		// Store timezone in cookie for use during callback (only for new users)
		if (timezone) {
			res.cookie(
				TIMEZONE_COOKIE_NAME,
				timezone,
				flowCookieOptions(this.configService),
			);
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
	@ApiQuery({
		name: "code_challenge",
		required: false,
		description:
			"S256 challenge from POST /auth/mobile/challenge. Mobile only: the callback then hands the app a single-use code instead of the session id.",
	})
	@ApiResponse({
		status: 302,
		description: "Redirect to PDS authorization server",
	})
	async signup(
		@Query("platform") platform: string | undefined,
		@Query("timezone") timezone: string | undefined,
		@Query("code_challenge") codeChallenge: string | undefined,
		@Res() res: Response,
	) {
		return this.startPdsAuthorize(
			platform,
			timezone,
			codeChallenge,
			res,
			"create",
		);
	}

	// NB: there is deliberately no public "sign in via the PDS page" route.
	// Sending an unlinked Google account to that page makes Tranquil turn the
	// sign-in into its own registration, invite-code field and all. Every Google
	// entry point goes through `auth/google/start` instead, and the callback
	// hands an already-linked account on to the PDS sign-in page itself.

	private async startPdsAuthorize(
		platform: string | undefined,
		timezone: string | undefined,
		codeChallenge: string | undefined,
		res: Response,
		prompt: "create" | undefined,
	) {
		const mobilePlatform: "mobile" | undefined =
			platform === "mobile" ? "mobile" : undefined;
		if (codeChallenge !== undefined && !isValidCodeChallenge(codeChallenge)) {
			return res.redirect(
				this.resolveErrorRedirect("auth_failed", mobilePlatform),
			);
		}
		const oauthAppState = {
			platform: mobilePlatform,
			timezone,
			codeChallenge,
		};

		if (mobilePlatform) {
			res.cookie(
				PLATFORM_COOKIE_NAME,
				"mobile",
				flowCookieOptions(this.configService),
			);
		}

		if (timezone) {
			res.cookie(
				TIMEZONE_COOKIE_NAME,
				timezone,
				flowCookieOptions(this.configService),
			);
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
	async callback(@Req() req: Request, @Res() res: Response) {
		const frontendUrl = getFrontendUrl(this.configService);
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
			res.cookie(
				SESSION_COOKIE_NAME,
				sessionId,
				sessionCookieOptions(this.configService),
			);

			// Check if request originated from mobile app (reuse cookies variable)
			const platform =
				statePayload.platform ||
				(cookies?.[PLATFORM_COOKIE_NAME] === "mobile" ? "mobile" : undefined);

			// Clear platform cookie after use
			if (platform) {
				res.clearCookie(PLATFORM_COOKIE_NAME);
			}

			// Redirect to the mobile deep link or the web frontend (uses cookie).
			const permissionQuery =
				statePayload.permissionChange === "atstore"
					? "?permission=atstore"
					: "";
			const completeUrl =
				platform === "mobile"
					? this.buildMobileCompleteUrl(
							sessionId,
							statePayload.codeChallenge,
							permissionQuery ? "atstore" : undefined,
						)
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
	 * Logout - clear session
	 */
	@Post("auth/logout")
	@ApiOperation({ summary: "Logout and clear session" })
	@ApiResponse({ status: 200, description: "Logged out successfully" })
	async logout(@Req() req: AuthenticatedRequest, @Res() res: Response) {
		const sessionId = extractSessionId(req);
		const production = isProduction(this.configService);
		const cookieDomain = getCookieDomain(this.configService);

		// Clear the current host-only cookie.
		res.clearCookie(SESSION_COOKIE_NAME, {
			httpOnly: true,
			secure: production,
			sameSite: "lax",
			path: "/",
		});
		// Also clear legacy cookies issued by this environment. Staging's legacy
		// domain is staging.opnshelf.xyz, so this does not sign the user out of the
		// production parent-domain session.
		res.clearCookie(LEGACY_SESSION_COOKIE_NAME, {
			httpOnly: true,
			secure: production,
			sameSite: "lax",
			path: "/",
		});
		if (cookieDomain) {
			res.clearCookie(LEGACY_SESSION_COOKIE_NAME, {
				httpOnly: true,
				secure: production,
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
