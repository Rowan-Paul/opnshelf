import {
	Injectable,
	NotFoundException,
	SetMetadata,
	type CallHandler,
	type ExecutionContext,
	type NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { defer, lastValueFrom } from "rxjs";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedRequest } from "../auth/types";
import {
	ContentPrivacyCoordinator,
	type ContentCategory,
} from "./content-privacy-coordinator";
export const ContentPrivacyCategory = (category: ContentCategory) =>
	SetMetadata("privacyCategory", category);
@Injectable()
export class ContentPrivacyInterceptor implements NestInterceptor {
	constructor(
		private readonly reflector: Reflector,
		private readonly prisma: PrismaService,
		private readonly coordinator: ContentPrivacyCoordinator,
	) {}
	intercept(context: ExecutionContext, next: CallHandler) {
		const category = this.reflector.getAllAndOverride<ContentCategory>(
			"privacyCategory",
			[context.getHandler(), context.getClass()],
		);
		const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
		return defer(async () => {
			let listRkey: string | undefined;
			if (category === "lists" && typeof req.params.slug === "string") {
				const list = await this.prisma.list.findUnique({
					where: {
						userDid_slug: { userDid: req.user.did, slug: req.params.slug },
					},
					select: { rkey: true },
				});
				if (!list) throw new NotFoundException("List not found");
				listRkey = list.rkey;
			}
			return this.coordinator.write(req.user.did, category, listRkey, () =>
				lastValueFrom(next.handle()),
			);
		});
	}
}
