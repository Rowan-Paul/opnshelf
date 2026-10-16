import {
	type CanActivate,
	type ExecutionContext,
	ForbiddenException,
	Injectable,
} from "@nestjs/common";
import type { AuthenticatedRequest } from "../auth/types";
import { BackendEnv } from "../config/env.schema";

@Injectable()
export class FeaturedAdminGuard implements CanActivate {
	constructor(private readonly config: BackendEnv) {}
	canEdit(did?: string): boolean {
		return (
			!!this.config.FEATURED_ADMIN_DID && did === this.config.FEATURED_ADMIN_DID
		);
	}
	canActivate(context: ExecutionContext): boolean {
		if (
			!this.canEdit(
				context.switchToHttp().getRequest<AuthenticatedRequest>().user?.did,
			)
		) {
			throw new ForbiddenException(
				"Featured Content editing is restricted to the admin",
			);
		}
		return true;
	}
}
