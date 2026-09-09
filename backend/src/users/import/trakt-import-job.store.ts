/**
 * Persistence for the single Trakt Import job per User (ADR 0020). Every
 * `backgroundJob` read and write for Trakt Imports goes through here so the
 * compare-and-swap rules that keep a concurrent Pause, control update, and
 * worker progress write from clobbering each other live in one place.
 */
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
	TRAKT_IMPORT_JOB_TYPE,
	parseTraktImportData,
	type TraktImportJobData,
} from "../background-job-data";
import type { BackgroundJobRecord } from "../trakt-job-dto";

export type TraktJobStatus =
	| "queued"
	| "running"
	| "waiting_retry"
	| "paused"
	| "completed"
	| "failed";

export const ACTIVE_TRAKT_JOB_STATUSES: TraktJobStatus[] = [
	"queued",
	"running",
	"waiting_retry",
];
// A job stuck in "running" longer than this was almost certainly orphaned by a
// process crash (the worker is single-instance, so no other instance owns it).
const STALE_RUNNING_MS = 5 * 60 * 1000;
const TRAKT_JOB_CAS_RETRIES = 3;

export type TraktJobPersistence = {
	status: TraktJobStatus;
	data?: TraktImportJobData;
	nextRunAt: Date;
	lastError: string | null;
	completedAt: Date | null;
};

export class TraktJobCasError extends Error {}

export function isUniqueConstraintError(error: unknown): boolean {
	return (
		error instanceof Prisma.PrismaClientKnownRequestError &&
		error.code === "P2002"
	);
}

@Injectable()
export class TraktImportJobStore {
	private readonly logger = new Logger(TraktImportJobStore.name);

	constructor(private readonly prisma: PrismaService) {}

	async createJob(
		userDid: string,
		data: TraktImportJobData,
	): Promise<NonNullable<BackgroundJobRecord>> {
		return this.prisma.backgroundJob.create({
			data: {
				type: TRAKT_IMPORT_JOB_TYPE,
				userDid,
				status: "queued",
				nextRunAt: new Date(),
				data,
			},
		});
	}

	async findLatestJob(
		userDid: string,
		options: { statuses: TraktJobStatus[]; recentSince?: Date },
	): Promise<BackgroundJobRecord> {
		return this.prisma.backgroundJob.findFirst({
			where: {
				type: TRAKT_IMPORT_JOB_TYPE,
				userDid,
				status: { in: options.statuses },
				...(options.recentSince
					? {
							updatedAt: {
								gte: options.recentSince,
							},
						}
					: {}),
			},
			orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
		});
	}

	/** The User's newest Trakt Import job, whatever its status. */
	async findCurrentJob(userDid: string): Promise<BackgroundJobRecord> {
		return this.prisma.backgroundJob.findFirst({
			where: {
				type: TRAKT_IMPORT_JOB_TYPE,
				userDid,
			},
			orderBy: [{ createdAt: "desc" }],
		});
	}

	async requireJob(userDid: string): Promise<NonNullable<BackgroundJobRecord>> {
		const job = await this.prisma.backgroundJob.findFirst({
			where: { type: TRAKT_IMPORT_JOB_TYPE, userDid },
			orderBy: { createdAt: "desc" },
		});
		if (!job) throw new NotFoundException("Trakt import not found");
		return job;
	}

	async findJobById(jobId: string): Promise<BackgroundJobRecord> {
		return this.prisma.backgroundJob.findUnique({ where: { id: jobId } });
	}

	/** The next active job whose `nextRunAt` has passed, oldest first. */
	async findNextRunnableJob(): Promise<BackgroundJobRecord> {
		return this.prisma.backgroundJob.findFirst({
			where: {
				type: TRAKT_IMPORT_JOB_TYPE,
				status: { in: ACTIVE_TRAKT_JOB_STATUSES },
				nextRunAt: { lte: new Date() },
			},
			orderBy: [{ nextRunAt: "asc" }, { createdAt: "asc" }],
		});
	}

	/**
	 * Move the job to "running" only if nobody changed it since it was read.
	 * Returns false when the claim was lost (for example to a concurrent Pause).
	 */
	async claimJob(job: NonNullable<BackgroundJobRecord>): Promise<boolean> {
		const claim = await this.prisma.backgroundJob.updateMany({
			where: {
				id: job.id,
				updatedAt: job.updatedAt,
				status: { in: ACTIVE_TRAKT_JOB_STATUSES },
				nextRunAt: { lte: new Date() },
			},
			data: {
				status: "running",
				startedAt: job.startedAt ?? new Date(),
				lastError: null,
			},
		});
		if (claim.count === 1) {
			return true;
		}

		const current = await this.prisma.backgroundJob.findUnique({
			where: { id: job.id },
		});
		if (
			current &&
			ACTIVE_TRAKT_JOB_STATUSES.includes(current.status as TraktJobStatus) &&
			current.nextRunAt <= new Date()
		) {
			this.logger.debug(
				`Lost the claim race for Trakt import job ${job.id}; leaving its newer state untouched.`,
			);
		}
		return false;
	}

