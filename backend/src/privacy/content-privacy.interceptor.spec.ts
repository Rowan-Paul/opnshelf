import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { lastValueFrom, of } from "rxjs";
import type { PrismaService } from "../prisma/prisma.service";
import type { ContentPrivacyCoordinator } from "./content-privacy-coordinator";
import { ContentPrivacyInterceptor } from "./content-privacy.interceptor";

describe("List privacy write routing", () => {
	it.each([null, { rkey: "owned-list" }])(
		"resolves the owner's slug before writing: %j",
		async (list) => {
			const findUnique = vi.fn().mockResolvedValue(list);
			const write = vi.fn(async (_did, _category, _rkey, work) => work());
			const next = { handle: vi.fn(() => of("written")) };
			const interceptor = new ContentPrivacyInterceptor(
				{ getAllAndOverride: () => "lists" } as unknown as Reflector,
				{ list: { findUnique } } as unknown as PrismaService,
				{ write } as unknown as ContentPrivacyCoordinator,
			);
			const context = {
				switchToHttp: () => ({
					getRequest: () => ({
						user: { did: "owner" },
						params: { slug: "favorites" },
					}),
				}),
				getHandler: vi.fn(),
				getClass: vi.fn(),
			} as unknown as ExecutionContext;
			const result = lastValueFrom(interceptor.intercept(context, next));
			if (!list) {
				await expect(result).rejects.toMatchObject({ status: 404 });
				expect(write).not.toHaveBeenCalled();
				expect(next.handle).not.toHaveBeenCalled();
			} else {
				await expect(result).resolves.toBe("written");
				expect(write).toHaveBeenCalledWith(
					"owner",
					"lists",
					"owned-list",
					expect.any(Function),
				);
			}
			expect(findUnique).toHaveBeenCalledWith({
				where: { userDid_slug: { userDid: "owner", slug: "favorites" } },
				select: { rkey: true },
			});
		},
	);
});
