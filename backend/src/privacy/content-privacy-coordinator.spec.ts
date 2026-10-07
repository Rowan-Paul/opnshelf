import type { PrismaService } from "../prisma/prisma.service";
import type { WatchAccountLock } from "./watch-account-lock";
import { ContentPrivacyCoordinator } from "./content-privacy-coordinator";
import { watchOperation } from "./watch-operation";
import { privacyRepositoryConfig } from "./privacy-category";

describe("nested List privacy", () => {
	it("uses the new-List default without mutating the enclosing Watch write", async () => {
		const upsert = vi.fn();
		const prisma = {
			user: {
				findUnique: vi.fn().mockResolvedValue({ did: "owner" }),
				findUniqueOrThrow: vi
					.fn()
					.mockResolvedValue({ listsDefaultVisibility: "private" }),
			},
			backgroundJob: { findFirst: vi.fn().mockResolvedValue(null) },
			privacyScope: { upsert },
		} as unknown as PrismaService;
		const run = vi.fn();
		const coordinator = new ContentPrivacyCoordinator(prisma, {
			run,
		} as unknown as WatchAccountLock);
		const parent = {
			did: "owner",
			visibility: "public" as const,
			signal: new AbortController().signal,
		};
		await watchOperation.run(parent, async () => {
			await coordinator.write("owner", "lists", undefined, async () => {
				expect(watchOperation.getStore()?.visibility).toBe("private");
				await coordinator.prepareNewList("owner", "new-list");
				expect(upsert).not.toHaveBeenCalled();
				await coordinator.activateNewList("owner", "new-list");
				expect(watchOperation.getStore()?.repository).toEqual(
					privacyRepositoryConfig("lists", "new-list"),
				);
			});
			expect(watchOperation.getStore()).toBe(parent);
			expect(watchOperation.getStore()?.repository).toBeUndefined();
		});
		expect(run).not.toHaveBeenCalled();
		expect(upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				create: expect.objectContaining({
					visibility: "private",
					listRkey: "new-list",
				}),
			}),
		);
	});
});