	async persistStatusControl(
		jobId: string,
		action: "pause" | "resume",
	): Promise<void> {
		for (let attempt = 0; attempt < TRAKT_JOB_CAS_RETRIES; attempt += 1) {
			const latest = await this.prisma.backgroundJob.findUnique({
				where: { id: jobId },
			});
			if (!latest) {
				throw new NotFoundException("Trakt import job not found");
			}
			const applicable =
				action === "pause"
					? ACTIVE_TRAKT_JOB_STATUSES.includes(latest.status as TraktJobStatus)
					: latest.status === "paused" || latest.status === "failed";
			if (!applicable) {
				return;
			}

			const result = await this.prisma.backgroundJob.updateMany({
				where: {
					id: jobId,
					updatedAt: latest.updatedAt,
					status: latest.status,
				},
				data:
					action === "pause"
						? { status: "paused", nextRunAt: new Date() }
						: {
								status: "queued",
								nextRunAt: new Date(),
								lastError: null,
								completedAt: null,
							},
			});
			if (result.count === 1) {
				return;
			}
		}

		throw new TraktJobCasError(
			`Could not ${action} Trakt import job ${jobId} after ${TRAKT_JOB_CAS_RETRIES} concurrent updates.`,
		);
	}

	async persistControl(
		jobId: string,
		control: Pick<
			TraktImportJobData,
			"acknowledgedAt" | "reminderSnoozedUntil"
		>,
	): Promise<void> {
		for (let attempt = 0; attempt < TRAKT_JOB_CAS_RETRIES; attempt += 1) {
			const latest = await this.prisma.backgroundJob.findUnique({
				where: { id: jobId },
			});
			if (!latest) {
				throw new NotFoundException("Trakt import job not found");
			}
			const result = await this.prisma.backgroundJob.updateMany({
				where: { id: jobId, updatedAt: latest.updatedAt },
				data: { data: { ...parseTraktImportData(latest.data), ...control } },
			});
			if (result.count === 1) {
				return;
			}
		}

		throw new TraktJobCasError(
			`Could not persist Trakt import controls for ${jobId} after ${TRAKT_JOB_CAS_RETRIES} concurrent updates.`,
		);
	}

	/**
	 * Reset Trakt import jobs orphaned in "running" by a crash back to a
	 * re-pickable state. Resume is idempotent: it re-fetches from the persisted
	 * currentPage and re-imports via deterministic rkeys (existing records are
	 * skipped or overwritten in place), so no work is duplicated or lost.
	 */
	async reapStaleRunningJobs(): Promise<void> {
		const threshold = new Date(Date.now() - STALE_RUNNING_MS);
		const result = await this.prisma.backgroundJob.updateMany({
			where: {
				type: TRAKT_IMPORT_JOB_TYPE,
				status: "running",
				updatedAt: { lt: threshold },
			},
			data: {
				status: "waiting_retry",
				nextRunAt: new Date(),
				lastError: "Recovered after the worker was interrupted. Resuming.",
			},
		});
		if (result.count > 0) {
			this.logger.warn(
				`Reaped ${result.count} stale running Trakt import job(s) back to waiting_retry.`,
			);
		}
	}

	async failJob(jobId: string, message?: string): Promise<void> {
		await this.persistWorkerState(jobId, undefined, {
			status: "failed",
			lastError:
				message || "Trakt import failed. Please retry later or use CSV import.",
			completedAt: new Date(),
			nextRunAt: new Date(),
		});
	}

	/**
	 * Write worker progress without overriding what the User did meanwhile: a
	 * concurrent Pause keeps the job paused (progress is still saved), newer
	 * acknowledge/snooze controls survive, and a terminal state is never
	 * replaced by a different one.
	 */
	async persistWorkerState(
		jobId: string,
		workerData: TraktImportJobData | undefined,
		workerState: Omit<TraktJobPersistence, "data">,
	): Promise<void> {
		for (let attempt = 0; attempt < TRAKT_JOB_CAS_RETRIES; attempt += 1) {
			const latest = await this.prisma.backgroundJob.findUnique({
				where: { id: jobId },
			});
			if (!latest) {
				return;
			}

			const latestData = parseTraktImportData(latest.data);
			const mergedData = workerData
				? {
						...workerData,
						acknowledgedAt: latestData.acknowledgedAt,
						reminderSnoozedUntil: latestData.reminderSnoozedUntil,
					}
				: latestData;
			const paused = latest.status === "paused";
			const terminal =
				latest.status === "completed" || latest.status === "failed";
			if (terminal && latest.status !== workerState.status) {
				return;
			}

			const state: TraktJobPersistence = paused
				? {
						status: "paused",
						data: mergedData,
						nextRunAt: latest.nextRunAt,
						lastError: latest.lastError,
						completedAt: latest.completedAt,
					}
				: { ...workerState, data: mergedData };
			const result = await this.prisma.backgroundJob.updateMany({
				where: { id: jobId, updatedAt: latest.updatedAt },
				data: state,
			});
			if (result.count === 1) {
				return;
			}
		}

		throw new TraktJobCasError(
			`Could not persist Trakt import job ${jobId} after ${TRAKT_JOB_CAS_RETRIES} concurrent updates.`,
		);
	}
}
