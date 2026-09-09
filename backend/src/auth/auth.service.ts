import { Agent } from "@atproto/api";
import { randomUUID } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { DeviceSessionsService } from "./device-sessions.service";
import type { ActorSuggestionDto } from "./dto/actor-suggestion.dto";
import {
	type OAuthAppState,
	parseOAuthAppState,
	serializeOAuthAppState,
} from "./oauth-app-state";
import { OAuthClientFactory } from "./oauth-client.factory";
import {
	buildOAuthScope,
	includesOAuthCapabilities,
	OAUTH_SCOPE,
	type OAuthIntegration,
	type OAuthScopePreferences,
} from "./oauth-scopes";

const BLUESKY_PUBLIC_API = "https://public.api.bsky.app/xrpc";

/**
 * The OAuth sign-in flow and the User row it produces: starting an
 * authorization, completing the callback, the account-wide permission changes
 * of ADR 0030, and profile lookups against the AT Protocol network.
 *
 * Session storage lives in {@link DeviceSessionsService}; the methods here that
 * other modules call (restore, revoke, isKnownSession, the guard's per-request
 * hooks) delegate to it so AuthService stays the one entry point they inject.
 */
@Injectable()
export class AuthService {
	private readonly logger = new Logger(AuthService.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly configService: ConfigService,
		private readonly oauthClientFactory: OAuthClientFactory,
		private readonly sessions: DeviceSessionsService,
	) {}

	/**
	 * Start the OAuth login flow
	 * @param handle - User's AT Protocol handle (e.g., user.bsky.social)
	 * @returns The authorization URL to redirect the user to
	 */
	async authorize(
		handle: string,
		appState?: OAuthAppState,
		preferences?: OAuthScopePreferences,
	): Promise<string> {
		const client = this.oauthClientFactory.getBaseClient();
		const normalizedHandle = handle.trim().replace(/^@/, "").toLowerCase();
		const knownUser = await this.prisma.user.findUnique({
			where: { handle: normalizedHandle },
			select: {
				did: true,
				handle: true,
				blogIntegrationEnabled: true,
				blueskyCrossPostEnabled: true,
				reviewsMirrorFormat: true,
			},
		});
		const resolvedPreferences = preferences ?? {
			blogEnabled: knownUser?.blogIntegrationEnabled ?? false,
			blueskyEnabled: knownUser?.blueskyCrossPostEnabled ?? false,
			reviewsMirrorFormat: knownUser?.reviewsMirrorFormat,
		};
		const url = await client.authorize(handle, {
			scope: buildOAuthScope(resolvedPreferences),
			state: serializeOAuthAppState({
				...appState,
				requestedPreferences: resolvedPreferences,
				accountDid: knownUser?.did,
				accountHandle: knownUser?.handle ?? normalizedHandle,
			}),
		});
		return url.toString();
	}

	/** Starts an atomic, cumulative account-wide permission replacement. */
	async authorizePermissionChange(
		handle: string,
		integration: OAuthIntegration,
		preferences: OAuthScopePreferences,
		appState?: OAuthAppState,
	): Promise<string> {
		return this.authorize(
			handle,
			{
				...appState,
				permissionChange: integration,
				requestedPreferences: preferences,
			},
			preferences,
		);
	}

	/**
	 * Start the OAuth flow targeting a specific PDS directly.
	 * The PDS's built-in authorization page supports both sign-in and account creation.
	 * @param prompt pass "create" for signup; omit it for sign-in
	 * @param sso optionally send sign-in straight to an enabled SSO provider
	 * @returns The authorization URL to redirect the user to the PDS
	 */
	async authorizeWithPds(
		appState?: OAuthAppState,
		prompt?: "create",
		sso?: "google",
	): Promise<string> {
		const client = this.oauthClientFactory.getBaseClient();
		const pdsUrl = this.configService.get<string>("PDS_URL");
		if (!pdsUrl) {
			throw new Error("PDS_URL not configured");
		}
		const url = await client.authorize(pdsUrl, {
			scope: OAUTH_SCOPE,
			// Without `create` the PDS shows its sign-in page instead of its signup
			// form, which is what a returning user who doesn't know their handle (or
			// who signed up with Google) needs.
			...(prompt && { prompt }),
			state: serializeOAuthAppState(appState),
		});
		if (sso) url.searchParams.set("sso", sso);
		return url.toString();
	}

