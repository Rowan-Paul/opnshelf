import { Prisma } from "../generated/client";
import type { PrismaService } from "../prisma/prisma.service";
import {
	WatchMigrationConflict,
	type WatchMigrationJournal,
	type WatchMoveReceipt,
	type WatchReference,
	type WatchVisibility,
} from "./watch-record-migration";

export const WATCH_PRIVACY_JOB_TYPE = "watch_privacy";

/** Each instance belongs to one authorized migration. No API or worker creates
 * these jobs yet: the account write lock and all public-read gates come first. */
export class PrismaWatchMigrationJournal implements WatchMigrationJournal {
	constructor(
		private readonly prisma: PrismaService,
		private readonly jobId: string,
		private readonly ownerDid: string,
		private readonly target: WatchVisibility,
	) {}
	async assertDirection(target: WatchVisibility) {
		if (target !== this.target)
			throw new Error("Watch privacy migration direction mismatch");
		await this.requireJob();
	}
	private async requireJob() {
		const job = await this.prisma.backgroundJob.findFirst({
			where: {
				id: this.jobId,
				userDid: this.ownerDid,
				type: WATCH_PRIVACY_JOB_TYPE,
				watchPrivacyMigration: {
					userDid: this.ownerDid,
					targetVisibility: this.target,
				},
			},
			select: { id: true },
		});
		if (!job)
			throw new Error("Watch privacy migration not found for this owner");
	}
	async load(ref: WatchReference): Promise<WatchMoveReceipt | undefined> {
		await this.requireJob();
		const row = await this.prisma.watchPrivacyCopy.findUnique({
			where: {
				jobId_collection_rkey: {
					jobId: this.jobId,
					collection: ref.collection,
					rkey: ref.rkey,
				},
			},
		});
		if (!row) return undefined;
		if (
			!row.value ||
			typeof row.value !== "object" ||
			Array.isArray(row.value)
		) {
			throw new Error("Invalid Watch privacy copy journal");
		}
		return { ...ref, cid: row.cid, value: row.value };
	}
	async recordVerifiedCopy(receipt: WatchMoveReceipt): Promise<void> {
		if (
			!receipt.value ||
			typeof receipt.value !== "object" ||
			Array.isArray(receipt.value)
		)
			throw new Error("Invalid Watch privacy copy journal");
		await this.prisma.$transaction(async (tx) => {
			// Serialize status transitions and snapshot insertion. A plain check
			// before this transaction would allow cancellation to race the insert.
			const jobs = await tx.$queryRaw<{ id: string }[]>`
				SELECT j.id FROM "BackgroundJob" j
				JOIN "WatchPrivacyMigration" m ON m."jobId" = j.id
				WHERE j.id = ${this.jobId} AND j."userDid" = ${this.ownerDid}
				AND j.type = ${WATCH_PRIVACY_JOB_TYPE} AND j.status = 'running'
				AND m."userDid" = ${this.ownerDid} AND m."targetVisibility" = ${this.target}
				FOR UPDATE OF j, m
			`;
			if (!jobs.length)
				throw new Error(
					"Running Watch privacy migration not found for this owner",
				);
			// Never overwrite the last recoverable complete record.
			await tx.watchPrivacyCopy.createMany({
				data: [
					{
						collection: receipt.collection,
						rkey: receipt.rkey,
						cid: receipt.cid,
						jobId: this.jobId,
						value: receipt.value as Prisma.InputJsonObject,
					},
				],
				skipDuplicates: true,
			});
			const stored = await tx.watchPrivacyCopy.findUnique({
				where: {
					jobId_collection_rkey: {
						jobId: this.jobId,
						collection: receipt.collection,
						rkey: receipt.rkey,
					},
				},
			});
			if (stored?.cid !== receipt.cid) throw new WatchMigrationConflict();
		});
	}
}
