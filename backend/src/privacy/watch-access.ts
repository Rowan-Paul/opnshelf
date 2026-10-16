import {
	ForbiddenException,
	Injectable,
	type CanActivate,
	type ExecutionContext,
} from "@nestjs/common";
import { Prisma } from "../generated/client";
import { PrismaService } from "../prisma/prisma.service";

/** Apply before pagination, aggregation, and ranking, not after reading a page. */
export const publicWatchOwner = {
	watchVisibility: "public",
	watchPrivacyMigration: { is: null },
} satisfies Prisma.UserWhereInput;

export function publicWatchOwnerSql(owner: Prisma.Sql): Prisma.Sql {
	return Prisma.sql`EXISTS (SELECT 1 FROM "User" wu WHERE wu.did = ${owner}
 AND wu."watchVisibility" = 'public'
 AND NOT EXISTS (SELECT 1 FROM "WatchPrivacyMigration" wm WHERE wm."userDid" = wu.did))`;
}

@Injectable()
export class WatchReadGuard implements CanActivate {
	constructor(private readonly prisma: PrismaService) {}
	async canActivate(context: ExecutionContext) {
		const request = context
			.switchToHttp()
			.getRequest<{ params: { userDid?: string }; user?: { did: string } }>();
		const did = request.params.userDid;
		if (!did) throw new ForbiddenException("Watch owner is required");
		if (request.user?.did === did) return true;
		const owner = await this.prisma.user.findFirst({
			where: { did, ...publicWatchOwner },
			select: { did: true },
		});
		if (!owner) throw new ForbiddenException("These Watches are private");
		return true;
	}
}