	/**
	 * Handle the OAuth callback.
	 *
	 * Mints a fresh session slot (the opaque cookie/Bearer value) up front and
	 * completes the flow on a client bound to that slot, so this login writes its
	 * own AuthSession row instead of overwriting any other device's.
	 *
	 * @param params - URL search params from the callback
	 * @returns The restored session, the OAuth app state, and the new session id
	 */
	async callback(params: URLSearchParams) {
		const sessionId = randomUUID();
		const client = this.sessions.getClientForSlot(sessionId);
		const result = await client.callback(params);
		return { ...result, sessionId };
	}

	/** Reject partial grants before replacing an otherwise working session. */
	async assertGrantedScopes(
		session: unknown,
		preferences: OAuthScopePreferences,
	): Promise<void> {
		const candidate = session as {
			getTokenInfo?: (
				refresh?: boolean | "auto",
			) => Promise<{ scope?: string | string[] }>;
		};
		const grantedScope =
			typeof candidate.getTokenInfo === "function"
				? (await candidate.getTokenInfo(false)).scope
				: undefined;
		if (!includesOAuthCapabilities(grantedScope, preferences)) {
			throw new Error(
				"OAuth authorization did not grant every requested permission",
			);
		}
	}

	/** Persist account-wide integration state and revoke superseded devices atomically. */
	async completePermissionChange(
		did: string,
		retainedSessionId: string,
		preferences: OAuthScopePreferences,
	): Promise<void> {
		this.logger.log(
			`Permission change for ${did}: dropping every session except ${retainedSessionId.slice(0, 8)}…`,
		);
		await this.prisma.$transaction(async (tx) => {
			await tx.user.update({
				where: { did },
				data: {
					blogIntegrationEnabled: Boolean(preferences.blogEnabled),
					blueskyCrossPostEnabled: Boolean(preferences.blueskyEnabled),
				},
			});
			await tx.authSession.deleteMany({
				where: { userDid: did, id: { not: retainedSessionId } },
			});
		});
		this.sessions.evictAllExcept(retainedSessionId);
	}

	async disableIntegration(
		did: string,
		integration: OAuthIntegration,
	): Promise<void> {
		// AT Store review access is intentionally session-only. There is no saved
		// integration preference to clear when its one-time consent is declined.
		if (integration === "atstore") return;
		await this.prisma.user.update({
			where: { did },
			data:
				integration === "blog"
					? { blogIntegrationEnabled: false }
					: { blueskyCrossPostEnabled: false },
		});
	}

	parseOAuthAppState(rawState: string | null | undefined): OAuthAppState {
		return parseOAuthAppState(rawState);
	}

	/** See {@link DeviceSessionsService.restore}. */
	async restore(did: string) {
		return this.sessions.restore(did);
	}

	/** See {@link DeviceSessionsService.restoreBySession}. */
	async restoreBySession(record: {
		id: string;
		userDid: string;
		kind: string;
		sessionData: string;
	}) {
		return this.sessions.restoreBySession(record);
	}

	/** See {@link DeviceSessionsService.isKnownSession}. */
	isKnownSession(sessionId: string): boolean {
		return this.sessions.isKnownSession(sessionId);
	}

	/** See {@link DeviceSessionsService.getSessionById}. */
	async getSessionById(sessionId: string) {
		return this.sessions.getSessionById(sessionId);
	}

	/** See {@link DeviceSessionsService.touchSession}. */
	async touchSession(sessionId: string, lastUsedAt: Date): Promise<void> {
		return this.sessions.touchSession(sessionId, lastUsedAt);
	}

	/** See {@link DeviceSessionsService.parseDeviceHeaders}. */
	parseDeviceHeaders(raw: { id?: string; name?: string; platform?: string }) {
		return this.sessions.parseDeviceHeaders(raw);
	}

	/** See {@link DeviceSessionsService.stampDevice}. */
	async stampDevice(params: {
		sessionId: string;
		userDid: string;
		deviceId: string;
		name: string | null;
		platform: string | null;
	}): Promise<void> {
		return this.sessions.stampDevice(params);
	}

	/** See {@link DeviceSessionsService.revoke}. */
	async revoke(did: string): Promise<number> {
		return this.sessions.revoke(did);
	}

	/** See {@link DeviceSessionsService.revokeBySessionId}. */
	async revokeBySessionId(sessionId: string): Promise<number> {
		return this.sessions.revokeBySessionId(sessionId);
	}

