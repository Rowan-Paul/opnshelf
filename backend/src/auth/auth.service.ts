import {
	Agent,
	AtpAgent,
	type AtpSessionData,
	CredentialSession,
} from "@atproto/api";
import { randomUUID } from "node:crypto";
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
import {
	buildOAuthScope,
	includesOAuthCapabilities,
	type OAuthIntegration,
	type OAuthScopePreferences,
} from "./oauth-scopes";

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

/**
 * Upper bound on the per-device OAuth client cache. Each active device session
 * keeps one NodeOAuthClient alive (own in-memory token cache + refresh lock);
 * past this many, the least-recently-used is evicted and simply rebuilt on its
 * owner's next request.
 * ponytail: plain insertion-order Map eviction; a real LRU only earns its keep if churn shows up in profiling.
 */
const MAX_CACHED_DEVICE_SESSIONS = 1000;

/**
 * Bounds on the client-supplied device headers (ADR-0015). The values reach us
 * from an untrusted client and end up in the DB and in rendered UI, so the id is
 * length-checked and the label is truncated and stripped of control characters.
 */
const DEVICE_ID_MAX = 128;
const DEVICE_NAME_MAX = 64;
const DEVICE_PLATFORMS = ["ios", "android", "web"] as const;

export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

export interface DeviceSummary {
	deviceId: string;
	name: string | null;
	platform: string | null;
	isCurrent: boolean;
	lastUsedAt: Date;
	createdAt: Date;
}

/** Core-only login scope; integrations are requested only when enabled. */
export const OAUTH_SCOPE = buildOAuthScope();
export const DECLARED_OAUTH_SCOPE = buildOAuthScope({
	atStoreReviewEnabled: true,
	blogEnabled: true,
	blueskyEnabled: true,
	reviewsMirrorFormat: "offprint",
});

export interface OAuthAppState {
	platform?: "mobile";
	timezone?: string;
	permissionChange?: OAuthIntegration;
	requestedPreferences?: OAuthScopePreferences;
	accountDid?: string;
	accountHandle?: string;
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

	/**
	 * Shared, DB-backed OAuth *state* store (PKCE verifier + DPoP key for the
	 * login flow). Safe to share across every client instance — keyed by the
	 * random `state` value, not by user.
	 */
	private stateStore: ReturnType<AuthService["buildStateStore"]> | null = null;

	/**
	 * Client used only to *start* the login flow (authorize). It writes no
	 * session, so it carries a session store that refuses writes.
	 */
	private baseClient: NodeOAuthClient | null = null;

	/**
	 * Per-device OAuth clients, keyed by the session slot (AuthSession.id, i.e.
	 * the opaque cookie/Bearer value).
	 *
	 * atproto's NodeOAuthClient caches restored sessions and serialises token
	 * refreshes *per-DID in memory*. A single shared client therefore cannot hold
	 * two independent sessions for the same DID: a second device would collide in
	 * that cache and the two would race each other's single-use refresh token,
	 * revoking one (the "logged out when I sign in elsewhere" bug). One client per
	 * device session keeps each device's token family isolated.
	 */
	private readonly oauthClients = new Map<string, NodeOAuthClient>();

	/**
	 * Live credential session managers, keyed by device session slot.
	 *
	 * CredentialSession.resumeSession() always rotates the refresh token. Rebuilding
	 * one from the request's database snapshot on every request can therefore reuse
	 * a just-rotated token before its asynchronous persistence finishes. Keeping the
	 * live manager per device lets the SDK serialize refreshes and retain the newest
	 * token pair in memory, matching the isolation used for OAuth sessions above.
	 */
	private readonly credentialSessions = new Map<string, CredentialSession>();

