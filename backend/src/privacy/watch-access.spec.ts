import type { ExecutionContext } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";
import { WatchReadGuard, publicWatchOwner } from "./watch-access";
function context(owner: string, viewer?: string): ExecutionContext {
	return {
		switchToHttp: () => ({
			getRequest: () => ({
				params: { userDid: owner },
				user: viewer ? { did: viewer } : undefined,
			}),
		}),
	} as ExecutionContext;
}
describe("private Watch readers", () => {
	it.each([undefined, "did:plc:another"])(
		"denies a non-owner (%s) while private or migrating",
		async (viewer) => {
			const findFirst = vi.fn().mockResolvedValue(null);
			const guard = new WatchReadGuard({
				user: { findFirst },
			} as unknown as PrismaService);
			await expect(
				guard.canActivate(context("did:plc:owner", viewer)),
			).rejects.toThrow("private");
			expect(findFirst).toHaveBeenCalledWith({
				where: { did: "did:plc:owner", ...publicWatchOwner },
				select: { did: true },
			});
		},
	);
	it("preserves owner access without opening the public boundary", async () => {
		const findFirst = vi.fn();
		const guard = new WatchReadGuard({
			user: { findFirst },
		} as unknown as PrismaService);
		await expect(
			guard.canActivate(context("did:plc:owner", "did:plc:owner")),
		).resolves.toBe(true);
		expect(findFirst).not.toHaveBeenCalled();
	});
});