	/**
	 * Check whether this DID has an actual Bluesky profile record.
	 * A DID may resolve through Bluesky AppView even when the repo has never
	 * created app.bsky.actor.profile/self, which should not count as linked.
	 */
	async hasBlueskyProfile(
		session:
			| {
					did: string;
			  }
			| null
			| undefined,
	): Promise<boolean> {
		if (!session?.did) {
			return false;
		}
		try {
			const agent = new Agent(
				session as unknown as ConstructorParameters<typeof Agent>[0],
			);
			await agent.com.atproto.repo.getRecord({
				repo: session.did,
				collection: "app.bsky.actor.profile",
				rkey: "self",
			});
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Fetch user profile from AT Protocol
	 * @param session - The OAuth session
	 * @returns User profile data
	 */
	async fetchProfile(session: { did: string }) {
		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);
		const repo = await agent.com.atproto.repo.describeRepo({
			repo: session.did,
		});
		const handle = repo.data.handle;

		let displayName: string | null = null;
		let avatar: string | null = null;

		try {
			// Read the display name and avatar from the public AppView, NOT through
			// the user's OAuth session. A proxied app.bsky.* call that comes back
			// 401 invalid_token (bsky.network does this when the granular scope is
			// missing) makes the OAuth client delete the session it just stored, so
			// the login completes with a cookie whose session row is already gone.
			// This data is public, so an unauthenticated call has nothing to lose.
			const url = new URL(`${BLUESKY_PUBLIC_API}/app.bsky.actor.getProfile`);
			url.searchParams.set("actor", session.did);
			const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
			if (!response.ok) {
				throw new Error(`AppView returned ${response.status}`);
			}
			const profile = (await response.json()) as {
				displayName?: string | null;
				avatar?: string | null;
			};
			displayName = profile.displayName || null;
			avatar = profile.avatar || null;
		} catch (error) {
			this.logger.warn(
				`Failed to fetch app profile for ${session.did}; continuing with repo handle only`,
				error instanceof Error ? error.stack : undefined,
			);
		}

		return {
			did: session.did,
			handle,
			displayName,
			avatar,
		};
	}

	/**
	 * Upsert user in database with profile data
	 * The client supplies an initial IANA timezone for new users. Existing users
	 * keep the timezone they explicitly selected in settings.
	 */
	async upsertUser(
		profile: {
			did: string;
			handle: string;
			displayName: string | null;
			avatar: string | null;
		},
		timezone?: string,
		opts?: { emailVerified?: boolean; isNativePds?: boolean },
	) {
		const existingUser = await this.prisma.user.findUnique({
			where: { did: profile.did },
			select: {
				did: true,
				emailVerifiedAt: true,
				isNativePds: true,
				avatar: true,
			},
		});

		// External-PDS accounts (OAuth login) are already verified upstream, so we
		// mark them verified on creation and never gate them. Native accounts we
		// create on our own PDS start unverified (null) until they confirm.
		const createdEmailVerifiedAt = opts?.emailVerified ? new Date() : null;
		const isNativePds = opts?.isNativePds ?? false;

		// Heal-on-relogin: legacy external rows predate the verified-on-creation
		// logic and are stuck at null. Backfill the timestamp when an external
		// account logs in verified and we don't already have one. Guard on the
		// *existing* row being external so an unverified native account that signs
		// in via OAuth isn't silently un-gated; never clobber an existing stamp.
		const healEmailVerifiedAt =
			opts?.emailVerified &&
			existingUser &&
			existingUser.emailVerifiedAt == null &&
			!existingUser.isNativePds
				? new Date()
				: undefined;

		// Heal-on-relogin: older rows never persisted the avatar, so they're stuck
		// at null. Backfill from the fetched profile when we have one and the row
		// is empty — but never clobber an avatar the user uploaded themselves.
		const healAvatar =
			existingUser && existingUser.avatar == null && profile.avatar
				? profile.avatar
				: undefined;

		try {
			const user = await this.prisma.user.upsert({
				where: { did: profile.did },
				update: {
					handle: profile.handle,
					...(healEmailVerifiedAt
						? { emailVerifiedAt: healEmailVerifiedAt }
						: {}),
					...(healAvatar ? { avatar: healAvatar } : {}),
				},
				create: {
					did: profile.did,
					handle: profile.handle,
					displayName: profile.displayName,
					avatar: profile.avatar,
					timezone: timezone || "UTC",
					emailVerifiedAt: createdEmailVerifiedAt,
					isNativePds,
				},
			});
			return {
				user,
				isNewUser: !existingUser,
			};
		} catch (error) {
			// Handle stale handle collisions (e.g. handle transfer between DIDs).
			if (!this.isHandleUniqueConstraintError(error)) {
				throw error;
			}

			this.logger.warn(
				`Handle collision detected for ${profile.handle}. Reassigning stale owner and retrying.`,
			);

			const user = await this.prisma.$transaction(async (tx) => {
				const existingHandleOwner = await tx.user.findUnique({
					where: { handle: profile.handle },
				});

				if (existingHandleOwner && existingHandleOwner.did !== profile.did) {
					const fallbackHandle = this.buildLegacyHandle(
						existingHandleOwner.did,
					);
					await tx.user.update({
						where: { did: existingHandleOwner.did },
						data: {
							handle: fallbackHandle,
						},
					});
					this.logger.warn(
						`Reassigned stale handle owner ${existingHandleOwner.did} to ${fallbackHandle}`,
					);
				}

				return tx.user.upsert({
					where: { did: profile.did },
					update: {
						handle: profile.handle,
						...(healEmailVerifiedAt
							? { emailVerifiedAt: healEmailVerifiedAt }
							: {}),
					},
					create: {
						did: profile.did,
						handle: profile.handle,
						displayName: profile.displayName,
						timezone: timezone || "UTC",
						emailVerifiedAt: createdEmailVerifiedAt,
						isNativePds,
					},
				});
			});
			return {
				user,
				isNewUser: !existingUser,
			};
		}
	}

	private isHandleUniqueConstraintError(error: unknown): boolean {
		if (
			!error ||
			typeof error !== "object" ||
			!("code" in error) ||
			(error as { code?: unknown }).code !== "P2002"
		) {
			return false;
		}

		const meta = (error as { meta?: unknown }).meta;
		if (!meta || typeof meta !== "object") {
			return false;
		}

		const metaFields = (meta as { target?: unknown; constraint?: unknown })
			.target;
		if (Array.isArray(metaFields)) {
			return metaFields.includes("handle");
		}
		// Prisma 7 / Postgres reports target as the constraint name string
		// (e.g. "User_handle_key"), not a field array.
		if (typeof metaFields === "string") {
			return metaFields.toLowerCase().includes("handle");
		}

		const constraint = (meta as { constraint?: unknown }).constraint;
		if (typeof constraint === "string") {
			return constraint.toLowerCase().includes("handle");
		}
		const constraintFields = (meta as { constraint?: { fields?: unknown } })
			.constraint?.fields;
		if (Array.isArray(constraintFields)) {
			return constraintFields.includes("handle");
		}

		// Prisma's JS driver adapters wrap the database cause one level deeper:
		// meta.driverAdapterError.cause.constraint.fields. This is the production
		// shape emitted by @prisma/adapter-pg for P2002 errors.
		const adapterConstraintFields = (
			meta as {
				driverAdapterError?: {
					cause?: { constraint?: { fields?: unknown } };
				};
			}
		).driverAdapterError?.cause?.constraint?.fields;
		return Array.isArray(adapterConstraintFields)
			? adapterConstraintFields.includes("handle")
			: false;
	}

	private buildLegacyHandle(did: string): string {
		const didSlug = did.toLowerCase().replace(/[^a-z0-9]/g, "-");
		return `legacy-${didSlug}-${Date.now()}`;
	}

	/**
	 * Get user from database by DID
	 */
	async getUser(did: string) {
		return this.prisma.user.findUnique({ where: { did } });
	}

	/** See {@link OAuthClientFactory.getClientMetadata}. */
	getClientMetadata() {
		return this.oauthClientFactory.getClientMetadata();
	}

	/**
	 * Search for actor suggestions by handle prefix
	 * @param query - The search query (handle prefix)
	 * @returns Array of actor suggestions with handle, displayName, and avatar
	 */
	async searchActors(query: string): Promise<ActorSuggestionDto[]> {
		if (!query || query.trim().length < 2) {
			return [];
		}

		try {
			const url = new URL(
				`${BLUESKY_PUBLIC_API}/app.bsky.actor.searchActorsTypeahead`,
			);
			url.searchParams.set("q", query.trim());
			url.searchParams.set("limit", "10");

			const response = await fetch(url.toString(), {
				signal: AbortSignal.timeout(5000),
			});

			if (!response.ok) {
				this.logger.warn(
					`Bluesky API returned ${response.status}: ${response.statusText}`,
				);
				return [];
			}

			const data = (await response.json()) as {
				actors: Array<{
					did: string;
					handle: string;
					displayName?: string | null;
					avatar?: string | null;
				}>;
			};

			return data.actors.map((actor) => ({
				did: actor.did,
				handle: actor.handle,
				displayName: actor.displayName ?? null,
				avatar: actor.avatar ?? null,
			}));
		} catch (error) {
			this.logger.warn(`Failed to search actors: ${error}`);
			return [];
		}
	}
}