	/**
	 * In-flight credential-session restores, keyed by session slot. This closes
	 * the window before a newly restored manager enters credentialSessions, so
	 * concurrent first requests share the same refresh.
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
		// Fail fast at boot if the OAuth config is broken, and pre-build the
		// shared state store + login client.
		this.stateStore = this.buildStateStore();
		try {
			this.baseClient = this.buildClient(this.buildNoopSessionStore());
		} catch (error) {
			this.logger.error("Failed to initialize OAuth client", error);
			throw error;
		}
	}

	/** Prisma-backed OAuth state store (login-flow PKCE/DPoP), shared by all clients. */
	private buildStateStore() {
		return {
			set: async (key: string, state: NodeSavedState) => {
				const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour TTL
				await this.prisma.authState.upsert({
					where: { key },
					update: { stateData: JSON.stringify(state), expiresAt },
					create: { key, stateData: JSON.stringify(state), expiresAt },
				});
			},
			get: async (key: string): Promise<NodeSavedState | undefined> => {
				const record = await this.prisma.authState.findUnique({
					where: { key },
				});
				if (!record) return undefined;
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
	}

	/**
	 * Prisma-backed session store bound to a single device session row (keyed by
	 * `slot` = AuthSession.id). The library always calls these with the account
	 * DID (`sub`); we scope every operation to this one row so two devices for
	 * the same DID never touch each other's tokens.
	 */
	private buildSessionStore(slot: string) {
		return {
			set: async (sub: string, session: NodeSavedSession) => {
				const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
				await this.prisma.authSession.upsert({
					where: { id: slot },
					update: {
						sessionData: JSON.stringify(session),
						// Writing the session (login or token rotation) is fresh
						// activity, so slide the absolute lifetime forward.
						expiresAt,
						lastUsedAt: new Date(),
					},
					create: {
						id: slot,
						userDid: sub,
						sessionData: JSON.stringify(session),
						kind: "oauth",
						expiresAt,
						// Placeholder identity: the client claims the real one via the
						// x-opnshelf-device header on its first request (ADR-0015). A
						// random value keeps the session addressable, and revocable,
						// even if that stamp never arrives.
						deviceId: randomUUID(),
					},
				});
			},
			get: async (sub: string): Promise<NodeSavedSession | undefined> => {
				const record = await this.prisma.authSession.findUnique({
					where: { id: slot },
				});
				// Guard against a slot/DID mismatch (e.g. a recycled cookie value).
				if (!record || record.userDid !== sub) return undefined;
				return JSON.parse(record.sessionData) as NodeSavedSession;
			},
			del: async () => {
				// The OAuth client drops a stored session on several paths (revoked
				// token, failed refresh, 401 invalid_token from a resource server).
				// Losing a session the user is actively using looks like a broken
				// login, so record who asked and why.
				this.logger.warn(
					`OAuth store dropped the session for ${slot.slice(0, 8)}…`,
					new Error("session store del").stack,
				);
				await this.prisma.authSession.deleteMany({ where: { id: slot } });
				this.oauthClients.delete(slot);
			},
		};
	}

	/** Session store for the login-only base client; it must never persist a session. */
	private buildNoopSessionStore() {
		return {
			set: async () => {
				throw new Error("base OAuth client must not store sessions");
			},
			get: async (): Promise<NodeSavedSession | undefined> => undefined,
			del: async () => {},
		};
	}

	private buildClient(
		sessionStore: ReturnType<AuthService["buildSessionStore"]>,
	): NodeOAuthClient {
		if (!this.stateStore) {
			this.stateStore = this.buildStateStore();
		}
		const oauthClientConfig = this.getOAuthClientConfig();
		const clientMetadata = this.buildClientMetadata(
			oauthClientConfig,
			oauthClientConfig.runtimeClientId,
		);
		// Public client (no keyset). client_id is http://localhost (dev) or the
		// URL to our client-metadata.json (prod).
		return new NodeOAuthClient({
			clientMetadata,
			stateStore: this.stateStore,
			sessionStore,
			requestLock: requestLocalLock,
			allowHttp: oauthClientConfig.allowHttp,
		});
	}

	/** Get (or lazily build + cache) the OAuth client bound to one device session. */
	private getClientForSlot(slot: string): NodeOAuthClient {
		const existing = this.oauthClients.get(slot);
		if (existing) {
			// Bump recency for insertion-order eviction.
			this.oauthClients.delete(slot);
			this.oauthClients.set(slot, existing);
			return existing;
		}
		const client = this.buildClient(this.buildSessionStore(slot));
		if (this.oauthClients.size >= MAX_CACHED_DEVICE_SESSIONS) {
			const oldest = this.oauthClients.keys().next().value;
			if (oldest) this.oauthClients.delete(oldest);
		}
		this.oauthClients.set(slot, client);
		return client;
	}

	/** Client for starting the login flow (authorize). Writes no session. */
	private getBaseClient(): NodeOAuthClient {
		if (!this.baseClient) {
			throw new Error("OAuth client not initialized");
		}
		return this.baseClient;
	}

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
		const client = this.getBaseClient();
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
			state: this.serializeOAuthAppState({
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
		const client = this.getBaseClient();
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
			state: this.serializeOAuthAppState(appState),
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
		const client = this.getClientForSlot(sessionId);
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
		for (const [slot] of this.oauthClients) {
			if (slot !== retainedSessionId) this.oauthClients.delete(slot);
		}
		for (const [slot] of this.credentialSessions) {
			if (slot !== retainedSessionId) this.credentialSessions.delete(slot);
		}
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
		if (!rawState) {
			return {};
		}

		try {
			const parsed = JSON.parse(rawState) as {
				platform?: unknown;
				timezone?: unknown;
				permissionChange?: unknown;
				requestedPreferences?: OAuthScopePreferences;
				accountDid?: unknown;
				accountHandle?: unknown;
			};

			const platform = parsed.platform === "mobile" ? "mobile" : undefined;
			const timezone =
				typeof parsed.timezone === "string" && parsed.timezone.trim() !== ""
					? parsed.timezone
					: undefined;

			const permissionChange =
				parsed.permissionChange === "atstore" ||
				parsed.permissionChange === "blog" ||
				parsed.permissionChange === "bluesky"
					? parsed.permissionChange
					: undefined;
			return {
				platform,
				timezone,
				permissionChange,
				requestedPreferences: parsed.requestedPreferences,
				accountDid:
					typeof parsed.accountDid === "string" ? parsed.accountDid : undefined,
				accountHandle:
					typeof parsed.accountHandle === "string"
						? parsed.accountHandle
						: undefined,
			};
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
		// Background work (deletion, imports) acts on the repo, not a specific
		// device — restore the freshest live session for this DID.
		const record = await this.prisma.authSession.findFirst({
			where: { userDid: did, expiresAt: { gt: new Date() } },
			orderBy: { lastUsedAt: "desc" },
		});
		if (!record) return undefined;
		return this.restoreBySession(record);
	}

	/**
	 * Restore the session for a single device, given its AuthSession row.
	 *
	 * This is the per-request path (the guard resolves the row from the cookie /
	 * Bearer token, then restores exactly that device's session). Keyed by the
	 * row's `id` (slot) so each device's OAuth client — and its token family —
	 * stays isolated. See {@link oauthClients}.
	 */
	async restoreBySession(record: {
		id: string;
		userDid: string;
		kind: string;
		sessionData: string;
	}) {
		if (record.kind === "credential") {
			const existing = this.credentialSessions.get(record.id);
			if (existing?.did === record.userDid) {
				// Bump recency for insertion-order eviction.
				this.credentialSessions.delete(record.id);
				this.credentialSessions.set(record.id, existing);
				return existing;
			}
			const inFlight = this.credentialRestoreInFlight.get(record.id);
			if (inFlight) {
				return inFlight;
			}
			const promise = this.restoreCredentialSession(
				record.id,
				record.userDid,
				record.sessionData,
			)
				.then((session) => {
					if (this.credentialSessions.size >= MAX_CACHED_DEVICE_SESSIONS) {
						const oldest = this.credentialSessions.keys().next().value;
						if (oldest) this.credentialSessions.delete(oldest);
					}
					this.credentialSessions.set(record.id, session);
					return session;
				})
				.finally(() => {
					this.credentialRestoreInFlight.delete(record.id);
				});
			this.credentialRestoreInFlight.set(record.id, promise);
			return promise;
		}

		const client = this.getClientForSlot(record.id);
		try {
			return await client.restore(record.userDid);
		} catch (error) {
			// The session id is the bearer credential — never log it.
			this.logger.warn(
				`Failed to restore session for ${record.userDid}`,
				error,
			);
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
	 *
	 * Tranquil exposes this as `com.atproto.server.resendVerification` and does
	 * NOT implement the standard `com.atproto.server.requestEmailConfirmation`.
	 * The endpoint is unauthenticated and keyed by DID — it re-enqueues the same
	 * signup code `createAccount` originally sent — so no session/agent is needed.
	 */
	async resendEmailConfirmation(did: string): Promise<void> {
		const pdsUrl = this.configService.get<string>("PDS_URL");
		if (!pdsUrl) {
			throw new Error("PDS_URL not configured");
		}
		const res = await fetch(
			`${pdsUrl}/xrpc/com.atproto.server.resendVerification`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ did }),
			},
		);
		if (!res.ok) {
			const body = await res.text().catch(() => "");
			throw new Error(`resendVerification failed (${res.status}): ${body}`);
		}
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
	 * Trade a Google `id_token` for a pending PDS registration.
	 *
	 * `POST /oauth/sso/register-token` is our own addition to the Tranquil fork.
	 * The PDS verifies the token against Google's JWKS itself (signature,
	 * audience, issuer, expiry), so opnshelf can never assert an identity it
	 * hasn't proven. The returned token is what `completeSsoRegistration` spends.
	 */
	async startSsoRegistration(idToken: string): Promise<{
		token: string;
		email: string | null;
		emailVerified: boolean;
		providerUsername: string | null;
	}> {
		const data = (await this.pdsSsoPost("register-token", {
			provider: "google",
			id_token: idToken,
		})) as {
			token: string;
			email?: string | null;
			emailVerified?: boolean;
			providerUsername?: string | null;
		};
		return {
			token: data.token,
			email: data.email ?? null,
			emailVerified: data.emailVerified === true,
			providerUsername: data.providerUsername ?? null,
		};
	}

	/**
	 * Spend a pending SSO registration: this is what actually creates the account.
	 *
	 * We deliberately send no `email`. The PDS then falls back to the email the
	 * provider reported, which is the only value its auto-verify check accepts
	 * (it compares character for character). Sending our own copy would risk a
	 * mismatch that drops the user onto an emailed code Tranquil cannot send.
	 *
	 * `accessJwt`/`refreshJwt` come back only when that auto-verify succeeded.
	 */
	async completeSsoRegistration(params: {
		token: string;
		handle: string;
		inviteCode: string;
	}): Promise<{
		did: string;
		handle: string;
		accessJwt: string | null;
		refreshJwt: string | null;
	}> {
		const data = (await this.pdsSsoPost("complete-registration", {
			token: params.token,
			handle: params.handle,
			invite_code: params.inviteCode,
		})) as {
			did: string;
			handle: string;
			accessJwt?: string;
			refreshJwt?: string;
		};
		return {
			did: data.did,
			handle: data.handle,
			accessJwt: data.accessJwt ?? null,
			refreshJwt: data.refreshJwt ?? null,
		};
	}

	/**
	 * POST to one of the PDS's `/oauth/sso/*` endpoints. These are plain JSON
	 * routes, not XRPC, and need no auth — the invite code is the only gate.
	 *
	 * Errors are rethrown in the `{ error, message }` shape the rest of the
	 * signup path already maps to HTTP responses.
	 */
	private async pdsSsoPost(
		path: string,
		body: Record<string, unknown>,
	): Promise<unknown> {
		const pdsUrl = this.configService.get<string>("PDS_URL");
		if (!pdsUrl) {
			throw new Error("PDS_URL not configured");
		}
		const res = await fetch(`${pdsUrl}/oauth/sso/${path}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(30_000),
		});
		const data = await res.json().catch(() => null);
		if (!res.ok) {
			const parsed = (data ?? {}) as { error?: string; message?: string };
			throw {
				status: res.status,
				error: parsed.error ?? "PdsSsoRequestFailed",
				message: parsed.message ?? `sso/${path} failed (${res.status})`,
			};
		}
		return data;
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
	}): Promise<string> {
		const sessionId = randomUUID();
		await this.persistCredentialSession(sessionId, params.did, params.pdsUrl, {
			did: params.did,
			handle: params.handle,
			accessJwt: params.accessJwt,
			refreshJwt: params.refreshJwt,
			active: true,
		});
		return sessionId;
	}

	private async restoreCredentialSession(
		slot: string,
		did: string,
		sessionDataJson: string,
	) {
		const stored = JSON.parse(sessionDataJson) as AtpSessionData & {
			pdsUrl?: string;
		};
		const pdsUrl =
			stored.pdsUrl || this.configService.get<string>("PDS_URL") || "";
		let persistence = Promise.resolve();

		const session = new CredentialSession(
			new URL(pdsUrl),
			undefined,
			(evt, refreshed) => {
				// Persist rotated tokens whenever the agent refreshes them.
				if (refreshed && (evt === "create" || evt === "update")) {
					this.logger.debug(`Credential session ${evt} persisted for ${did}`);
					persistence = persistence.then(() =>
						this.persistCredentialSession(slot, did, pdsUrl, refreshed),
					);
				} else if (evt === "expired") {
					// The refresh token itself is dead (14-day TTL or revoked
					// upstream) — there's nothing left to restore, so drop just this
					// device's session (not every device for the DID).
					this.logger.warn(
						`Credential session expired for ${did}; revoking device session`,
					);
					this.credentialSessions.delete(slot);
					void this.revokeBySessionId(slot);
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
		// The SDK's persistence hook is synchronous, so explicitly wait for the
		// queued database write before exposing the refreshed session to callers.
		await persistence;

		return session;
	}

	private async persistCredentialSession(
		slot: string,
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
			where: { id: slot },
			update: {
				sessionData: data,
				kind: "credential",
				// Persisting credential tokens (signup or refresh) is fresh
				// activity, so slide the absolute lifetime forward.
				expiresAt,
				lastUsedAt: new Date(),
			},
			create: {
				id: slot,
				userDid: did,
				sessionData: data,
				kind: "credential",
				expiresAt,
				// See buildSessionStore: placeholder until the client stamps.
				deviceId: randomUUID(),
			},
		});
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
		} catch {
			this.logger.warn("Failed to touch session");
		}
	}

	/**
	 * Normalise the client-supplied device headers. Returns null when the id is
	 * missing or implausible, which tells the caller not to stamp at all.
	 */
	parseDeviceHeaders(raw: { id?: string; name?: string; platform?: string }): {
		deviceId: string;
		name: string | null;
		platform: string | null;
	} | null {
		const deviceId = raw.id?.trim();
		if (!deviceId || deviceId.length > DEVICE_ID_MAX) {
			return null;
		}
		// The client percent-encodes the label so the header stays ASCII. A
		// malformed value is just a nameless device, never a failed request.
		let decoded: string | undefined;
		try {
			decoded = raw.name ? decodeURIComponent(raw.name) : undefined;
		} catch {
			decoded = undefined;
		}
		// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping them is the point
		const name = decoded?.replace(/[\x00-\x1f\x7f]/g, "").trim();
		const platform = raw.platform?.trim().toLowerCase();
		return {
			deviceId,
			name: name ? name.slice(0, DEVICE_NAME_MAX) : null,
			platform: DEVICE_PLATFORMS.includes(platform as DevicePlatform)
				? (platform as DevicePlatform)
				: null,
		};
	}

	/**
	 * Record which install this session belongs to (ADR-0015) and take the device
	 * over: any *other* session of the same user carrying this deviceId is a
	 * superseded login from the same install, so it is revoked here rather than
	 * left valid for the rest of its 14 days.
	 *
	 * Called by the guard only when the incoming headers differ from what is
	 * stored, so this is one write per session lifetime, not per request.
	 * Best-effort, like touchSession: a failure must never fail a valid request.
	 *
	 * ponytail: the deleteMany IS the one-session-per-(user, device) invariant —
	 * add a partial unique index only if duplicate rows ever show up in practice.
	 */
	async stampDevice(params: {
		sessionId: string;
		userDid: string;
		deviceId: string;
		name: string | null;
		platform: string | null;
	}): Promise<void> {
		try {
			const superseded = await this.prisma.authSession.findMany({
				where: {
					userDid: params.userDid,
					deviceId: params.deviceId,
					id: { not: params.sessionId },
				},
				select: { id: true },
			});
			await this.prisma.$transaction([
				this.prisma.authSession.deleteMany({
					where: { id: { in: superseded.map((row) => row.id) } },
				}),
				this.prisma.authSession.update({
					where: { id: params.sessionId },
					data: {
						deviceId: params.deviceId,
						deviceName: params.name,
						devicePlatform: params.platform,
					},
				}),
			]);
			for (const row of superseded) {
				this.oauthClients.delete(row.id);
				this.credentialSessions.delete(row.id);
			}
		} catch {
			this.logger.warn("Failed to stamp device on session");
		}
	}

	/**
	 * The user's signed-in devices, most recently used first. Never returns
	 * AuthSession.id — that string is the live Bearer token. Expired rows are
	 * filtered out because they linger in the table until the cleanup job runs,
	 * and the guard would reject them anyway.
	 */
	async listDevices(
		userDid: string,
		currentSessionId: string,
	): Promise<DeviceSummary[]> {
		const rows = await this.prisma.authSession.findMany({
			where: { userDid, expiresAt: { gt: new Date() } },
			select: {
				id: true,
				deviceId: true,
				deviceName: true,
				devicePlatform: true,
				lastUsedAt: true,
				createdAt: true,
			},
			orderBy: { lastUsedAt: "desc" },
		});
		return rows.map((row) => ({
			deviceId: row.deviceId,
			name: row.deviceName,
			platform: row.devicePlatform,
			isCurrent: row.id === currentSessionId,
			lastUsedAt: row.lastUsedAt,
			createdAt: row.createdAt,
		}));
	}

	/**
	 * Revoke one device. Scoped by userDid: deviceId arrives from the client, so
	 * on its own it must never be able to reach another user's session.
	 * @returns how many sessions were revoked (0 = not this user's device)
	 */
	async revokeDevice(userDid: string, deviceId: string): Promise<number> {
		return this.revokeWhere({ userDid, deviceId });
	}

	/** Revoke every device except the one making the request. */
	async revokeOtherDevices(
		userDid: string,
		currentSessionId: string,
	): Promise<number> {
		return this.revokeWhere({ userDid, id: { not: currentSessionId } });
	}

	private async revokeWhere(
		where: { userDid: string } & Record<string, unknown>,
	): Promise<number> {
		const doomed = await this.prisma.authSession.findMany({
			where,
			select: { id: true },
		});
		if (doomed.length === 0) return 0;
		const { count } = await this.prisma.authSession.deleteMany({
			where: { id: { in: doomed.map((row) => row.id) } },
		});
		for (const row of doomed) {
			this.oauthClients.delete(row.id);
			this.credentialSessions.delete(row.id);
		}
		return count;
	}

	/**
	 * Revoke ALL of a user's sessions by DID (every device). Used on account
	 * deletion / bulk revoke.
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
			this.oauthClients.delete(sessionId);
			this.credentialSessions.delete(sessionId);
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
		if (appState.permissionChange)
			payload.permissionChange = appState.permissionChange;
		if (appState.requestedPreferences) {
			payload.requestedPreferences = appState.requestedPreferences;
		}
		if (appState.accountDid) payload.accountDid = appState.accountDid;
		if (appState.accountHandle) payload.accountHandle = appState.accountHandle;
		if (
			!payload.platform &&
			!payload.timezone &&
			!payload.permissionChange &&
			!payload.requestedPreferences
		) {
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
			? `http://localhost?redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(DECLARED_OAUTH_SCOPE)}`
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
			client_name: "Opnshelf",
			client_uri: oauthClientConfig.clientUri,
			redirect_uris: [oauthClientConfig.redirectUri],
			scope: DECLARED_OAUTH_SCOPE,
			grant_types: ["authorization_code", "refresh_token"],
			response_types: ["code"],
			application_type: oauthClientConfig.applicationType,
			token_endpoint_auth_method: "none",
			dpop_bound_access_tokens: true,
		};
	}
}
