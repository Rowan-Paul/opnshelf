import type { PrismaService } from "../prisma/prisma.service";
import { ContentPrivacyCoordinator } from "./content-privacy-coordinator";
import { privacyRepositoryConfig } from "./privacy-category";
import type { WatchAccountLock } from "./watch-account-lock";
import { watchOperation } from "./watch-operation";

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

describe("bulk List privacy acceptance", () => {
	it("accepts every List and the default under one account lock", async () => {
		const upsert = vi.fn().mockResolvedValue({});
		const update = vi.fn();
		const tx = {
			$queryRaw: vi.fn(),
			privacyScope: { findUnique: vi.fn().mockResolvedValue(null), upsert },
			user: { update },
		};
		const prisma = {
			user: { findUnique: vi.fn().mockResolvedValue({ did: "owner" }) },
			backgroundJob: { findFirst: vi.fn().mockResolvedValue(null) },
			$transaction: vi.fn(async (work) => work(tx)),
		} as unknown as PrismaService;
		let locked = false;
		const run = vi.fn(async (_did, work) => {
			if (locked) throw new Error("Another Watch operation is in progress");
			locked = true;
			return work(new AbortController().signal);
		});
		const coordinator = new ContentPrivacyCoordinator(prisma, {
			run,
		} as unknown as WatchAccountLock);
		await coordinator.startAllLists(
			"owner",
			["first", "second"],
			"private",
			false,
		);
		expect(run).toHaveBeenCalledOnce();
		expect(prisma.$transaction).toHaveBeenCalledOnce();
		expect(upsert).toHaveBeenCalledTimes(2);
		expect(update).toHaveBeenCalledWith({
			where: { did: "owner" },
			data: { listsDefaultVisibility: "private" },
		});
	});
});
