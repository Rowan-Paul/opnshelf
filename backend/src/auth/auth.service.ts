import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NodeOAuthClient,
  NodeSavedSession,
  NodeSavedState,
} from '@atproto/oauth-client-node';
import { Agent } from '@atproto/api';
import { PrismaService } from '../prisma/prisma.service';

export const OAUTH_SCOPE =
  'atproto repo:app.opnshelf.movie rpc:app.bsky.actor.getProfile?aud=did:web:api.bsky.app%23bsky_appview';

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
    const backendUrl =
      this.configService.get<string>('BACKEND_PUBLIC_URL') ||
      'http://127.0.0.1:3001';
    const isLocalhost =
      backendUrl.includes('localhost') || backendUrl.includes('127.0.0.1');
    const port = this.configService.get<number>('PORT') || 3001;

    // For localhost development:
    // - client_id must be http://localhost (no port) with redirect_uri as query param
    // - redirect_uri must use 127.0.0.1 (loopback IP), not localhost
    // For production: use the full URL to our client metadata
    const redirectUri = isLocalhost
      ? `http://127.0.0.1:${port}/auth/callback`
      : `${backendUrl}/auth/callback`;

    const clientId = isLocalhost
      ? `http://localhost?redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(OAUTH_SCOPE)}`
      : `${backendUrl}/.well-known/oauth-client-metadata.json`;

    this.logger.log(`Initializing OAuth client with client_id: ${clientId}`);

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
        clientMetadata: {
          client_id: clientId,
          client_name: 'OpnShelf',
          client_uri: isLocalhost ? `http://127.0.0.1:${port}` : backendUrl,
          redirect_uris: [redirectUri],
          scope: OAUTH_SCOPE,
          grant_types: ['authorization_code', 'refresh_token'],
          response_types: ['code'],
          // For localhost: application_type must be 'native' per AT Protocol spec
          application_type: isLocalhost ? 'native' : 'web',
          token_endpoint_auth_method: 'none', // Public client
          dpop_bound_access_tokens: true,
        },
        stateStore,
        sessionStore,
        // Allow HTTP for localhost development
        allowHttp: isLocalhost,
      });
      this.logger.log('OAuth client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize OAuth client', error);
      throw error;
    }
  }

  getOAuthClient(): NodeOAuthClient {
    if (!this.oauthClient) {
      throw new Error('OAuth client not initialized');
    }
    return this.oauthClient;
  }

  /**
   * Start the OAuth login flow
   * @param handle - User's AT Protocol handle (e.g., user.bsky.social)
   * @returns The authorization URL to redirect the user to
   */
  async authorize(handle: string): Promise<string> {
    const client = this.getOAuthClient();
    const url = await client.authorize(handle, {
      scope: OAUTH_SCOPE,
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
      this.logger.log('Session revoked by id');
    } catch (error) {
      this.logger.error('Failed to revoke session by id', error);
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
    const profile = await agent.getProfile({ actor: session.did });
    return {
      did: session.did,
      handle: profile.data.handle,
      displayName: profile.data.displayName || null,
      avatar: profile.data.avatar || null,
    };
  }

  /**
   * Upsert user in database with profile data
   */
  async upsertUser(profile: {
    did: string;
    handle: string;
    displayName: string | null;
    avatar: string | null;
  }) {
    return this.prisma.user.upsert({
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
      },
    });
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
  getClientMetadata() {
    const backendUrl =
      this.configService.get<string>('BACKEND_PUBLIC_URL') ||
      'http://127.0.0.1:3001';
    const isLocalhost =
      backendUrl.includes('localhost') || backendUrl.includes('127.0.0.1');
    const port = new URL(backendUrl).port || '3001';

    // For localhost, use 127.0.0.1 in redirect_uri
    const redirectUri = isLocalhost
      ? `http://127.0.0.1:${port}/auth/callback`
      : `${backendUrl}/auth/callback`;

    return {
      client_id: `${backendUrl}/.well-known/oauth-client-metadata.json`,
      client_name: 'OpnShelf',
      client_uri: isLocalhost ? `http://127.0.0.1:${port}` : backendUrl,
      redirect_uris: [redirectUri],
      scope: OAUTH_SCOPE,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      application_type: isLocalhost ? 'native' : 'web',
      token_endpoint_auth_method: 'none',
      dpop_bound_access_tokens: true,
    };
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
}
