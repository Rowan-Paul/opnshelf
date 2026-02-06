import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthenticatedRequest, AuthUser } from './types';

const SESSION_COOKIE_NAME = 'session';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Try Bearer token first (for mobile apps), then fall back to cookie (for web)
    const authHeader = request.headers.authorization;
    let sessionId: string | undefined;

    this.logger.debug('[AuthGuard] Checking auth for request');
    this.logger.debug('[AuthGuard] Auth header present:', !!authHeader);
    this.logger.debug(
      '[AuthGuard] Auth header value:',
      authHeader ? `${authHeader.substring(0, 30)}...` : 'none',
    );

    if (authHeader?.startsWith('Bearer ')) {
      sessionId = authHeader.slice(7);
      this.logger.debug('[AuthGuard] Using Bearer token for auth');
      this.logger.debug(
        '[AuthGuard] Session ID from Bearer:',
        sessionId.substring(0, 20) + '...',
      );
    } else {
      // Cookie stores opaque session id (not DID)
      const cookies = request.cookies as Record<string, string | undefined>;
      sessionId = cookies?.[SESSION_COOKIE_NAME];
      this.logger.debug('[AuthGuard] No Bearer token, checking cookies');
      this.logger.debug(
        '[AuthGuard] Session ID from cookie:',
        sessionId?.substring(0, 20) + '...' || 'none',
      );
    }

    if (!sessionId) {
      this.logger.debug('No session cookie or Bearer token found');
      throw new UnauthorizedException('Not authenticated');
    }

    try {
      const sessionRecord = await this.authService.getSessionById(sessionId);
      if (!sessionRecord) {
        this.logger.debug('Session not found for cookie id');
        throw new UnauthorizedException('Session not found or expired');
      }

      // Restore session using OAuth client (refreshes tokens if needed)
      const session = await this.authService.restore(sessionRecord.userDid);
      if (!session) {
        this.logger.debug(`No session found for DID: ${sessionRecord.userDid}`);
        throw new UnauthorizedException('Session not found or expired');
      }

      // Attach user info to request
      const authUser: AuthUser = {
        did: session.did,
        session,
      };
      request.user = authUser;

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.debug('Failed to restore session', error);
      throw new UnauthorizedException('Invalid or expired session');
    }
  }
}
