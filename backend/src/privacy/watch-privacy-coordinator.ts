import { ConflictException, NotFoundException } from "@nestjs/common";
import type { Prisma } from "../generated/client";
import type { PrismaService } from "../prisma/prisma.service";
import { WATCH_PRIVACY_JOB_TYPE } from "./watch-migration-journal";
import { WatchAccountLock } from "./watch-account-lock";
import { WatchMigrationConflict } from "./watch-record-migration";
import type { WatchVisibility } from "./watch-record-migration";

const ACTIVE_JOB_STATUSES = ["queued", "running", "waiting_retry", "paused"];

/** All Watch writers, imports, deletion and migration workers share this account
 * lock.
 * The independent session lock outlives transaction deadlines. Recovery journal
 * writes use their own committed transaction before any PDS deletion. */
export class WatchPrivacyCoordinator {
	constructor(
		private readonly prisma: PrismaService,
		private readonly locks: WatchAccountLock,
		private readonly transactionTimeoutMs = 120_000,
	) {}

	async withAccountLock<T>(
		ownerDid: string,
		operation: (
			tx: Prisma.TransactionClient,
			signal: AbortSignal,
		) => Promise<T>,
	): Promise<T> {
		return this.locks.run(ownerDid, async (lockSignal) => {
			const deadline = new AbortController();
			const signal = AbortSignal.any([lockSignal, deadline.signal]);
			let timer: ReturnType<typeof setTimeout> | undefined;
			let work: Promise<T> | undefined;
			try {
				return await this.prisma.$transaction(
					(tx) => {
						timer = setTimeout(
							() =>
								deadline.abort(new Error("Watch operation deadline exceeded")),
							this.transactionTimeoutMs,
						);
						work = operation(tx, signal);
						return work;
					},
					{ timeout: this.transactionTimeoutMs, maxWait: 5_000 },
				);
			} finally {
				clearTimeout(timer);
				deadline.abort(new Error("Watch transaction ended"));
				// Prisma can close a transaction before an external operation settles.
				// Keep the independent session lock until the callback really stops.
				await work?.catch(() => {});
			}
		});
	}

	/** Interactive callers must bound their PDS requests and finish within the
	 * lock transaction timeout. Never catch this conflict and write anyway. */
	async write<T>(
		ownerDid: string,
		operation: (visibility: WatchVisibility, signal: AbortSignal) => Promise<T>,
	) {
		return this.locks.run(ownerDid, async (lockSignal) => {
			const signal = AbortSignal.any([
				lockSignal,
				AbortSignal.timeout(this.transactionTimeoutMs),
			]);
			const tx = this.prisma;
			await this.requireNoDeletion(tx, ownerDid);
			const user = await tx.user.findUnique({
				where: { did: ownerDid },
				select: {
					watchVisibility: true,
					watchPrivacyMigration: { select: { jobId: true } },
				},
			});
			if (!user) throw new NotFoundException("Account not found");
			if (user.watchPrivacyMigration)
				throw new ConflictException(
					"Watches are changing privacy. Resume or finish that change first.",
				);
			if (
				user.watchVisibility !== "public" &&
				user.watchVisibility !== "private"
			)
				throw new Error("Invalid Watch visibility");
			signal.throwIfAborted();
			const result = await operation(user.watchVisibility, signal);
			signal.throwIfAborted();
			return result;
		});
	}

