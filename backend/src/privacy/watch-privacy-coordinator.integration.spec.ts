import { Pool } from "pg";
import { WatchAccountLock } from "./watch-account-lock";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client";
import type { PrismaService } from "../prisma/prisma.service";
import { PrismaWatchMigrationJournal } from "./watch-migration-journal";
import { WatchPrivacyCoordinator } from "./watch-privacy-coordinator";

// Opt-in disposable database only; never fall back to the application's URL.
const url = process.env.WATCH_PRIVACY_TEST_DATABASE_URL;
if (
	url &&
	!["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)
) {
	throw new Error(
		"Watch privacy integration tests require a disposable local database",
	);
}
describe.skipIf(!url)("durable Watch privacy coordinator", () => {
	let db: PrismaClient;
	let coordinator: WatchPrivacyCoordinator;
	let lockPool: Pool;
	let locks: WatchAccountLock;
	let owner: string;
	beforeAll(() => {
		db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
		lockPool = new Pool({
			connectionString: url,
			max: 2,
			connectionTimeoutMillis: 1000,
			query_timeout: 5000,
		});
		locks = new WatchAccountLock(lockPool);
		coordinator = new WatchPrivacyCoordinator(db as PrismaService, locks);
	});
	beforeEach(async () => {
		const suffix = crypto.randomUUID();
		owner = `did:plc:test-${suffix}`;
		await db.user.create({
			data: { did: owner, handle: `privacy-${suffix}.test` },
		});
	});
	afterEach(async () => {
		const jobs = await db.backgroundJob.findMany({
			where: { userDid: owner },
			select: { id: true },
		});
		await db.watchPrivacyCopy.deleteMany({
			where: { jobId: { in: jobs.map((job) => job.id) } },
		});
		await db.watchPrivacyMigration.deleteMany({ where: { userDid: owner } });
		await db.backgroundJob.deleteMany({ where: { userDid: owner } });
		await db.user.deleteMany({ where: { did: owner } });
	});
	afterAll(async () => {
		await db?.$disconnect();
		await lockPool?.end();
	});

	it("starts public, creates one immutable direction, and blocks writes and reversal", async () => {
		expect(
			await coordinator.write(owner, async (visibility) => visibility),
		).toBe("public");
		const job = await coordinator.start(owner, "private", false);
		expect(job).not.toBeNull();
		if (!job) throw new Error("Expected a migration");
		expect((await coordinator.start(owner, "private", false))?.id).toBe(
			job?.id,
		);
		await expect(coordinator.start(owner, "public", true)).rejects.toThrow(
			"reversing",
		);
		await expect(
			coordinator.write(owner, async () => "unsafe"),
		).rejects.toThrow("changing privacy");
		await expect(
			db.watchPrivacyMigration.update({
				where: { jobId: job.id },
				data: { sourceVisibility: "private", targetVisibility: "public" },
			}),
		).rejects.toThrow();
	});

	it("requires explicit publication consent and blocks an active import", async () => {
		await db.user.update({
			where: { did: owner },
			data: { watchVisibility: "private" },
		});
		await expect(coordinator.start(owner, "public", false)).rejects.toThrow(
			"Confirm publication",
		);
		await db.backgroundJob.create({
			data: { type: "trakt_import", userDid: owner },
		});
		await expect(coordinator.start(owner, "public", true)).rejects.toThrow(
			"import",
		);
		expect(
			await db.watchPrivacyMigration.count({ where: { userDid: owner } }),
		).toBe(0);
	});

	it("serializes a migration start against an in-flight Watch operation", async () => {
		let release!: () => void;
		let entered!: () => void;
		const ready = new Promise<void>((resolve) => {
			entered = resolve;
		});
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});
		const write = coordinator.write(owner, async () => {
			entered();
			await held;
		});
		await ready;
		try {
			await expect(coordinator.start(owner, "private", false)).rejects.toThrow(
				"in progress",
			);
		} finally {
			release();
			await write;
		}
		expect(await coordinator.start(owner, "private", false)).not.toBeNull();
	});

	it("retains committed recovery snapshots through failure and retries the same job", async () => {
		const job = await coordinator.start(owner, "private", false);
		if (!job) throw new Error("Expected a migration");
		const journal = new PrismaWatchMigrationJournal(
			db as PrismaService,
			job.id,
			owner,
			"private",
		);
		const receipt = {
			collection: "xyz.opnshelf.movie" as const,
			rkey: "watch",
			cid: "snapshot",
			value: { $type: "xyz.opnshelf.movie", extension: "preserve" },
		};
		await expect(journal.assertDirection("public")).rejects.toThrow(
			"direction",
		);
		await expect(journal.recordVerifiedCopy(receipt)).rejects.toThrow(
			"Running",
		);
		await expect(
			coordinator.batch(owner, job.id, async (target) => {
				expect(target).toBe("private");
				await journal.assertDirection(target);
				await journal.recordVerifiedCopy(receipt);
				throw new Error("PDS connection lost");
			}),
		).rejects.toThrow("PDS connection lost");
		expect(await journal.load(receipt)).toEqual(receipt);
		expect(
			(await db.backgroundJob.findUniqueOrThrow({ where: { id: job.id } }))
				.status,
		).toBe("failed");
		await expect(coordinator.write(owner, async () => {})).rejects.toThrow(
			"changing privacy",
		);
		expect((await coordinator.retry(owner, job.id)).id).toBe(job.id);
		await coordinator.batch(owner, job.id, async () => {
			await journal.recordVerifiedCopy(receipt);
		});
		await expect(
			coordinator.finish(owner, job.id, async () => {
				throw new Error("index failed");
			}),
		).rejects.toThrow("index failed");
		expect(await journal.load(receipt)).toEqual(receipt);
		expect(
			(await db.user.findUniqueOrThrow({ where: { did: owner } }))
				.watchVisibility,
		).toBe("public");
		await coordinator.finish(owner, job.id, async (_tx, target) => {
			expect(target).toBe("private");
		});
		expect(
			await coordinator.write(owner, async (visibility) => visibility),
		).toBe("private");
		expect(await db.watchPrivacyCopy.count({ where: { jobId: job.id } })).toBe(
			0,
		);
		expect(
			(await db.backgroundJob.findUniqueOrThrow({ where: { id: job.id } }))
				.status,
		).toBe("completed");
		const reverse = await coordinator.start(owner, "public", true);
		if (!reverse) throw new Error("Expected a reverse migration");
		expect(reverse.id).not.toBe(job.id);
		await expect(
			new PrismaWatchMigrationJournal(
				db as PrismaService,
				reverse.id,
				owner,
				"private",
			).assertDirection("private"),
		).rejects.toThrow("not found");
	});

	it("rejects another owner and disallows account deletion before migration cleanup", async () => {
		const job = await coordinator.start(owner, "private", false);
		if (!job) throw new Error("Expected a migration");
		await expect(coordinator.retry("did:plc:other", job.id)).rejects.toThrow(
			"not found",
		);
		await expect(db.user.delete({ where: { did: owner } })).rejects.toThrow();
	});
	it("cleans recovery state atomically with local account deletion", async () => {
		const job = await coordinator.start(owner, "private", false);
		if (!job) throw new Error("Expected migration");
		const journal = new PrismaWatchMigrationJournal(
			db as PrismaService,
			job.id,
			owner,
			"private",
		);
		const receipt = {
			collection: "xyz.opnshelf.movie" as const,
			rkey: "delete-watch",
			cid: "copy",
			value: { $type: "xyz.opnshelf.movie" },
		};
		await coordinator.batch(owner, job.id, async () =>
			journal.recordVerifiedCopy(receipt),
		);
		await expect(
			coordinator.deleteLocalAccount(owner, async () => {
				throw new Error("deletion failed");
			}),
		).rejects.toThrow("deletion failed");
		expect(await journal.load(receipt)).toEqual(receipt);
		await coordinator.deleteLocalAccount(owner, async (tx) => {
			await tx.user.delete({ where: { did: owner } });
		});
		expect(await db.watchPrivacyCopy.count({ where: { jobId: job.id } })).toBe(
			0,
		);
		expect(await db.backgroundJob.count({ where: { userDid: owner } })).toBe(0);
	});
	it("does not insert a snapshot after a concurrent job stop commits", async () => {
		const job = await coordinator.start(owner, "private", false);
		if (!job) throw new Error("Expected migration");
		await db.backgroundJob.update({
			where: { id: job.id },
			data: { status: "running" },
		});
		const journal = new PrismaWatchMigrationJournal(
			db as PrismaService,
			job.id,
			owner,
			"private",
		);
		let release!: () => void;
		let entered!: () => void;
		const ready = new Promise<void>((resolve) => {
			entered = resolve;
		});
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});
		const stop = db.$transaction(async (tx) => {
			await tx.backgroundJob.update({
				where: { id: job.id },
				data: { status: "failed" },
			});
			entered();
			await held;
		});
		await ready;
		const write = journal
			.recordVerifiedCopy({
				collection: "xyz.opnshelf.movie",
				rkey: "race",
				cid: "copy",
				value: {},
			})
			.then(
				() => "inserted",
				() => "rejected",
			);
		try {
			let blocked = false;
			for (let attempt = 0; attempt < 100; attempt++) {
				const [row] = await db.$queryRaw<
					{ count: number }[]
				>`SELECT COUNT(*)::int AS count FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE '%BackgroundJob%'`;
				if (row.count > 0) {
					blocked = true;
					break;
				}
				await new Promise((resolve) => setTimeout(resolve, 10));
			}
			expect(blocked).toBe(true);
		} finally {
			release();
			await stop;
		}
		expect(await write).toBe("rejected");
		expect(await db.watchPrivacyCopy.count({ where: { jobId: job.id } })).toBe(
			0,
		);
	});
	it("keeps the account lock after the transaction deadline until external work settles", async () => {
		const short = new WatchPrivacyCoordinator(db as PrismaService, locks, 500);
		let entered!: () => void;
		let release!: () => void;
		const ready = new Promise<void>((resolve) => {
			entered = resolve;
		});
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});
		const write = short
			.write(owner, async () => {
				entered();
				await held;
			})
			.then(
				() => "succeeded",
				() => "expired",
			);
		await ready;
		await new Promise((resolve) => setTimeout(resolve, 650));
		try {
			await expect(coordinator.start(owner, "private", false)).rejects.toThrow(
				"in progress",
			);
		} finally {
			release();
		}
		expect(await write).toBe("expired");
		expect(await coordinator.start(owner, "private", false)).not.toBeNull();
	});
	it.each(["paused", "failed"])(
		"handles a %s Trakt import according to its resumability",
		async (status) => {
			await db.backgroundJob.create({
				data: { type: "trakt_import", userDid: owner, status },
			});
			if (status === "paused")
				await expect(
					coordinator.start(owner, "private", false),
				).rejects.toThrow("import");
			else
				expect(await coordinator.start(owner, "private", false)).not.toBeNull();
		},
	);
	it("stops work before account deletion while retaining recovery state", async () => {
		const job = await coordinator.start(owner, "private", false);
		if (!job) throw new Error("Expected migration");
		await coordinator.stopForAccountDeletion(owner);
		await expect(
			coordinator.batch(owner, job.id, async () => {}),
		).rejects.toThrow("not ready");
		expect(
			await db.watchPrivacyMigration.count({ where: { userDid: owner } }),
		).toBe(1);
		expect((await coordinator.retry(owner, job.id)).status).toBe("queued");
	});
	it("aborts external operations at the transaction deadline", async () => {
		const short = new WatchPrivacyCoordinator(db as PrismaService, locks, 500);
		let aborted = false;
		await expect(
			short.write(owner, async (_visibility, signal) => {
				await new Promise<void>((_resolve, reject) => {
					const abort = () => {
						aborted = true;
						reject(signal.reason);
					};
					if (signal.aborted) abort();
					else signal.addEventListener("abort", abort, { once: true });
				});
			}),
		).rejects.toThrow();
		expect(aborted).toBe(true);
		expect(await coordinator.start(owner, "private", false)).not.toBeNull();
	});
	it("blocks writes, batches, completion and retry until account deletion is terminal", async () => {
		const job = await coordinator.start(owner, "private", false);
		if (!job) throw new Error("Expected migration");
		await coordinator.stopForAccountDeletion(owner);
		const deletion = await db.backgroundJob.create({
			data: { type: "account_deletion", userDid: owner },
		});
		await expect(coordinator.write(owner, async () => {})).rejects.toThrow(
			"deletion is in progress",
		);
		await expect(
			coordinator.batch(owner, job.id, async () => {}),
		).rejects.toThrow("deletion is in progress");
		await expect(
			coordinator.finish(owner, job.id, async () => {}),
		).rejects.toThrow("deletion is in progress");
		await expect(coordinator.retry(owner, job.id)).rejects.toThrow(
			"deletion is in progress",
		);
		await db.backgroundJob.update({
			where: { id: deletion.id },
			data: { status: "failed" },
		});
		expect((await coordinator.retry(owner, job.id)).status).toBe("queued");
	});
});
