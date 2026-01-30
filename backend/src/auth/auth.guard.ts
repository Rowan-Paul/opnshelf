import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';

const SESSION_COOKIE_NAME = 'session';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Try Bearer token first (for mobile apps), then fall back to cookie (for web)
    const authHeader = request.headers.authorization;
    let sessionId: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      sessionId = authHeader.slice(7);
      this.logger.debug('Using Bearer token for auth');
    } else {
      // Cookie stores opaque session id (not DID)
      sessionId = request.cookies?.[SESSION_COOKIE_NAME];
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
      (request as any).user = {
        did: session.did,
        session,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.debug('Failed to restore session', error);
      throw new UnauthorizedException('Invalid or expired session');
    }
  }
}
