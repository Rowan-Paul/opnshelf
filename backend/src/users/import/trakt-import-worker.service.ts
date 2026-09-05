/**
 * Processes one page of a Trakt Import per tick: fetch the page from Trakt,
 * record every source item in the ledger, write the Watches, then persist
 * progress. Pacing against the PDS write budget and rate-limit backoff for
 * both Trakt and the PDS live here.
 */
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type {
	ImportErrorDto,
	NormalizedImportItemDto,
} from "../dto/import-history.dto";
import {
	parseTraktImportData,
	type TraktImportJobData,
} from "../background-job-data";
import {
	PDS_RETRY_FALLBACK_SECONDS,
	PDS_RETRY_MAX_SECONDS,
	PdsRateLimitError,
	type PdsRateLimitSnapshot,
	TraktApiError,
	formatRetryDelay,
	getErrorMessage,
	secondsUntilPdsReset,
} from "../import-errors";
import {
	buildImportKey,
	normalizeTraktApiItem,
	normalizeTraktPage,
} from "../trakt-normalize";
import { TRAKT_HISTORY_PAGE_SIZE, TraktApiClient } from "../trakt-api.client";
import {
	deterministicWatchRkeyForItem,
	draftTraktLedgerRow,
	type TraktLedgerOutcome,
} from "./trakt-import-ledger";
import { TraktImportJobStore } from "./trakt-import-job.store";
import { WatchImportWriter } from "./watch-import-writer.service";

type RecordedTraktPageItem = {
	sourceIndex: number;
	normalizedIndex?: number;
	item?: NormalizedImportItemDto;
	initialOutcome: TraktLedgerOutcome;
	duplicate: boolean;
};

const TRAKT_RATE_LIMIT_BACKOFF_SECONDS = [60, 300, 600]; // 1min, 5min, 10min, then +5min each time
const TRAKT_PAGE_DELAY_MS = 800;
// Leave at least this many repo-write points unspent in the current window so
// the user's own interactive writes (rate, review, mark-watched) are never
// starved by a background import — they share one per-account PDS budget. We
// read the live `ratelimit-remaining` after each batch and pause until the
// window resets once it drops below this. A page costs ≤300 points (≤100
// creates × 3), so pausing at 1000 both avoids tripping the next 429 and keeps
// ~300 writes of headroom for the user.
// ponytail: fixed reserve; revisit only if the PDS exposes per-route budgets.
const PDS_WRITE_RESERVE_POINTS = 1000;

@Injectable()
export class TraktImportWorker {
	private readonly logger = new Logger(TraktImportWorker.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly traktApi: TraktApiClient,
		private readonly jobStore: TraktImportJobStore,
		private readonly writer: WatchImportWriter,
	) {}

	async processNextTraktImportJob(): Promise<void> {
		const job = await this.jobStore.findNextRunnableJob();

		if (!job) {
			return;
		}

		await this.processTraktImportJob(job.id);
	}

