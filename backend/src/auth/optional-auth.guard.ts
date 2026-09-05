import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "./auth.guard";

/**
 * Optionally authenticates the request. If a valid session is present,
 * req.user is populated exactly like AuthGuard. If not, the request
 * is still allowed to proceed with req.user undefined.
 *
 * Only a missing or invalid session downgrades the request to anonymous.
 * Any other failure (database, PDS, programming error) propagates so it
 * surfaces as a 500 instead of silently serving anonymous responses.
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
	constructor(private readonly authGuard: AuthGuard) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		try {
			return await this.authGuard.canActivate(context);
		} catch (error) {
			if (
				error instanceof UnauthorizedException ||
				error instanceof SyntaxError
			) {
				// No valid session — allow the request through without auth
				return true;
			}
			throw error;
		}
	}
}
