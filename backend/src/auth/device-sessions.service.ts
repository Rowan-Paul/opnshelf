import { type AtpSessionData, CredentialSession } from "@atproto/api";
import type {
	NodeOAuthClient,
	NodeSavedSession,
	NodeSavedSessionStore,
} from "@atproto/oauth-client-node";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { Prisma } from "../generated/client";
import { PrismaService } from "../prisma/prisma.service";
import { OAuthClientFactory } from "./oauth-client.factory";

/**
 * Absolute session lifetime, aligned with the 14-day session cookie maxAge set
 * in auth-flow.ts. A captured Bearer token or copied cookie value is only
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

/**
 * The per-device session store. Every signed-in Device (ADR-0015) owns one
 * AuthSession row whose opaque id is the cookie/Bearer value, and this service
 * keeps the live session manager for each of those rows: an OAuth client or a
 * credential session, isolated per device so token families never collide.
 */
@Injectable()
export class DeviceSessionsService {
	private readonly logger = new Logger(DeviceSessionsService.name);

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
		private readonly oauthClientFactory: OAuthClientFactory,
	) {}

	/**
	 * Prisma-backed session store bound to a single device session row (keyed by
	 * `slot` = AuthSession.id). The library always calls these with the account
	 * DID (`sub`); we scope every operation to this one row so two devices for
	 * the same DID never touch each other's tokens.
	 */
	private buildSessionStore(slot: string): NodeSavedSessionStore {
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

	/** Get (or lazily build + cache) the OAuth client bound to one device session. */
	getClientForSlot(slot: string): NodeOAuthClient {
		const existing = this.oauthClients.get(slot);
		if (existing) {
			// Bump recency for insertion-order eviction.
			this.oauthClients.delete(slot);
			this.oauthClients.set(slot, existing);
			return existing;
		}
		const client = this.oauthClientFactory.buildClient(
			this.buildSessionStore(slot),
		);
		if (this.oauthClients.size >= MAX_CACHED_DEVICE_SESSIONS) {
			const oldest = this.oauthClients.keys().next().value;
			if (oldest) this.oauthClients.delete(oldest);
		}
		this.oauthClients.set(slot, client);
		return client;
	}

	/**
	 * Restore a session for a user by DID.
	 *
	 * opnshelf has two kinds of session: OAuth sessions (users who signed in via
	 * an external PDS) and credential sessions (accounts we created directly on
	 * our Tranquil PDS via {@link NativeAccountService.registerAccount}). Both
	 * return an object that `new Agent(session)` accepts, so every downstream
	 * service is agnostic to which kind a user has.
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
	 * Whether this session id has a live session manager on this instance: it
	 * was minted by a login or restored by AuthGuard here and has not been
	 * revoked since. Synchronous and database-free on purpose, because the
	 * global throttler asks on every request whether the caller has earned a
	 * per-session bucket. Only a real login can put an id in these maps, so a
	 * stale entry is bounded by the caller's own logins and lives at most until
	 * revocation or LRU eviction.
	 */
	isKnownSession(sessionId: string): boolean {
		return (
			this.oauthClients.has(sessionId) ||
			this.credentialSessions.has(sessionId) ||
			this.credentialRestoreInFlight.has(sessionId)
		);
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
		return this.revokeWhere(
			Prisma.sql`"userDid" = ${userDid} AND "deviceId" = ${deviceId}`,
		);
	}

	/** Revoke every device except the one making the request. */
	async revokeOtherDevices(
		userDid: string,
		currentSessionId: string,
	): Promise<number> {
		return this.revokeWhere(
			Prisma.sql`"userDid" = ${userDid} AND "id" <> ${currentSessionId}`,
		);
	}

	private async revokeWhere(predicate: Prisma.Sql): Promise<number> {
		// PostgreSQL returns exactly the rows deleted by this statement, closing the
		// find-then-delete window where a newly inserted session could survive.
		const doomed = await this.prisma.$queryRaw<
			Array<{ id: string }>
		>(Prisma.sql`
			DELETE FROM "AuthSession"
			WHERE ${predicate}
			RETURNING "id"
		`);
		for (const row of doomed) {
			this.oauthClients.delete(row.id);
			this.credentialSessions.delete(row.id);
		}
		return doomed.length;
	}

	/**
	 * Revoke ALL of a user's sessions by DID (every device). Used on account
	 * deletion / bulk revoke.
	 * @param did - User's DID
	 */
	async revoke(did: string): Promise<number> {
		return this.revokeWhere(Prisma.sql`"userDid" = ${did}`);
	}

	/**
	 * Revoke session by opaque id (cookie value). Used on logout.
	 */
	async revokeBySessionId(sessionId: string): Promise<number> {
		return this.revokeWhere(Prisma.sql`"id" = ${sessionId}`);
	}

	/**
	 * Drop every live session manager except one. The caller has already deleted
	 * the matching AuthSession rows (a permission change replaces every other
	 * device's session); this keeps the in-memory maps from serving a token
	 * family whose row is gone.
	 */
	evictAllExcept(retainedSessionId: string): void {
		for (const [slot] of this.oauthClients) {
			if (slot !== retainedSessionId) this.oauthClients.delete(slot);
		}
		for (const [slot] of this.credentialSessions) {
			if (slot !== retainedSessionId) this.credentialSessions.delete(slot);
		}
	}

	/**
	 * Clean up expired auth sessions (can be called periodically).
	 *
	 * Mirrors {@link OAuthClientFactory.cleanupExpiredStates}. The guard already
	 * refuses an expired session, so this is housekeeping to keep the table from
	 * accumulating dead rows; it is not what enforces expiry.
	 */
	async cleanupExpiredSessions() {
		const result = await this.prisma.authSession.deleteMany({
			where: {
				expiresAt: { lt: new Date() },
			},
		});
		void result;
	}
}