	private async processTraktImportJob(jobId: string): Promise<void> {
		const job = await this.jobStore.findJobById(jobId);
		if (!job) {
			return;
		}
		if (
			job.status === "completed" ||
			job.status === "failed" ||
			job.status === "paused" ||
			job.nextRunAt > new Date()
		) {
			return;
		}

		const jobData = parseTraktImportData(job.data);

		const session = await this.writer.restoreImportSession(job.userDid);
		if (!session) {
			await this.jobStore.failJob(
				job.id,
				"Your sign-in session expired. Please sign in again and retry the import.",
			);
			return;
		}

		if (!(await this.jobStore.claimJob(job))) {
			return;
		}

		try {
			const pageResult = await this.traktApi.fetchHistoryPage(
				jobData.traktUsername,
				jobData.currentPage,
				{ endAt: new Date(jobData.snapshotAt) },
			);
			const totalPages =
				pageResult.pageCount ?? jobData.totalPages ?? jobData.currentPage;
			const normalized = normalizeTraktPage(
				pageResult.payload,
				jobData.sourceCount + 1,
			);
			const recordedItems = await this.recordTraktPageOutcomes(
				job.id,
				job.userDid,
				pageResult.payload,
				jobData.sourceCount + 1,
			);
			let rateLimit: PdsRateLimitSnapshot | undefined;
			const importResult = await this.writer.importNormalizedItems(
				job.userDid,
				session,
				normalized.items,
				{
					onRateLimit: (snapshot) => {
						rateLimit = snapshot;
					},
				},
			);
			await this.finalizeRecordedPageOutcomes(
				job.id,
				recordedItems,
				importResult.errors,
			);
			const nextPage = jobData.currentPage + 1;
			const hasKnownTotalPages =
				Number.isInteger(totalPages) && totalPages >= 1;
			const isComplete =
				pageResult.payload.length === 0 ||
				(hasKnownTotalPages
					? nextPage > totalPages
					: pageResult.payload.length < TRAKT_HISTORY_PAGE_SIZE);

			const pageUnmatchedCount = recordedItems.filter(
				(recorded) => recorded.initialOutcome === "unmatched",
			).length;
			const pageAlreadyCount = recordedItems.filter(
				(recorded) =>
					recorded.initialOutcome === "already_on_shelf" || recorded.duplicate,
			).length;
			const pageCouldntImportCount = recordedItems.filter(
				(recorded) => recorded.initialOutcome === "couldnt_import",
			).length;
			const updatedData: TraktImportJobData = {
				...jobData,
				currentPage: isComplete ? jobData.currentPage : nextPage,
				totalPages,
				sourceCount: jobData.sourceCount + pageResult.payload.length,
				normalizedCount: jobData.normalizedCount + normalized.items.length,
				importedCount: jobData.importedCount + importResult.imported,
				skippedCount:
					jobData.skippedCount +
					normalized.skipped.length +
					importResult.skipped,
				unmatchedCount: jobData.unmatchedCount + pageUnmatchedCount,
				alreadyOnShelfCount: jobData.alreadyOnShelfCount + pageAlreadyCount,
				failedCount:
					jobData.failedCount + importResult.failed + pageCouldntImportCount,
			};

			// Pace the import against the live repo-write budget: import and user
			// share one per-account PDS limit, so when remaining points drop below
			// the reserve we pause until the window resets rather than draining it
			// and locking the user out of their own account.
			const lowBudget =
				!isComplete &&
				rateLimit?.remaining !== undefined &&
				rateLimit.remaining < PDS_WRITE_RESERVE_POINTS;
			const throttleSeconds = lowBudget ? secondsUntilPdsReset(rateLimit) : 0;
			if (lowBudget) {
				this.logger.log(
					`Pacing import for job ${job.id}: ${rateLimit?.remaining} write points left, pausing ${throttleSeconds}s for budget to refill.`,
				);
			}

			await this.jobStore.persistWorkerState(job.id, updatedData, {
				status: isComplete
					? "completed"
					: lowBudget
						? "waiting_retry"
						: "running",
				lastError: lowBudget
					? `Pausing so your account stays under its PDS write limit. Retrying in ${formatRetryDelay(throttleSeconds)}.`
					: null,
				nextRunAt: isComplete
					? new Date()
					: lowBudget
						? new Date(Date.now() + throttleSeconds * 1000)
						: new Date(Date.now() + TRAKT_PAGE_DELAY_MS),
				completedAt: isComplete ? new Date() : null,
			});
		} catch (error) {
			if (error instanceof PdsRateLimitError) {
				const retryAfterSeconds = Math.min(
					Math.max(
						error.retryAfterSeconds ?? PDS_RETRY_FALLBACK_SECONDS,
						PDS_RETRY_FALLBACK_SECONDS,
					),
					PDS_RETRY_MAX_SECONDS,
				);
				this.logger.warn(
					`PDS rate limit reached for job ${job.id}. Retrying in ${retryAfterSeconds}s.`,
				);
				await this.jobStore.persistWorkerState(job.id, undefined, {
					status: "waiting_retry",
					nextRunAt: new Date(Date.now() + retryAfterSeconds * 1000),
					lastError: `PDS rate limit reached. Retrying in ${formatRetryDelay(retryAfterSeconds)}.`,
					completedAt: null,
				});
				return;
			}

			if (error instanceof TraktApiError && error.status === 429) {
				const retryCount = jobData.rateLimitRetries ?? 0;
				const backoff =
					retryCount < TRAKT_RATE_LIMIT_BACKOFF_SECONDS.length
						? TRAKT_RATE_LIMIT_BACKOFF_SECONDS[retryCount]
						: 600 + (retryCount - 2) * 300; // 10min, then +5min each time
				const retryAfterSeconds = Math.max(
					backoff,
					error.retryAfterSeconds ?? 0,
				);
				this.logger.warn(
					`Trakt rate limit reached for job ${job.id}. Retrying in ${retryAfterSeconds}s (attempt ${retryCount + 1}).`,
				);
				await this.jobStore.persistWorkerState(
					job.id,
					{ ...jobData, rateLimitRetries: retryCount + 1 },
					{
						status: "waiting_retry",
						nextRunAt: new Date(Date.now() + retryAfterSeconds * 1000),
						lastError: `Trakt rate limit reached. Retrying in ${formatRetryDelay(retryAfterSeconds)}.`,
						completedAt: null,
					},
				);
				return;
			}

			if (error instanceof TraktApiError) {
				await this.jobStore.failJob(job.id, error.message);
				return;
			}

			await this.jobStore.failJob(job.id, getErrorMessage(error));
		}
	}

