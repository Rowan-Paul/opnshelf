import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { AuthGuard } from "./auth.guard";

/**
 * Optionally authenticates the request. If a valid session is present,
 * req.user is populated exactly like AuthGuard. If not, the request
 * is still allowed to proceed with req.user undefined.
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
	constructor(private readonly authGuard: AuthGuard) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		try {
			return await this.authGuard.canActivate(context);
		} catch {
			// No valid session — allow the request through without auth
			return true;
		}
	}
}
