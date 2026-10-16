import {
	ForbiddenException,
	Injectable,
	type CanActivate,
	type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedRequest } from "../auth/types";
import type { ContentCategory } from "./content-privacy-coordinator";
@Injectable()
export class ContentPrivacyGuard implements CanActivate {
	constructor(
		private readonly prisma: PrismaService,
		private readonly reflector: Reflector,
	) {}
	async canActivate(context: ExecutionContext) {
		const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
		const did = req.params.userDid;
		if (typeof did !== "string") throw new ForbiddenException();
		if (req.user?.did === did) return true;
		const category = this.reflector.getAllAndOverride<ContentCategory>(
			"privacyCategory",
			[context.getHandler(), context.getClass()],
		);
		if (category !== "library" && category !== "notes")
			throw new ForbiddenException("Unsupported privacy category");
		const state = await this.prisma.privacyScope.findUnique({
			where: { userDid_key: { userDid: did, key: category } },
		});
		if (state && (state.visibility !== "public" || state.targetVisibility))
			throw new ForbiddenException("This data is Private.");
		return true;
	}
}