	/**
	 * Record every source item of the page in the ledger before any write, so
	 * the outcome of each item survives a crash mid-page (ADR 0020).
	 */
	private async recordTraktPageOutcomes(
		jobId: string,
		userDid: string,
		payload: unknown[],
		startIndex: number,
	): Promise<RecordedTraktPageItem[]> {
		const recorded: RecordedTraktPageItem[] = [];
		const seenImportKeys = new Set<string>();
		let normalizedIndex = 0;

		for (let offset = 0; offset < payload.length; offset++) {
			const sourceIndex = startIndex + offset;
			const normalized = normalizeTraktApiItem(payload[offset], sourceIndex);
			const draft = draftTraktLedgerRow(payload[offset], normalized);

			let initialOutcome: RecordedTraktPageItem["initialOutcome"] =
				draft.initialOutcome;
			let duplicate = false;
			let currentNormalizedIndex: number | undefined;

			if (normalized.item) {
				currentNormalizedIndex = normalizedIndex;
				normalizedIndex += 1;
				const importKey = buildImportKey(normalized.item);
				duplicate = seenImportKeys.has(importKey);
				seenImportKeys.add(importKey);
				const alreadyOnShelf = duplicate
					? true
					: await this.writer.alreadyImported(userDid, normalized.item);
				initialOutcome = alreadyOnShelf ? "already_on_shelf" : "pending";
			}

			await this.prisma.traktImportItem.upsert({
				where: { jobId_sourceIndex: { jobId, sourceIndex } },
				create: {
					jobId,
					sourceIndex,
					outcome: initialOutcome,
					...draft.fields,
				},
				update: {},
			});

			recorded.push({
				sourceIndex,
				normalizedIndex: currentNormalizedIndex,
				item: normalized.item,
				initialOutcome,
				duplicate,
			});
		}

		return recorded;
	}

	private async finalizeRecordedPageOutcomes(
		jobId: string,
		recorded: RecordedTraktPageItem[],
		errors: ImportErrorDto[],
	): Promise<void> {
		const errorsByNormalizedIndex = new Map(
			errors.map((error) => [error.index - 1, error]),
		);

		for (const entry of recorded) {
			if (!entry.item || entry.initialOutcome !== "pending") continue;
			const error =
				entry.normalizedIndex === undefined
					? undefined
					: errorsByNormalizedIndex.get(entry.normalizedIndex);
			const createdWatchRkey = deterministicWatchRkeyForItem(entry.item);

			await this.prisma.traktImportItem.update({
				where: { jobId_sourceIndex: { jobId, sourceIndex: entry.sourceIndex } },
				data: error
					? {
							outcome: "couldnt_import",
							reason: error.reason ?? error.code,
							message: error.message,
						}
					: { outcome: "imported", createdWatchRkey },
			});
		}
	}
}
