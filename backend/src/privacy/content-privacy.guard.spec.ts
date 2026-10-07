import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { PrismaService } from "../prisma/prisma.service";
import { ContentPrivacyGuard } from "./content-privacy.guard";

function setup(
	category: string | undefined,
	viewer: string | undefined,
	state: unknown,
) {
	const findUnique = vi.fn().mockResolvedValue(state);
	const guard = new ContentPrivacyGuard(
		{ privacyScope: { findUnique } } as unknown as PrismaService,
		{ getAllAndOverride: () => category } as unknown as Reflector,
	);
	const context = {
		switchToHttp: () => ({
			getRequest: () => ({
				params: { userDid: "owner" },
				user: viewer ? { did: viewer } : undefined,
			}),
		}),
		getHandler: vi.fn(),
		getClass: vi.fn(),
	} as unknown as ExecutionContext;
	return { guard, context, findUnique };
}
describe("content privacy read boundary", () => {
	it.each(["library", "notes"])(
		"allows the owner of private %s",
		async (category) => {
			const { guard, context } = setup(category, "owner", {
				visibility: "private",
			});
			await expect(guard.canActivate(context)).resolves.toBe(true);
		},
	);
	it.each([undefined, "other"])(
		"hides private and migrating content from viewer %s",
		async (viewer) => {
			for (const state of [
				{ visibility: "private", targetVisibility: null },
				{ visibility: "public", targetVisibility: "private" },
			]) {
				const { guard, context } = setup("notes", viewer, state);
				await expect(guard.canActivate(context)).rejects.toThrow(
					"This data is Private",
				);
			}
		},
	);
	it("allows public content and rejects unsupported category metadata", async () => {
		const publicRead = setup("library", undefined, null);
		await expect(
			publicRead.guard.canActivate(publicRead.context),
		).resolves.toBe(true);
		for (const category of [undefined, "lists"]) {
			const { guard, context, findUnique } = setup(category, undefined, null);
			await expect(guard.canActivate(context)).rejects.toThrow(
				"Unsupported privacy category",
			);
			expect(findUnique).not.toHaveBeenCalled();
		}
	});
});