	/** The caller must validate the OAuth grant, PDS support and publication
	 * consent before this point. No PDS mutation belongs inside start's transaction. */
	async start(
		ownerDid: string,
		target: WatchVisibility,
		publicationConfirmed: boolean,
		totalRecords?: number,
	) {
		if (target !== "public" && target !== "private")
			throw new Error("Invalid Watch visibility");
		if (target === "public" && !publicationConfirmed)
			throw new ConflictException(
				"Confirm publication before making Watches public.",
			);
		return this.withAccountLock(ownerDid, async (tx) => {
			const user = await tx.user.findUnique({
				where: { did: ownerDid },
				select: { watchVisibility: true },
			});
			if (!user) throw new NotFoundException("Account not found");
			const existing = await tx.watchPrivacyMigration.findUnique({
				where: { userDid: ownerDid },
				include: { job: true },
			});
			if (existing) {
				if (existing.targetVisibility !== target)
					throw new ConflictException(
						"Finish the current privacy change before reversing it.",
					);
				return existing.job;
			}
			if (user.watchVisibility === target) return null;
			const otherJob = await tx.backgroundJob.findFirst({
				where: {
					userDid: ownerDid,
					type: { in: ["trakt_import", "account_deletion"] },
					status: { in: ACTIVE_JOB_STATUSES },
				},
				select: { id: true },
			});
			if (otherJob)
				throw new ConflictException(
					"Finish the import or account deletion before changing Watch privacy.",
				);
			await tx.user.update({
				where: { did: ownerDid },
				data: { watchPrivacyManaged: true },
			});
			return tx.backgroundJob.create({
				data: {
					type: WATCH_PRIVACY_JOB_TYPE,
					userDid: ownerDid,
					status: "queued",
					data: totalRecords == null ? {} : { totalRecords },
					watchPrivacyMigration: {
						create: {
							userDid: ownerDid,
							sourceVisibility: user.watchVisibility,
							targetVisibility: target,
						},
					},
				},
			});
		});
	}

	async retry(ownerDid: string, jobId: string) {
		return this.withAccountLock(ownerDid, async (tx) => {
			await this.requireNoDeletion(tx, ownerDid);
			const migration = await this.requireMigration(tx, ownerDid, jobId);
			if (
				migration.job.status !== "failed" &&
				migration.job.status !== "waiting_retry" &&
				migration.job.status !== "running" &&
				migration.job.status !== "stopped_for_deletion"
			)
				return migration.job;
			return tx.backgroundJob.update({
				where: { id: jobId },
				data: { status: "queued", lastError: null, nextRunAt: new Date() },
			});
		});
	}

	/** Run one bounded batch. A crash leaves a durable running job which the next
	 * worker can resume once this database lock is released. There is no timeout
	 * lease that would let a second live worker start processing the same account.
	 * Queued state is committed only after the callback's journal/PDS writes complete.
	 * This callback must never use the lock transaction for its recovery journal. */
	async batch<T>(
		ownerDid: string,
		jobId: string,
		operation: (target: WatchVisibility, signal: AbortSignal) => Promise<T>,
	) {
		return this.withAccountLock(ownerDid, async (tx, signal) => {
			const migration = await this.requireMigration(tx, ownerDid, jobId);
			await this.requireNoDeletion(tx, ownerDid);
			if (!["queued", "running"].includes(migration.job.status))
				throw new ConflictException("Privacy change is not ready to run.");
			const target = migration.targetVisibility;
			if (target !== "public" && target !== "private")
				throw new Error("Invalid Watch visibility");
			// Commit independently: the journal must see running, and must survive
			// rollback of the outer lock transaction after an external PDS write.
			await this.prisma.backgroundJob.update({
				where: { id: jobId },
				data: { status: "running", startedAt: new Date(), lastError: null },
			});
			try {
				signal.throwIfAborted();
				const result = await operation(target, signal);
				signal.throwIfAborted();
				await tx.backgroundJob.update({
					where: { id: jobId },
					data: { status: "queued" },
				});
				return result;
			} catch (error) {
				await this.prisma.backgroundJob.update({
					where: { id: jobId },
					data: {
						status: "failed",
						lastError:
							error instanceof WatchMigrationConflict
								? "A Watch changed during migration. Review the conflicting records before retrying."
								: "The privacy change stopped safely. Reconnect and retry; recovery snapshots were retained.",
					},
				});
				throw error;
			}
		});
	}

