import {
	Agent,
	AtpAgent,
	type AtpSessionData,
	CredentialSession,
} from "@atproto/api";
import { requestLocalLock } from "@atproto/oauth-client-node";
import {
	NodeOAuthClient,
	type OAuthClientMetadataInput,
	type NodeSavedSession,
	type NodeSavedState,
} from "@atproto/oauth-client-node";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";

const BLUESKY_PUBLIC_API = "https://public.api.bsky.app/xrpc";

/**
 * Absolute session lifetime, aligned with the 14-day session cookie maxAge set
 * in auth.controller.ts. A captured Bearer token or copied cookie value is only
 * valid until this window elapses (sliding: extended on use, see SESSION_SLIDE_MS).
 */
export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

/**
 * Sliding-refresh cadence. On a successful authenticated request the guard
 * extends expiresAt back to now + SESSION_TTL_MS, but only writes to the DB if
 * lastUsedAt is older than this interval — so an active session stays alive
 * without a DB write on every request, and an idle one expires after 14 days.
 */
export const SESSION_SLIDE_MS = 24 * 60 * 60 * 1000; // 1 day

export const OAUTH_SCOPE =
	"atproto repo:xyz.opnshelf.movie repo:xyz.opnshelf.episode repo:xyz.opnshelf.list repo:xyz.opnshelf.list.item repo:xyz.opnshelf.follow repo:xyz.opnshelf.profile repo:xyz.opnshelf.note repo:xyz.opnshelf.review.like repo:xyz.opnshelf.rating repo:site.standard.document repo:site.standard.publication blob:*/* rpc:app.bsky.actor.getProfile?aud=did:web:api.bsky.app%23bsky_appview";

export interface OAuthAppState {
	platform?: "mobile";
	timezone?: string;
}

interface OAuthClientConfig {
	redirectUri: string;
	clientUri: string;
	runtimeClientId: string;
	metadataClientId: string;
	applicationType: "native" | "web";
	allowHttp: boolean;
}

@Injectable()
export class AuthService implements OnModuleInit {
	private readonly logger = new Logger(AuthService.name);
	private oauthClient: NodeOAuthClient | null = null;

	/**
	 * In-flight credential-session restores, keyed by DID. Refresh tokens rotate
	 * (one-time use), so two concurrent requests each building their own
	 * CredentialSession would both try to refresh the same token — one wins, the
	 * other's refresh is rejected. De-duping concurrent restores makes them share
	 * a single refresh. Cleared as soon as the restore settles.
	 */
	private readonly credentialRestoreInFlight = new Map<
		string,
		Promise<CredentialSession>
	>();

	constructor(
		private readonly prisma: PrismaService,
		private readonly configService: ConfigService,
	) {}

	onModuleInit() {
		this.initializeOAuthClient();
	}

	private initializeOAuthClient() {
		const oauthClientConfig = this.getOAuthClientConfig();
		const clientMetadata = this.buildClientMetadata(
			oauthClientConfig,
			oauthClientConfig.runtimeClientId,
		);

		// Create Prisma-backed state store
		const stateStore = {
			set: async (key: string, state: NodeSavedState) => {
				const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour TTL
				await this.prisma.authState.upsert({
					where: { key },
					update: {
						stateData: JSON.stringify(state),
						expiresAt,
					},
					create: {
						key,
						stateData: JSON.stringify(state),
						expiresAt,
					},
				});
			},
			get: async (key: string): Promise<NodeSavedState | undefined> => {
				const record = await this.prisma.authState.findUnique({
					where: { key },
				});
				if (!record) return undefined;
				// Check if expired
				if (record.expiresAt < new Date()) {
					await this.prisma.authState.delete({ where: { key } });
					return undefined;
				}
				return JSON.parse(record.stateData) as NodeSavedState;
			},
			del: async (key: string) => {
				await this.prisma.authState.deleteMany({ where: { key } });
			},
		};

		// Create Prisma-backed session store
		const sessionStore = {
			set: async (sub: string, session: NodeSavedSession) => {
				const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
				await this.prisma.authSession.upsert({
					where: { userDid: sub },
					update: {
						sessionData: JSON.stringify(session),
						// Writing the session (login or token rotation) is fresh
						// activity, so slide the absolute lifetime forward.
						expiresAt,
						lastUsedAt: new Date(),
					},
					create: {
						userDid: sub,
						sessionData: JSON.stringify(session),
						expiresAt,
					},
				});
			},
			get: async (sub: string): Promise<NodeSavedSession | undefined> => {
				const record = await this.prisma.authSession.findUnique({
					where: { userDid: sub },
				});
				if (!record) return undefined;
				return JSON.parse(record.sessionData) as NodeSavedSession;
			},
			del: async (sub: string) => {
				await this.prisma.authSession.deleteMany({ where: { userDid: sub } });
			},
		};

		try {
			// Public client configuration (no keyset for localhost/dev)
			// The client_id is either http://localhost (dev) or the URL to our client-metadata.json (prod)
			this.oauthClient = new NodeOAuthClient({
				clientMetadata,
				stateStore,
				sessionStore,
				requestLock: requestLocalLock,
				// Allow HTTP for localhost development
				allowHttp: oauthClientConfig.allowHttp,
			});
		} catch (error) {
			this.logger.error("Failed to initialize OAuth client", error);
			throw error;
		}
	}

