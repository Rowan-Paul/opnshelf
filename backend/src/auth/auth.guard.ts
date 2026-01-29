import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';

const SESSION_COOKIE_NAME = 'opnshelf_session';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Get DID from session cookie
    const did = request.cookies?.[SESSION_COOKIE_NAME];
    
    if (!did) {
      this.logger.debug('No session cookie found');
      throw new UnauthorizedException('Not authenticated');
    }

    try {
      // Try to restore the session using the OAuth client
      // This will also refresh tokens if needed
      const session = await this.authService.restore(did);
      
      if (!session) {
        this.logger.debug(`No session found for DID: ${did}`);
        throw new UnauthorizedException('Session not found or expired');
      }

      // Attach user info to request
      (request as any).user = {
        did: session.did,
        session,
      };

      return true;
    } catch (error) {
      this.logger.debug(`Failed to restore session for DID: ${did}`, error);
      throw new UnauthorizedException('Invalid or expired session');
    }
  }
}
