import {
	type CanActivate,
	type ExecutionContext,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import type { AuthenticatedRequest, AuthUser } from "./types";

const SESSION_COOKIE_NAME = "session";

@Injectable()
export class AuthGuard implements CanActivate {
	constructor(private readonly authService: AuthService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

		// Try Bearer token first (for mobile apps), then fall back to cookie (for web)
		const authHeader = request.headers.authorization;
		let sessionId: string | undefined;

		if (authHeader?.startsWith("Bearer ")) {
			sessionId = authHeader.slice(7);
		} else {
			// Cookie stores opaque session id (not DID)
			const cookies = request.cookies as Record<string, string | undefined>;
			sessionId = cookies?.[SESSION_COOKIE_NAME];
		}

		if (!sessionId) {
			throw new UnauthorizedException("Not authenticated");
		}

		try {
			const sessionRecord = await this.authService.getSessionById(sessionId);
			if (!sessionRecord) {
				throw new UnauthorizedException("Session not found or expired");
			}

			// Restore session (OAuth or credential), refreshing tokens if needed
			const session = await this.authService.restore(sessionRecord.userDid);
			if (!session || !session.did) {
				throw new UnauthorizedException("Session not found or expired");
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
			throw new UnauthorizedException("Invalid or expired session");
		}
	}
}
