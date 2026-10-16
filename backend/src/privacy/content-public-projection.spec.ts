import type { PrismaService } from "../prisma/prisma.service";
import { projectContent } from "./content-public-projection";

function setup(managed: boolean, exists = true) {
	const order: string[] = [];
	const tx = {
		$queryRaw: vi.fn(async () => {
			order.push("lock");
			return exists ? [{ did: "owner" }] : [];
		}),
		privacyScope: {
			findFirst: vi.fn(async () => {
				order.push("policy");
				return managed ? { id: "scope" } : null;
			}),
		},
	};
	const prisma = {
		$transaction: vi.fn(async (work: (db: typeof tx) => Promise<void>) =>
			work(tx),
		),
	} as unknown as PrismaService;
	const write = vi.fn(async () => {
		order.push("write");
	});
	return { prisma, tx, write, order };
}

describe("content stream privacy handover", () => {
	it("checks policy after locking the same owner row used by migration", async () => {
		const { prisma, tx, write, order } = setup(false);
		await projectContent(prisma, "owner", ["library"], "stream", write);
		expect(order).toEqual(["lock", "policy", "write"]);
		expect(write).toHaveBeenCalledWith(tx);
	});
	it("drops delayed events after a scope is managed, including after return to Public", async () => {
		const { prisma, write } = setup(true);
		await projectContent(prisma, "owner", ["notes"], "stream", write);
		expect(write).not.toHaveBeenCalled();
	});
	it("checks both parent Lists when a stream record changes its parent", async () => {
		const { prisma, tx, write } = setup(true);
		await projectContent(
			prisma,
			"owner",
			["lists:old", "lists:new"],
			"stream",
			write,
		);
		expect(tx.privacyScope.findFirst).toHaveBeenCalledWith({
			where: {
				userDid: "owner",
				key: { in: ["lists:old", "lists:new"] },
				managed: true,
			},
			select: { id: true },
		});
		expect(write).not.toHaveBeenCalled();
	});
	it("does not recreate projections for a deleted account", async () => {
		const { prisma, tx, write } = setup(false, false);
		await projectContent(prisma, "owner", ["notes"], "stream", write);
		expect(tx.privacyScope.findFirst).not.toHaveBeenCalled();
		expect(write).not.toHaveBeenCalled();
	});
	it("allows the locked repository synchronizer to project managed records", async () => {
		const { prisma, write } = setup(true);
		await projectContent(prisma, "owner", ["notes"], "repository", write);
		expect(prisma.$transaction).not.toHaveBeenCalled();
		expect(write).toHaveBeenCalledWith(prisma);
	});
});
