import type { PrismaService } from "../prisma/prisma.service";
import { PrismaWatchMigrationJournal } from "./watch-migration-journal";
import {
	WatchMigrationConflict,
	type WatchMoveReceipt,
} from "./watch-record-migration";

const receipt: WatchMoveReceipt = {
	collection: "xyz.opnshelf.movie",
	rkey: "watch",
	cid: "cid",
	value: { $type: "xyz.opnshelf.movie", extension: "preserve" },
};
function fixture() {
	const prisma = {
		backgroundJob: { findFirst: vi.fn().mockResolvedValue({ id: "job" }) },
		$queryRaw: vi.fn().mockResolvedValue([{ id: "job" }]),
		watchPrivacyCopy: {
			findUnique: vi.fn().mockResolvedValue(receipt),
			createMany: vi.fn().mockResolvedValue({ count: 1 }),
		},
	};
	const client = {
		...prisma,
		$transaction: vi.fn(
			async (operation: (tx: typeof prisma) => Promise<void>) =>
				operation(prisma),
		),
	};
	return {
		prisma: client,
		journal: new PrismaWatchMigrationJournal(
			client as unknown as PrismaService,
			"job",
			"did:plc:owner",
			"private",
		),
	};
}
it("scopes the journal to its migration and owner before reading private snapshots", async () => {
	const f = fixture();
	expect(await f.journal.load(receipt)).toEqual(receipt);
	expect(f.prisma.watchPrivacyCopy.findUnique).toHaveBeenCalledWith({
		where: {
			jobId_collection_rkey: {
				jobId: "job",
				collection: receipt.collection,
				rkey: receipt.rkey,
			},
		},
	});
	expect(f.prisma.backgroundJob.findFirst).toHaveBeenCalledWith({
		where: {
			id: "job",
			userDid: "did:plc:owner",
			type: "watch_privacy",
			watchPrivacyMigration: {
				userDid: "did:plc:owner",
				targetVisibility: "private",
			},
		},
		select: { id: true },
	});
});
it("denies another owner's or another job type's journal", async () => {
	const f = fixture();
	f.prisma.backgroundJob.findFirst.mockResolvedValue(null);
	f.prisma.$queryRaw.mockResolvedValue([]);
	await expect(f.journal.load(receipt)).rejects.toThrow("not found");
	await expect(f.journal.recordVerifiedCopy(receipt)).rejects.toThrow(
		"not found",
	);
	expect(f.prisma.watchPrivacyCopy.findUnique).not.toHaveBeenCalled();
	expect(f.prisma.watchPrivacyCopy.createMany).not.toHaveBeenCalled();
});
it("retains the full snapshot and refuses to replace a different committed copy", async () => {
	const f = fixture();
	await f.journal.recordVerifiedCopy(receipt);
	expect(f.prisma.$transaction).toHaveBeenCalledTimes(1);
	const [query, ...bindings] = f.prisma.$queryRaw.mock.calls[0];
	expect(query.join("?")).toContain("FOR UPDATE");
	expect(query.join("?")).toContain("status = 'running'");
	expect(bindings).toEqual([
		"job",
		"did:plc:owner",
		"watch_privacy",
		"did:plc:owner",
		"private",
	]);
	expect(f.prisma.watchPrivacyCopy.createMany).toHaveBeenCalledWith({
		data: [{ ...receipt, jobId: "job" }],
		skipDuplicates: true,
	});
	f.prisma.watchPrivacyCopy.findUnique.mockResolvedValue({
		...receipt,
		cid: "concurrent-copy",
	});
	await expect(f.journal.recordVerifiedCopy(receipt)).rejects.toThrow(
		WatchMigrationConflict,
	);
});
it("rejects malformed journal values rather than authorizing source deletion", async () => {
	const f = fixture();
	f.prisma.watchPrivacyCopy.findUnique.mockResolvedValue({
		...receipt,
		value: null,
	});
	await expect(f.journal.load(receipt)).rejects.toThrow("Invalid");
});
