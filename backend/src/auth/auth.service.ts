import { Agent } from "@atproto/api";
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

export const OAUTH_SCOPE =
	"atproto repo:xyz.opnshelf.movie repo:xyz.opnshelf.episode repo:xyz.opnshelf.list repo:xyz.opnshelf.listItem repo:xyz.opnshelf.follow rpc:app.bsky.actor.getProfile?aud=did:web:api.bsky.app%23bsky_appview";

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

		this.logger.log(
			`Initializing OAuth client with client_id: ${clientMetadata.client_id}`,
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
				await this.prisma.authSession.upsert({
					where: { userDid: sub },
					update: {
						sessionData: JSON.stringify(session),
					},
					create: {
						userDid: sub,
						sessionData: JSON.stringify(session),
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
				// Allow HTTP for localhost development
				allowHttp: oauthClientConfig.allowHttp,
			});
			this.logger.log("OAuth client initialized successfully");
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
	 * Restore a session for a user by DID
	 * @param did - User's DID
	 * @returns The restored session or undefined if not found
	 */
	async restore(did: string) {
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
	 * Check whether this DID has an actual Bluesky profile record.
	 * A DID may resolve through Bluesky AppView even when the repo has never
	 * created app.bsky.actor.profile/self, which should not count as linked.
	 */
	async hasBlueskyProfile(did: string): Promise<boolean> {
		const session = await this.restore(did);
		if (!session) {
			return false;
		}

		try {
			const agent = new Agent(
				session as unknown as ConstructorParameters<typeof Agent>[0],
			);
			await agent.com.atproto.repo.getRecord({
				repo: did,
				collection: "app.bsky.actor.profile",
				rkey: "self",
			});
			return true;
		} catch (error) {
			this.logger.warn(
				`Failed to determine Bluesky profile status for ${did}`,
				error instanceof Error ? error.stack : undefined,
			);
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
			this.logger.log(`Session revoked for ${did}`);
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
			this.logger.log("Session revoked by id");
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
			const profile = await agent.getProfile({ actor: session.did });
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
	) {
		try {
			return await this.prisma.user.upsert({
				where: { did: profile.did },
				update: {
					handle: profile.handle,
					displayName: profile.displayName,
					avatar: profile.avatar,
				},
				create: {
					did: profile.did,
					handle: profile.handle,
					displayName: profile.displayName,
					avatar: profile.avatar,
					timezone: timezone || "UTC",
				},
			});
		} catch (error) {
			// Handle stale handle collisions (e.g. handle transfer between DIDs).
			if (!this.isHandleUniqueConstraintError(error)) {
				throw error;
			}

			this.logger.warn(
				`Handle collision detected for ${profile.handle}. Reassigning stale owner and retrying.`,
			);

			return this.prisma.$transaction(async (tx) => {
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
						displayName: profile.displayName,
						avatar: profile.avatar,
					},
					create: {
						did: profile.did,
						handle: profile.handle,
						displayName: profile.displayName,
						avatar: profile.avatar,
						timezone: timezone || "UTC",
					},
				});
			});
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
		if (result.count > 0) {
			this.logger.log(`Cleaned up ${result.count} expired auth states`);
		}
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
