import {
	type CanActivate,
	type ExecutionContext,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { extractSessionId } from "./session-id";
import type { AuthenticatedRequest, AuthUser } from "./types";

@Injectable()
export class AuthGuard implements CanActivate {
	constructor(private readonly authService: AuthService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

		// Prefer native Bearer auth, then fall back to the web session cookie.
		const sessionId = extractSessionId(request);

		if (!sessionId) {
			throw new UnauthorizedException("Not authenticated");
		}

		const sessionRecord = await this.authService.getSessionById(sessionId);
		if (!sessionRecord) {
			throw new UnauthorizedException("Session not found or expired");
		}

		// Server-side expiry: reject a session whose absolute lifetime has
		// elapsed, regardless of whether the cookie/Bearer token itself is
		// still being presented. This is what stops a captured token from
		// living forever. Applies to both web (cookie) and mobile (Bearer).
		if (sessionRecord.expiresAt.getTime() <= Date.now()) {
			throw new UnauthorizedException("Session not found or expired");
		}

		// Restore THIS device's session (OAuth or credential), refreshing
		// tokens if needed. Per-device (by row id) so concurrent devices for
		// the same DID don't clobber each other — see AuthService.restoreBySession.
		const session = await this.authService.restoreBySession(sessionRecord);
		if (!session || !session.did) {
			throw new UnauthorizedException("Session not found or expired");
		}

		// Sliding refresh: extend the lifetime on activity (rate-limited
		// inside touchSession so it isn't a DB write on every request).
		await this.authService.touchSession(
			sessionRecord.id,
			sessionRecord.lastUsedAt,
		);

		// Attach user info to request
		const authUser: AuthUser = {
			did: session.did,
			session,
		};
		request.user = authUser;

		return true;
	}
}