	getOAuthClient(): NodeOAuthClient {
		if (!this.oauthClient) {
			throw new Error("OAuth client not initialized");
		}
		return this.oauthClient;
	}

	/**
	 * Start the OAuth login flow
	 * @param handle - User's AT Protocol handle (e.g., user.bsky.social)
	 * @returns The authorization URL to redirect the user to
	 */
	async authorize(handle: string, appState?: OAuthAppState): Promise<string> {
		const client = this.getOAuthClient();
		const url = await client.authorize(handle, {
			scope: OAUTH_SCOPE,
			state: this.serializeOAuthAppState(appState),
		});
		return url.toString();
	}

	/**
	 * Start the OAuth flow targeting a specific PDS directly.
	 * The PDS's built-in authorization page supports both sign-in and account creation.
	 * @returns The authorization URL to redirect the user to the PDS
	 */
	async authorizeWithPds(appState?: OAuthAppState): Promise<string> {
		const client = this.getOAuthClient();
		const pdsUrl = this.configService.get<string>("PDS_URL");
		if (!pdsUrl) {
			throw new Error("PDS_URL not configured");
		}
		const url = await client.authorize(pdsUrl, {
			scope: OAUTH_SCOPE,
			prompt: "create",
			state: this.serializeOAuthAppState(appState),
		});
		return url.toString();
	}

	/**
	 * Handle the OAuth callback
	 * @param params - URL search params from the callback
	 * @returns The session with the user's DID
	 */
	async callback(params: URLSearchParams) {
		const client = this.getOAuthClient();
		const result = await client.callback(params);
		return result;
	}

	parseOAuthAppState(rawState: string | null | undefined): OAuthAppState {
		if (!rawState) {
			return {};
		}

		try {
			const parsed = JSON.parse(rawState) as {
				platform?: unknown;
				timezone?: unknown;
			};

			const platform = parsed.platform === "mobile" ? "mobile" : undefined;
			const timezone =
				typeof parsed.timezone === "string" && parsed.timezone.trim() !== ""
					? parsed.timezone
					: undefined;

			return { platform, timezone };
		} catch {
			return {};
		}
	}

	/**
	 * Restore a session for a user by DID.
	 *
	 * opnshelf has two kinds of session: OAuth sessions (users who signed in via
	 * an external PDS) and credential sessions (accounts we created directly on
	 * our Tranquil PDS via {@link registerAccount}). Both return an object that
	 * `new Agent(session)` accepts, so every downstream service is agnostic to
	 * which kind a user has.
	 *
	 * @param did - User's DID
	 * @returns The restored session or undefined if not found
	 */
	async restore(did: string) {
		const record = await this.prisma.authSession.findUnique({
			where: { userDid: did },
		});

		if (record?.kind === "credential") {
			const inFlight = this.credentialRestoreInFlight.get(did);
			if (inFlight) {
				return inFlight;
			}
			const promise = this.restoreCredentialSession(
				did,
				record.sessionData,
			).finally(() => {
				this.credentialRestoreInFlight.delete(did);
			});
			this.credentialRestoreInFlight.set(did, promise);
			return promise;
		}

		const client = this.getOAuthClient();
		try {
			const session = await client.restore(did);
			return session;
		} catch (error) {
			this.logger.warn(`Failed to restore session for ${did}`, error);
			return undefined;
		}
	}