	/** Verify while holding the independent account lock, then commit only local
	 * reconciliation and visibility in a short database transaction. No PDS or
	 * metadata requests run while that final database transaction is open. */
	async finish(
		ownerDid: string,
		jobId: string,
		reconcile: (
			tx: Prisma.TransactionClient,
			target: WatchVisibility,
			signal: AbortSignal,
		) => Promise<void>,
		verify?: (target: WatchVisibility, signal: AbortSignal) => Promise<void>,
	) {
		return this.locks.run(ownerDid, async (lockSignal) => {
			const signal = AbortSignal.any([
				lockSignal,
				AbortSignal.timeout(300_000),
			]);
			await this.requireNoDeletion(this.prisma, ownerDid);
			const migration = await this.requireMigration(
				this.prisma,
				ownerDid,
				jobId,
			);
			if (migration.job.status !== "queued")
				throw new ConflictException(
					"Verify the privacy change before finishing.",
				);
			const target = migration.targetVisibility;
			if (target !== "public" && target !== "private")
				throw new Error("Invalid Watch visibility");
			await verify?.(target, signal);
			signal.throwIfAborted();
			await this.prisma.$transaction(
				async (tx) => {
					await this.requireNoDeletion(tx, ownerDid);
					const current = await this.requireMigration(tx, ownerDid, jobId);
					if (current.job.status !== "queued")
						throw new ConflictException(
							"Privacy change is not ready to finish.",
						);
					await reconcile(tx, target, signal);
					signal.throwIfAborted();
					await tx.user.update({
						where: { did: ownerDid },
						data: { watchVisibility: target },
					});
					await tx.watchPrivacyCopy.deleteMany({ where: { jobId } });
					await tx.watchPrivacyMigration.delete({ where: { jobId } });
					await tx.backgroundJob.update({
						where: { id: jobId },
						data: {
							status: "completed",
							completedAt: new Date(),
							lastError: null,
						},
					});
				},
				{ timeout: 30_000, maxWait: 5000 },
			);
		});
	}

	/** Acquire this stop before requesting PDS account deletion. It waits for no
	 * live worker: contention returns a conflict for the deletion job to retry.
	 * Retain snapshots until local account deletion succeeds. */
	async stopForAccountDeletion(ownerDid: string) {
		return this.withAccountLock(ownerDid, async (tx) => {
			const migration = await tx.watchPrivacyMigration.findUnique({
				where: { userDid: ownerDid },
			});
			if (!migration) return;
			await tx.backgroundJob.update({
				where: { id: migration.jobId },
				data: {
					status: "stopped_for_deletion",
					lastError:
						"Watch privacy change stopped for account deletion. Recovery snapshots are retained until deletion completes.",
				},
			});
		});
	}

	/** Local account deletion must remove recovery data and jobs atomically with
	 * the account. PDS account deletion, if requested, is a separate prior step. */
	async deleteLocalAccount(
		ownerDid: string,
		deleteAccount: (tx: Prisma.TransactionClient) => Promise<void>,
	) {
		return this.withAccountLock(ownerDid, async (tx) => {
			const jobs = await tx.backgroundJob.findMany({
				where: { userDid: ownerDid, type: WATCH_PRIVACY_JOB_TYPE },
				select: { id: true },
			});
			const jobIds = jobs.map((job) => job.id);
			await tx.watchPrivacyCopy.deleteMany({
				where: { jobId: { in: jobIds } },
			});
			await tx.watchPrivacyMigration.deleteMany({
				where: { userDid: ownerDid },
			});
			await tx.backgroundJob.deleteMany({ where: { id: { in: jobIds } } });
			await deleteAccount(tx);
		});
	}

	private async requireNoDeletion(
		tx: Prisma.TransactionClient,
		ownerDid: string,
	) {
		const deletion = await tx.backgroundJob.findFirst({
			where: {
				userDid: ownerDid,
				type: "account_deletion",
				status: { in: ["queued", "running", "waiting_retry"] },
			},
			select: { id: true },
		});
		if (deletion)
			throw new ConflictException("Account deletion is in progress.");
	}

	private async requireMigration(
		tx: Prisma.TransactionClient,
		ownerDid: string,
		jobId: string,
	) {
		const migration = await tx.watchPrivacyMigration.findFirst({
			where: {
				jobId,
				userDid: ownerDid,
				job: { userDid: ownerDid, type: WATCH_PRIVACY_JOB_TYPE },
			},
			include: { job: true },
		});
		if (!migration) throw new NotFoundException("Privacy change not found");
		return migration;
	}
}
