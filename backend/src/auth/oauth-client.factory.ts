import { requestLocalLock } from "@atproto/oauth-client-node";
import {
	NodeOAuthClient,
	type NodeSavedSession,
	type NodeSavedSessionStore,
	type NodeSavedState,
	type NodeSavedStateStore,
	type OAuthClientMetadataInput,
} from "@atproto/oauth-client-node";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { DECLARED_OAUTH_SCOPE } from "./oauth-scopes";

interface OAuthClientConfig {
	redirectUri: string;
	clientUri: string;
	runtimeClientId: string;
	metadataClientId: string;
	applicationType: "native" | "web";
	allowHttp: boolean;
}

/**
 * Builds the atproto OAuth clients Opnshelf runs as: one login-only base client
 * plus, on demand, one client per device session (see DeviceSessionsService).
 * Owns the client metadata and the shared, DB-backed OAuth *state* store.
 */
@Injectable()
export class OAuthClientFactory implements OnModuleInit {
	private readonly logger = new Logger(OAuthClientFactory.name);

	/**
	 * Shared, DB-backed OAuth *state* store (PKCE verifier + DPoP key for the
	 * login flow). Safe to share across every client instance — keyed by the
	 * random `state` value, not by user.
	 */
	private stateStore: NodeSavedStateStore | null = null;

	/**
	 * Client used only to *start* the login flow (authorize). It writes no
	 * session, so it carries a session store that refuses writes.
	 */
	private baseClient: NodeOAuthClient | null = null;

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
	private buildStateStore(): NodeSavedStateStore {
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

	/** Session store for the login-only base client; it must never persist a session. */
	private buildNoopSessionStore(): NodeSavedSessionStore {
		return {
			set: async () => {
				throw new Error("base OAuth client must not store sessions");
			},
			get: async (): Promise<NodeSavedSession | undefined> => undefined,
			del: async () => {},
		};
	}

	/** Build a client over the given session store, sharing the state store. */
	buildClient(sessionStore: NodeSavedSessionStore): NodeOAuthClient {
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

	/** Client for starting the login flow (authorize). Writes no session. */
	getBaseClient(): NodeOAuthClient {
		if (!this.baseClient) {
			throw new Error("OAuth client not initialized");
		}
		return this.baseClient;
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

	private getOAuthClientConfig(): OAuthClientConfig {
		const backendUrl =
			this.configService.get<string>("BACKEND_PUBLIC_URL") ||
			"http://127.0.0.1:3001";
		const backendHostname = new URL(backendUrl).hostname;
		const isLocalhost =
			backendHostname === "localhost" || backendHostname === "127.0.0.1";
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