	/**
	 * Confirm the signup verification code for a native PDS account.
	 *
	 * The code was emailed by the PDS on `createAccount`. We read the account's
	 * email from its own session (`getSession`), then call
	 * `com.atproto.server.confirmEmail`. Verifying the email satisfies the PDS's
	 * verified-comms-channel gate, after which records can be written.
	 *
	 * Takes the session the request guard already restored rather than restoring
	 * again: a second restore in the same request spins up a competing credential
	 * session that races the guard's on the PDS's single-use refresh token, and
	 * the loser's failure revokes the session — logging the user out mid-verify.
	 *
	 * @returns `true` if the account was just verified (or already verified).
	 * @throws an XRPC error (mapped by the controller) on an invalid/expired code.
	 */
	async confirmEmailWithCode(session: unknown, code: string): Promise<boolean> {
		if (!session) {
			throw new Error("Session not found");
		}
		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		const { data: sessionInfo } = await agent.com.atproto.server.getSession();
		if (!sessionInfo.email) {
			throw new Error("Account has no email to verify");
		}
		if (sessionInfo.emailConfirmed) {
			return true;
		}

		await agent.com.atproto.server.confirmEmail({
			email: sessionInfo.email,
			token: code.trim(),
		});
		return true;
	}

	/**
	 * Ask the PDS to (re)send the signup verification email for this account.
	 */
	async resendEmailConfirmation(session: unknown): Promise<void> {
		if (!session) {
			throw new Error("Session not found");
		}
		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);
		await agent.com.atproto.server.requestEmailConfirmation();
	}

	/**
	 * Mirror the PDS verification status into our DB so `/auth/me` stays a pure
	 * DB read. Idempotent.
	 */
	async markEmailVerified(did: string): Promise<void> {
		await this.prisma.user.update({
			where: { did },
			data: { emailVerifiedAt: new Date() },
		});
	}

	/**
	 * Create an account directly on our Tranquil PDS.
	 *
	 * Requires a valid (single-use) invite code because the PDS runs with
	 * `invite_code_required = true`. Returns the credential tokens for the new
	 * account so the caller can persist a session.
	 */
	async registerAccount(params: {
		handle: string;
		email: string;
		password: string;
		inviteCode: string;
	}): Promise<{
		did: string;
		handle: string;
		accessJwt: string;
		refreshJwt: string;
		pdsUrl: string;
	}> {
		const pdsUrl = this.configService.get<string>("PDS_URL");
		if (!pdsUrl) {
			throw new Error("PDS_URL not configured");
		}

		const agent = new AtpAgent({ service: pdsUrl });
		await agent.createAccount({
			handle: params.handle,
			email: params.email,
			password: params.password,
			inviteCode: params.inviteCode,
		});

		const session = agent.session;
		if (!session) {
			throw new Error("createAccount returned no session");
		}

		return {
			did: session.did,
			handle: session.handle,
			accessJwt: session.accessJwt,
			refreshJwt: session.refreshJwt,
			pdsUrl,
		};
	}

	/**
	 * Persist a credential session (createAccount tokens) so the guard can
	 * resume it on subsequent requests. Stored alongside OAuth sessions in the
	 * same table, discriminated by `kind`.
	 */
	async createCredentialSession(params: {
		did: string;
		handle: string;
		accessJwt: string;
		refreshJwt: string;
		pdsUrl: string;
	}): Promise<void> {
		await this.persistCredentialSession(params.did, params.pdsUrl, {
			did: params.did,
			handle: params.handle,
			accessJwt: params.accessJwt,
			refreshJwt: params.refreshJwt,
			active: true,
		});
	}

	private async restoreCredentialSession(did: string, sessionDataJson: string) {
		const stored = JSON.parse(sessionDataJson) as AtpSessionData & {
			pdsUrl?: string;
		};
		const pdsUrl =
			stored.pdsUrl || this.configService.get<string>("PDS_URL") || "";

		const session = new CredentialSession(
			new URL(pdsUrl),
			undefined,
			(evt, refreshed) => {
				// Persist rotated tokens whenever the agent refreshes them.
				if (refreshed && (evt === "create" || evt === "update")) {
					this.logger.debug(`Credential session ${evt} persisted for ${did}`);
					void this.persistCredentialSession(did, pdsUrl, refreshed);
				} else if (evt === "expired") {
					// The refresh token itself is dead (14-day TTL or revoked
					// upstream) — there's nothing left to restore, so drop it.
					this.logger.warn(`Credential session expired for ${did}; revoking`);
					void this.revoke(did);
				} else if (evt === "create-failed") {
					// A transient refresh failure (e.g. a token-rotation race between
					// concurrent requests). Do NOT destroy the session — the winning
					// request persisted fresh tokens, so the next request retries with
					// them. Destroying here is what logs the user out spuriously.
					this.logger.warn(
						`Credential session refresh failed (transient) for ${did}`,
					);
				}
			},
		);

		await session.resumeSession({
			did: stored.did,
			handle: stored.handle,
			accessJwt: stored.accessJwt,
			refreshJwt: stored.refreshJwt,
			active: stored.active ?? true,
		});

		return session;
	}

	private async persistCredentialSession(
		did: string,
		pdsUrl: string,
		session: AtpSessionData,
	): Promise<void> {
		const data = JSON.stringify({
			did: session.did,
			handle: session.handle,
			accessJwt: session.accessJwt,
			refreshJwt: session.refreshJwt,
			active: session.active ?? true,
			pdsUrl,
		});
		const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
		await this.prisma.authSession.upsert({
			where: { userDid: did },
			update: {
				sessionData: data,
				kind: "credential",
				// Persisting credential tokens (signup or refresh) is fresh
				// activity, so slide the absolute lifetime forward.
				expiresAt,
				lastUsedAt: new Date(),
			},
			create: {
				userDid: did,
				sessionData: data,
				kind: "credential",
				expiresAt,
			},
		});
	}

	/**
	 * Check whether this DID has an actual Bluesky profile record.
	 * A DID may resolve through Bluesky AppView even when the repo has never
	 * created app.bsky.actor.profile/self, which should not count as linked.
	 */
	async hasBlueskyProfile(did: string): Promise<boolean> {
		try {
			const session = await this.getRestoredSessionQuietly(did);
			if (!session) {
				return false;
			}

			const agent = new Agent(
				session as unknown as ConstructorParameters<typeof Agent>[0],
			);
			await agent.com.atproto.repo.getRecord({
				repo: did,
				collection: "app.bsky.actor.profile",
				rkey: "self",
			});
			return true;
		} catch {
			return false;
		}
	}

	private async getRestoredSessionQuietly(did: string) {
		const client = this.getOAuthClient();
		try {
			return await client.restore(did);
		} catch {
			return undefined;
		}
	}

	/**
	 * Get session record by opaque id (cookie value). Used to resolve DID from cookie.
	 */
	async getSessionById(sessionId: string) {
		return this.prisma.authSession.findUnique({
			where: { id: sessionId },
		});
	}

	/**
	 * Slide a session's absolute lifetime forward on activity.
	 *
	 * Called by the guard after a successful authenticated request. To avoid a DB
	 * write on every request we only extend when lastUsedAt is older than
	 * SESSION_SLIDE_MS — so an actively-used session never expires, while an idle
	 * one ages out after SESSION_TTL_MS. Best-effort: failures are swallowed so a
	 * transient DB hiccup never fails an otherwise-valid request.
	 */
	async touchSession(sessionId: string, lastUsedAt: Date): Promise<void> {
		const now = Date.now();
		if (now - lastUsedAt.getTime() < SESSION_SLIDE_MS) {
			return;
		}
		try {
			await this.prisma.authSession.update({
				where: { id: sessionId },
				data: {
					lastUsedAt: new Date(now),
					expiresAt: new Date(now + SESSION_TTL_MS),
				},
			});
		} catch (error) {
			this.logger.warn(`Failed to touch session ${sessionId}`, error);
		}
	}

	/**
	 * Get session record by user DID. Used after OAuth callback to get opaque id for cookie.
	 */
	async getSessionByUserDid(userDid: string) {
		return this.prisma.authSession.findUnique({
			where: { userDid },
		});
	}

	/**
	 * Revoke a user's session by DID (e.g. admin or bulk revoke)
	 * @param did - User's DID
	 */
	async revoke(did: string) {
		try {
			await this.prisma.authSession.deleteMany({ where: { userDid: did } });
		} catch (error) {
			this.logger.error(`Failed to revoke session for ${did}`, error);
		}
	}

	/**
	 * Revoke session by opaque id (cookie value). Used on logout.
	 */
	async revokeBySessionId(sessionId: string) {
		try {
			await this.prisma.authSession.deleteMany({ where: { id: sessionId } });
		} catch (error) {
			this.logger.error("Failed to revoke session by id", error);
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
			// app.bsky.* methods aren't implemented by the PDS itself; route the
			// request through the Bluesky AppView via the atproto-proxy header.
			// The OAuth scope grants rpc:app.bsky.actor.getProfile for this aud.
			const profile = await agent
				.withProxy("bsky_appview", "did:web:api.bsky.app")
				.getProfile({ actor: session.did });
			displayName = profile.data.displayName || null;
			avatar = profile.data.avatar || null;
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
	 * Only sets timezone for new users - existing users keep their settings
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
			select: { did: true, emailVerifiedAt: true, isNativePds: true },
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

		try {
			const user = await this.prisma.user.upsert({
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

	private serializeOAuthAppState(appState?: OAuthAppState): string | undefined {
		if (!appState) {
			return undefined;
		}
		const payload: OAuthAppState = {};
		if (appState.platform === "mobile") {
			payload.platform = "mobile";
		}
		if (appState.timezone && appState.timezone.trim() !== "") {
			payload.timezone = appState.timezone;
		}
		if (!payload.platform && !payload.timezone) {
			return undefined;
		}
		return JSON.stringify(payload);
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

		const constraintFields = (meta as { constraint?: { fields?: unknown } })
			.constraint?.fields;
		return Array.isArray(constraintFields)
			? constraintFields.includes("handle")
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

	/**
	 * Get OAuth client metadata for the well-known endpoint (production use)
	 * For localhost development, the Authorization Server generates virtual metadata
	 */
	getClientMetadata(): OAuthClientMetadataInput {
		const oauthClientConfig = this.getOAuthClientConfig();
		return this.buildClientMetadata(
			oauthClientConfig,
			oauthClientConfig.metadataClientId,
		);
	}

	/**
	 * Clean up expired auth states (can be called periodically)
	 */
	async cleanupExpiredStates() {
		const result = await this.prisma.authState.deleteMany({
			where: {
				expiresAt: { lt: new Date() },
			},
		});
		void result;
	}

	/**
	 * Clean up expired auth sessions (can be called periodically).
	 *
	 * Mirrors {@link cleanupExpiredStates}. The guard already refuses an expired
	 * session, so this is housekeeping to keep the table from accumulating dead
	 * rows; it is not what enforces expiry.
	 */
	async cleanupExpiredSessions() {
		const result = await this.prisma.authSession.deleteMany({
			where: {
				expiresAt: { lt: new Date() },
			},
		});
		void result;
	}

	/**
	 * Search for actor suggestions by handle prefix
	 * @param query - The search query (handle prefix)
	 * @returns Array of actor suggestions with handle, displayName, and avatar
	 */
	async searchActors(query: string): Promise<
		Array<{
			did: string;
			handle: string;
			displayName: string | null;
			avatar: string | null;
		}>
	> {
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

	private getOAuthClientConfig(): OAuthClientConfig {
		const backendUrl =
			this.configService.get<string>("BACKEND_PUBLIC_URL") ||
			"http://127.0.0.1:3001";
		const isLocalhost =
			backendUrl.includes("localhost") || backendUrl.includes("127.0.0.1");
		const configuredPort = this.configService.get<number>("PORT");
		const derivedPort = new URL(backendUrl).port;
		const port = configuredPort || Number(derivedPort || 3001);

		// For localhost development:
		// - client_id must be http://localhost (no port) with redirect_uri as query param
		// - redirect_uri must use 127.0.0.1 (loopback IP), not localhost
		// For production: use the full URL to our client metadata
		const clientUri = isLocalhost ? `http://127.0.0.1:${port}` : backendUrl;
		const redirectUri = `${clientUri}/auth/callback`;
		const metadataClientId = `${backendUrl}/.well-known/oauth-client-metadata.json`;
		const runtimeClientId = isLocalhost
			? `http://localhost?redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(OAUTH_SCOPE)}`
			: metadataClientId;

		return {
			redirectUri,
			clientUri,
			runtimeClientId,
			metadataClientId,
			applicationType: isLocalhost ? "native" : "web",
			allowHttp: isLocalhost,
		};
	}

	private buildClientMetadata(
		oauthClientConfig: OAuthClientConfig,
		clientId: string,
	): OAuthClientMetadataInput {
		return {
			client_id: clientId,
			client_name: "OpnShelf",
			client_uri: oauthClientConfig.clientUri,
			redirect_uris: [oauthClientConfig.redirectUri],
			scope: OAUTH_SCOPE,
			grant_types: ["authorization_code", "refresh_token"],
			response_types: ["code"],
			application_type: oauthClientConfig.applicationType,
			token_endpoint_auth_method: "none",
			dpop_bound_access_tokens: true,
		};
	}
}
