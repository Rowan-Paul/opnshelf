import { Agent } from "@atproto/api";
import {
	ConflictException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { $nsid as EPISODE_COLLECTION } from "../lexicons/xyz/opnshelf/episode";
import { $nsid as FOLLOW_COLLECTION } from "../lexicons/xyz/opnshelf/follow";
import { $nsid as LIBRARY_ITEM_COLLECTION } from "../lexicons/xyz/opnshelf/library/item";
import { $nsid as LIST_COLLECTION } from "../lexicons/xyz/opnshelf/list";
import { $nsid as LIST_ITEM_COLLECTION } from "../lexicons/xyz/opnshelf/list/item";
import { $nsid as MOVIE_COLLECTION } from "../lexicons/xyz/opnshelf/movie";
import { $nsid as NOTE_COLLECTION } from "../lexicons/xyz/opnshelf/note";
import { $nsid as PROFILE_COLLECTION } from "../lexicons/xyz/opnshelf/profile.defs";
import { $nsid as RATING_COLLECTION } from "../lexicons/xyz/opnshelf/rating";
import { $nsid as DOCUMENT_COLLECTION } from "../lexicons/site/standard/document";
import { $nsid as REVIEW_COLLECTION } from "../lexicons/xyz/opnshelf/review";
import { $nsid as REVIEW_LIKE_COLLECTION } from "../lexicons/xyz/opnshelf/review/like";
import { PrismaService } from "../prisma/prisma.service";
import { AUTH_SERVICE } from "../auth/auth.tokens";
import type { AuthService } from "../auth/auth.service";
import {
	ACCOUNT_DELETION_JOB_TYPE,
	TRAKT_IMPORT_JOB_TYPE,
	buildAccountDeletionData,
	parseAccountDeletionData,
	type AccountDeletionJobData,
} from "./background-job-data";

interface ATSession {
	did: string;
}

const RECORDS_PAGE_SIZE = 100;
const ACTIVE_DELETION_STATUSES = ["queued", "running", "waiting_retry"];
// A deletion job stuck in "running" longer than this was orphaned by a crash
// (single-instance worker — nothing else owns it). Reset it so it re-runs and
// the user is no longer blocked by createDeletionJob's Conflict guard.
const STALE_RUNNING_MS = 5 * 60 * 1000;
// Persist progress at most once per this many deleted records (instead of after
// every single record) to avoid thousands of DB writes in one run.
const PROGRESS_FLUSH_EVERY = 50;
// Delete at most this many records per worker tick, then yield so other jobs
// (Trakt imports + other deletions) get a turn instead of being starved.
const DELETION_BATCH_SIZE = 200;

// Ordered PDS deletion steps. Resume picks up at the persisted currentStep and
// skips earlier steps entirely (their records are already gone — re-deleting is
// a no-op via isRecordMissingError, but skipping avoids needless PDS calls).
const PDS_DELETION_STEPS = [
	"movies",
	"episodes",
	"library_items",
	"ratings",
	"follows",
	"notes",
	"reviews",
	"review_likes",
	"blog_mirrors",
	"list_items",
	"lists",
	"profile",
] as const;
type PdsDeletionStep = (typeof PDS_DELETION_STEPS)[number];

@Injectable()
export class UserDeletionService {
	private readonly logger = new Logger(UserDeletionService.name);

	constructor(
		private readonly prisma: PrismaService,
		@Inject(AUTH_SERVICE)
		private readonly authService: Pick<AuthService, "restore" | "revoke">,
	) {}

	async deleteUserSync(did: string): Promise<void> {
		const user = await this.prisma.user.findUnique({
			where: { did },
		});

		if (!user) {
			throw new NotFoundException("User not found");
		}

		await this.prisma.backgroundJob.deleteMany({
			where: { userDid: did, type: TRAKT_IMPORT_JOB_TYPE },
		});

		await this.prisma.user.delete({
			where: { did },
		});

		// Revoke the OAuth session too — it lives in a standalone table (no FK
		// cascade), so deleting the user alone leaves a live session behind.
		await this.authService.revoke(did);
	}

	async createDeletionJob(did: string, deletePdsData: boolean) {
		const user = await this.prisma.user.findUnique({
			where: { did },
		});

		if (!user) {
			throw new NotFoundException("User not found");
		}

		const existingJob = await this.prisma.backgroundJob.findFirst({
			where: {
				type: ACCOUNT_DELETION_JOB_TYPE,
				userDid: did,
				status: { in: ACTIVE_DELETION_STATUSES },
			},
		});

		if (existingJob) {
			throw new ConflictException("An account deletion is already in progress");
		}

		const [
			movieCount,
			episodeCount,
			ratingCount,
			followCount,
			noteCount,
			reviewCount,
		] = await Promise.all([
			this.prisma.trackedMovie.count({ where: { userDid: did } }),
			this.prisma.trackedEpisode.count({ where: { userDid: did } }),
			this.prisma.rating.count({ where: { userDid: did } }),
			this.prisma.follow.count({
				where: { followerDid: did, rkey: { not: null } },
			}),
			this.prisma.note.count({ where: { userDid: did } }),
			this.prisma.review.count({ where: { userDid: did } }),
		]);

		// +1 for profile record, list items and lists are counted dynamically
		const totalRecords =
			movieCount +
			episodeCount +
			ratingCount +
			followCount +
			noteCount +
			reviewCount +
			1;

		return this.prisma.backgroundJob.create({
			data: {
				type: ACCOUNT_DELETION_JOB_TYPE,
				userDid: did,
				status: "queued",
				data: buildAccountDeletionData({
					deletePdsData,
					totalRecords,
				}),
			},
		});
	}

	async getCurrentDeletionJob(userDid: string) {
		return this.prisma.backgroundJob.findFirst({
			where: {
				type: ACCOUNT_DELETION_JOB_TYPE,
				userDid,
			},
			orderBy: [{ createdAt: "desc" }],
		});
	}

	/**
	 * Reset deletion jobs orphaned in "running" by a crash back to a re-pickable
	 * state. Resume is idempotent: PDS deletes for already-removed records are
	 * no-ops (isRecordMissingError), and resume continues from the persisted
	 * currentStep. Crucially this also un-wedges the user: createDeletionJob's
	 * Conflict guard counts the job as active (waiting_retry is an active
	 * status), but the worker can now pick it up again instead of it sitting in
	 * "running" forever.
	 */
	async reapStaleRunningJobs(): Promise<void> {
		const threshold = new Date(Date.now() - STALE_RUNNING_MS);
		const result = await this.prisma.backgroundJob.updateMany({
			where: {
				type: ACCOUNT_DELETION_JOB_TYPE,
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
				`Reaped ${result.count} stale running account-deletion job(s) back to waiting_retry.`,
			);
		}
	}

	async processNextDeletionJob(): Promise<void> {
		const job = await this.prisma.backgroundJob.findFirst({
			where: {
				type: ACCOUNT_DELETION_JOB_TYPE,
				status: { in: ACTIVE_DELETION_STATUSES },
				nextRunAt: { lte: new Date() },
			},
			orderBy: [{ nextRunAt: "asc" }, { createdAt: "asc" }],
		});

		if (!job) {
			return;
		}

		await this.processDeletionJob(job.id);
	}

	private async processDeletionJob(jobId: string): Promise<void> {
		const job = await this.prisma.backgroundJob.findUnique({
			where: { id: jobId },
		});
		if (!job || job.status === "completed" || job.status === "failed") {
			return;
		}

		const jobData = parseAccountDeletionData(job.data);

		await this.prisma.backgroundJob.update({
			where: { id: job.id },
			data: {
				status: "running",
				startedAt: job.startedAt ?? new Date(),
				lastError: null,
			},
		});

		try {
			if (jobData.deletePdsData && jobData.currentStep !== "db_cleanup") {
				const finished = await this.deletePdsRecordsWithProgress(
					job.id,
					job.userDid,
					jobData,
				);

				if (!finished) {
					// Bounded batch done but more PDS records remain. Persist
					// progress (incl. currentStep so we resume mid-pipeline) and
					// yield the worker so other jobs get a turn. Re-pickable on the
					// next tick via an immediate nextRunAt.
					await this.prisma.backgroundJob.update({
						where: { id: job.id },
						data: {
							status: "waiting_retry",
							nextRunAt: new Date(),
							data: { ...jobData },
						},
					});
					return;
				}
			}

			await this.updateJobData(job.id, jobData, { currentStep: "completed" });

			// Mark the job completed before deleting the user/revoking the session.
			// The frontend polls this endpoint while authenticated; if we revoke the
			// session first, the client can never observe the final completed state.
			await this.prisma.backgroundJob.update({
				where: { id: job.id },
				data: {
					status: "completed",
					completedAt: new Date(),
					data: { ...jobData },
				},
			});

			// Durable Trakt outcomes live for the account lifetime. Remove the Trakt
			// job explicitly here (its item/match rows cascade) while preserving this
			// account-deletion job until the worker has finished cleanly.
			await this.prisma.backgroundJob.deleteMany({
				where: { userDid: job.userDid, type: TRAKT_IMPORT_JOB_TYPE },
			});
			await this.prisma.user.delete({ where: { did: job.userDid } });

			// Revoke the OAuth session (standalone table, no FK cascade) so a
			// deleted account doesn't leave a live session behind.
			await this.authService.revoke(job.userDid);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.error(
				`Account deletion job ${job.id} failed: ${message}`,
				error instanceof Error ? error.stack : undefined,
			);
			await this.prisma.backgroundJob.update({
				where: { id: job.id },
				data: {
					status: "failed",
					lastError: message,
					completedAt: new Date(),
				},
			});
		}
	}

	/**
	 * Delete the user's PDS records, bounded to DELETION_BATCH_SIZE records per
	 * call so a huge account doesn't monopolize the single-instance worker.
	 *
	 * Resumes from jobData.currentStep: earlier steps are skipped (their records
	 * are already deleted). Within a step we re-list/re-query each tick and rely
	 * on idempotency — tryDeleteRecord treats missing records as success
	 * (isRecordMissingError), so re-running deletes nothing twice.
	 *
	 * Returns true when all PDS steps are complete, false when the per-tick
	 * budget was exhausted and the caller should yield and reschedule.
	 */
	private async deletePdsRecordsWithProgress(
		jobId: string,
		userDid: string,
		jobData: AccountDeletionJobData,
	): Promise<boolean> {
		const session = await this.restoreSession(userDid);
		if (!session) {
			throw new Error(
				"Your sign-in session expired. Could not delete PDS data.",
			);
		}

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		const budget = { remaining: DELETION_BATCH_SIZE, sinceFlush: 0 };
		const startStep = this.resolveStartStepIndex(jobData.currentStep);

		for (let i = startStep; i < PDS_DELETION_STEPS.length; i++) {
			const step = PDS_DELETION_STEPS[i];

			// Mark the step we're entering before doing work, so a crash mid-step
			// resumes at this step (idempotent re-delete) rather than skipping it.
			// On a genuinely new step, snapshot the deletedRecords baseline; on a
			// resume into the same step we keep the persisted baseline so progress
			// is recomputed (not double-counted) as the step is re-walked.
			if (jobData.currentStep !== step) {
				jobData.stepBaseline = jobData.deletedRecords;
				jobData.stepCursor = undefined;
				await this.updateJobData(jobId, jobData, { currentStep: step });
			}

			const done = await this.runDeletionStep(
				step,
				agent,
				session.did,
				userDid,
				jobId,
				jobData,
				budget,
			);

			if (!done) {
				// Per-tick budget exhausted partway through this step. Persist
				// the accumulated baseline and signal the caller to yield + reschedule.
				// PDS-backed steps will list only records that still exist; locally
				// sourced mirror records resume after stepCursor.
				jobData.stepBaseline = jobData.deletedRecords;
				await this.updateJobData(jobId, jobData);
				return false;
			}
		}

		await this.updateJobData(jobId, jobData);
		return true;
	}

	private resolveStartStepIndex(currentStep: string | undefined): number {
		if (!currentStep) {
			return 0;
		}
		const index = PDS_DELETION_STEPS.indexOf(currentStep as PdsDeletionStep);
		return index >= 0 ? index : 0;
	}

	/**
	 * Run a single PDS deletion step, consuming from the shared per-tick budget.
	 * Returns true if the step completed, false if the budget ran out mid-step.
	 */
	private async runDeletionStep(
		step: PdsDeletionStep,
		agent: Agent,
		repoDid: string,
		userDid: string,
		jobId: string,
		jobData: AccountDeletionJobData,
		budget: { remaining: number; sinceFlush: number },
	): Promise<boolean> {
		// Progress within a step is derived from this baseline so a resumed run
		// that re-walks the step recomputes deletedRecords instead of inflating it.
		const stepBaseline = jobData.stepBaseline ?? jobData.deletedRecords;

		if (step === "profile") {
			if (budget.remaining <= 0) {
				return false;
			}
			await this.tryDeleteRecord(
				agent,
				repoDid,
				PROFILE_COLLECTION,
				"self",
				"Failed to delete profile record from PDS",
			);
			jobData.deletedRecords = stepBaseline + 1;
			budget.remaining--;
			return true;
		}

		const { collection, rkeys } = await this.collectStepRkeys(
			step,
			agent,
			repoDid,
			userDid,
			jobId,
			jobData,
		);

		let processedInStep = 0;
		for (const rkey of rkeys) {
			if (budget.remaining <= 0) {
				return false;
			}
			await this.tryDeleteRecord(
				agent,
				repoDid,
				collection,
				rkey,
				`Failed to delete ${step} record ${rkey} from PDS`,
			);
			if (step === "blog_mirrors") {
				jobData.stepCursor = rkey;
			}
			processedInStep++;
			jobData.deletedRecords = stepBaseline + processedInStep;
			budget.remaining--;
			budget.sinceFlush++;

			if (budget.sinceFlush >= PROGRESS_FLUSH_EVERY) {
				budget.sinceFlush = 0;
				await this.updateJobData(jobId, jobData);
			}
		}

		return true;
	}

	private async collectStepRkeys(
		step: Exclude<PdsDeletionStep, "profile">,
		agent: Agent,
		repoDid: string,
		userDid: string,
		jobId: string,
		jobData: AccountDeletionJobData,
	): Promise<{ collection: string; rkeys: string[] }> {
		switch (step) {
			case "movies":
				return this.listCollectionRecordKeys(agent, repoDid, MOVIE_COLLECTION);
			case "episodes":
				return this.listCollectionRecordKeys(
					agent,
					repoDid,
					EPISODE_COLLECTION,
				);
			case "library_items": {
				const result = await this.listCollectionRecordKeys(
					agent,
					repoDid,
					LIBRARY_ITEM_COLLECTION,
				);
				await this.reconcileDynamicTotal(
					jobId,
					jobData,
					"library_items",
					result.rkeys.length,
				);
				return result;
			}
			case "ratings":
				return this.listCollectionRecordKeys(agent, repoDid, RATING_COLLECTION);
			case "follows":
				return this.listCollectionRecordKeys(agent, repoDid, FOLLOW_COLLECTION);
			case "notes":
				return this.listCollectionRecordKeys(agent, repoDid, NOTE_COLLECTION);
			case "reviews":
				return this.listCollectionRecordKeys(agent, repoDid, REVIEW_COLLECTION);
			case "review_likes": {
				const result = await this.listCollectionRecordKeys(
					agent,
					repoDid,
					REVIEW_LIKE_COLLECTION,
				);
				await this.reconcileDynamicTotal(
					jobId,
					jobData,
					"review_likes",
					result.rkeys.length,
				);
				return result;
			}
			case "blog_mirrors": {
				// Delete opnshelf-authored blog-mirror documents (ADR-0013). The
				// mirror reuses the review rkey. We do NOT touch the user-owned
				// site.standard.publication these point at — opnshelf never minted it.
				const rows = await this.prisma.review.findMany({
					where: { userDid, blogDocumentUri: { not: null } },
					select: { rkey: true },
				});
				const rkeys = rows
					.map((row) => row.rkey)
					.sort()
					.filter((rkey) => !jobData.stepCursor || rkey > jobData.stepCursor);
				return {
					collection: DOCUMENT_COLLECTION,
					rkeys,
				};
			}
			case "list_items": {
				const rkeys = await this.listRepoRecordKeys(
					agent,
					repoDid,
					LIST_ITEM_COLLECTION,
				);
				await this.reconcileDynamicTotal(
					jobId,
					jobData,
					"list_items",
					rkeys.length,
				);
				return { collection: LIST_ITEM_COLLECTION, rkeys };
			}
			case "lists": {
				const rkeys = await this.listRepoRecordKeys(
					agent,
					repoDid,
					LIST_COLLECTION,
				);
				await this.reconcileDynamicTotal(jobId, jobData, "lists", rkeys.length);
				return { collection: LIST_COLLECTION, rkeys };
			}
		}
	}

	private async listCollectionRecordKeys(
		agent: Agent,
		repoDid: string,
		collection: string,
	): Promise<{ collection: string; rkeys: string[] }> {
		return {
			collection,
			rkeys: await this.listRepoRecordKeys(agent, repoDid, collection),
		};
	}

	/**
	 * Collections absent from the local deletion estimate are counted dynamically
	 * from the PDS. Add their count to totalRecords exactly once, even
	 * across resumes, by tracking which dynamic steps we've already counted.
	 */
	private async reconcileDynamicTotal(
		jobId: string,
		jobData: AccountDeletionJobData,
		step: "library_items" | "review_likes" | "list_items" | "lists",
		count: number,
	): Promise<void> {
		const counted = jobData.countedDynamicSteps ?? [];
		if (counted.includes(step)) {
			return;
		}
		jobData.totalRecords += count;
		jobData.countedDynamicSteps = [...counted, step];
		await this.updateJobData(jobId, jobData);
	}

	private async updateJobData(
		jobId: string,
		jobData: AccountDeletionJobData,
		overrides?: Partial<AccountDeletionJobData>,
	): Promise<void> {
		if (overrides) {
			Object.assign(jobData, overrides);
		}
		await this.prisma.backgroundJob.update({
			where: { id: jobId },
			data: { data: { ...jobData } },
		});
	}

	private async tryDeleteRecord(
		agent: Agent,
		repoDid: string,
		collection: string,
		rkey: string,
		warnPrefix: string,
	) {
		try {
			await agent.com.atproto.repo.deleteRecord({
				repo: repoDid,
				collection,
				rkey,
			});
		} catch (error) {
			if (this.isRecordMissingError(error)) {
				return;
			}
			throw new Error(`${warnPrefix}: ${this.getErrorMessage(error)}`, {
				cause: error,
			});
		}
	}

	private async listRepoRecordKeys(
		agent: Agent,
		repoDid: string,
		collection: string,
	): Promise<string[]> {
		const rkeys: string[] = [];
		let cursor: string | undefined;

		try {
			do {
				const response = await agent.com.atproto.repo.listRecords({
					repo: repoDid,
					collection,
					limit: RECORDS_PAGE_SIZE,
					cursor,
				});

				for (const record of response.data.records) {
					rkeys.push(this.extractRkeyFromUri(record.uri, repoDid, collection));
				}

				cursor = response.data.cursor;
			} while (cursor);
		} catch (error) {
			throw new Error(
				`Failed to list ${collection} records from PDS for user ${repoDid}: ${this.getErrorMessage(error)}`,
				{ cause: error },
			);
		}

		return rkeys;
	}

	private extractRkeyFromUri(
		uri: string,
		repoDid: string,
		collection: string,
	): string {
		const prefix = `at://${repoDid}/${collection}/`;

		if (!uri.startsWith(prefix)) {
			throw new Error(`Unexpected record URI returned from PDS: ${uri}`);
		}

		return uri.slice(prefix.length);
	}

	private async restoreSession(userDid: string): Promise<ATSession | null> {
		try {
			const session = await this.authService.restore(userDid);
			return session ? (session as unknown as ATSession) : null;
		} catch (error) {
			this.logger.warn(
				`Failed to restore auth session for ${userDid}: ${error instanceof Error ? error.message : String(error)}`,
			);
			return null;
		}
	}

	private isRecordMissingError(error: unknown): boolean {
		if (!error || typeof error !== "object") {
			return false;
		}

		const candidate = error as {
			error?: string;
			status?: number;
			message?: string;
		};

		return (
			candidate.status === 404 ||
			candidate.error === "RecordNotFound" ||
			candidate.message?.includes("RecordNotFound") === true ||
			candidate.message?.includes("Delete target record does not exist") ===
				true
		);
	}

	private getErrorMessage(error: unknown): string {
		return error instanceof Error ? error.message : String(error);
	}
}
