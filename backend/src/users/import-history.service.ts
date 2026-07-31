import { Agent } from "@atproto/api";
import {
	BadRequestException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { AUTH_SERVICE } from "../auth/auth.tokens";
import {
	deterministicEpisodeWatchRkey,
	deterministicMovieWatchRkey,
} from "../common/watch-rkey";
import { MoviesService } from "../movies/movies.service";
import { PrismaService } from "../prisma/prisma.service";
import { ShowsService } from "../shows/shows.service";
import type {
	FetchTraktPublicHistoryResponseDto,
	ImportErrorDto,
	ImportHistoryResponseDto,
	ImportSkipDto,
	NormalizedImportItemDto,
	PaginatedTraktImportIssuesDto,
	StartTraktImportResponseDto,
	TraktHistoryPreviewItemDto,
	TraktImportJobDto,
	TraktMatchCandidateDto,
} from "./dto/import-history.dto";
import type { AuthService } from "../auth/auth.service";
import {
	TRAKT_IMPORT_JOB_TYPE,
	buildTraktImportData,
	parseTraktImportData,
	type TraktImportJobData,
} from "./background-job-data";
import {
	PDS_RETRY_FALLBACK_SECONDS,
	PDS_RETRY_MAX_SECONDS,
	PdsRateLimitError,
	type PdsRateLimitSnapshot,
	TraktApiError,
	classifyImportWriteError,
	formatRetryDelay,
	getErrorMessage,
	getPdsRetryAfterSeconds,
	isPdsRateLimitError,
	isRecordExistsError,
	reportPdsRateLimit,
	secondsUntilPdsReset,
	toPublicTraktException,
} from "./import-errors";
import {
	TRAKT_PREVIEW_ITEM_LIMIT,
	type TraktHistoryPayloadItem,
	buildImportKey,
	candidateYearScore,
	describeImportItem,
	getOptionalIdentifierValue,
	getOptionalIntegerValue,
	getOptionalStringValue,
	normalizeTraktApiItem,
	normalizeTraktPage,
	yearFromDate,
} from "./trakt-normalize";
import { TRAKT_HISTORY_PAGE_SIZE, TraktApiClient } from "./trakt-api.client";
import {
	type BackgroundJobRecord,
	buildProfileFromJobData,
	mapTraktImportIssue,
	mapTraktImportJob,
} from "./trakt-job-dto";

interface ATSession {
	did: string;
}

type TraktJobStatus =
	| "queued"
	| "running"
	| "waiting_retry"
	| "paused"
	| "completed"
	| "failed";

/** A PDS record built and ready to write, paired with the item it came from. */
type PendingWrite = {
	itemIndex: number;
	item: NormalizedImportItemDto;
	rkey: string;
	collection: string;
	record: unknown;
} & (
	| { type: "movie"; movieTmdbId: string }
	| {
			type: "episode";
			showTmdbId: string;
			seasonNumber: number;
			episodeNumber: number;
	  }
);

type WriteResult = { uri: string; cid: string };

type RecordedTraktPageItem = {
	sourceIndex: number;
	normalizedIndex?: number;
	item?: NormalizedImportItemDto;
	initialOutcome:
		| "pending"
		| "imported"
		| "already_on_shelf"
		| "unmatched"
		| "couldnt_import";
	duplicate: boolean;
};

const TRAKT_PREVIEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVE_TRAKT_JOB_STATUSES: TraktJobStatus[] = [
	"queued",
	"running",
	"waiting_retry",
];
// A job stuck in "running" longer than this was almost certainly orphaned by a
// process crash (the worker is single-instance, so no other instance owns it).
const STALE_RUNNING_MS = 5 * 60 * 1000;
const TRAKT_RATE_LIMIT_BACKOFF_SECONDS = [60, 300, 600]; // 1min, 5min, 10min, then +5min each time
const TRAKT_PAGE_DELAY_MS = 800;
const PDS_APPLY_WRITES_BATCH_SIZE = 200;
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
export class ImportHistoryService {
	private readonly logger = new Logger(ImportHistoryService.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly moviesService: MoviesService,
		private readonly showsService: ShowsService,
		private readonly traktApi: TraktApiClient,
		@Inject(AUTH_SERVICE)
		private readonly authService: Pick<AuthService, "restore">,
	) {}

	async fetchTraktPublicHistory(
		username: string,
	): Promise<FetchTraktPublicHistoryResponseDto> {
		try {
			this.traktApi.ensureConfigured();

			const normalizedUsername = this.traktApi.normalizeUsername(username);
			const profile =
				await this.traktApi.fetchPublicProfile(normalizedUsername);
			const startAt = new Date(Date.now() - TRAKT_PREVIEW_WINDOW_MS);
			let page = 1;
			let pageCount = Number.POSITIVE_INFINITY;
			const items: NormalizedImportItemDto[] = [];
			const skipped: ImportSkipDto[] = [];
			const previewItems: TraktHistoryPreviewItemDto[] = [];

			while (page <= pageCount) {
				const pageResult = await this.traktApi.fetchHistoryPage(
					normalizedUsername,
					page,
					{ startAt },
				);
				pageCount = pageResult.pageCount ?? pageCount;
				const baseIndex = items.length + skipped.length + 1;

				for (let i = 0; i < pageResult.payload.length; i++) {
					const result = normalizeTraktApiItem(
						pageResult.payload[i],
						baseIndex + i,
					);
					if (result.item) {
						items.push(result.item);
						if (
							result.previewItem &&
							previewItems.length < TRAKT_PREVIEW_ITEM_LIMIT
						) {
							previewItems.push(result.previewItem);
						}
					} else if (result.skip) {
						skipped.push(result.skip);
					}
				}

				if (
					pageResult.payload.length < TRAKT_HISTORY_PAGE_SIZE &&
					!Number.isFinite(pageCount)
				) {
					break;
				}

				page += 1;
			}

			return {
				profile,
				importableCount: items.length,
				previewItems,
				items,
				skipped,
			};
		} catch (error) {
			throw toPublicTraktException(error);
		}
	}

	async startTraktImport(
		userDid: string,
		username: string,
	): Promise<StartTraktImportResponseDto> {
		try {
			this.traktApi.ensureConfigured();
			const normalizedUsername = this.traktApi.normalizeUsername(username);
			const existingJob = await this.findLatestTraktImportJob(userDid, {
				statuses: [
					...ACTIVE_TRAKT_JOB_STATUSES,
					"paused",
					"completed",
					"failed",
				],
			});

			if (existingJob) {
				const existingData = parseTraktImportData(existingJob.data);
				const existingProfile = buildProfileFromJobData(existingData);
				return {
					profile: existingProfile,
					previewItems: [],
					sourcePreviewCount: 0,
					job: mapTraktImportJob(existingJob),
				};
			}

			const preview = await this.traktApi.fetchPreview(normalizedUsername);
			const job = await this.prisma.backgroundJob.create({
				data: {
					type: TRAKT_IMPORT_JOB_TYPE,
					userDid,
					status: "queued",
					nextRunAt: new Date(),
					data: buildTraktImportData({
						traktUsername: normalizedUsername,
						profileUsername: preview.profile.username,
						profileSlug: preview.profile.slug,
						profileName: preview.profile.name,
						profileAvatarUrl: preview.profile.avatarUrl,
					}),
				},
			});

			return {
				profile: preview.profile,
				previewItems: preview.previewItems,
				sourcePreviewCount: preview.sourcePreviewCount,
				job: mapTraktImportJob(job),
			};
		} catch (error) {
			throw toPublicTraktException(error);
		}
	}

	async getCurrentTraktImport(
		userDid: string,
	): Promise<TraktImportJobDto | null> {
		const job = await this.prisma.backgroundJob.findFirst({
			where: {
				type: TRAKT_IMPORT_JOB_TYPE,
				userDid,
			},
			orderBy: [{ createdAt: "desc" }],
		});

		return job ? this.mapTraktImportJobWithIssues(job) : null;
	}

	async pauseTraktImport(userDid: string): Promise<TraktImportJobDto> {
		const job = await this.requireTraktImportJob(userDid);
		if (ACTIVE_TRAKT_JOB_STATUSES.includes(job.status as TraktJobStatus)) {
			await this.prisma.backgroundJob.update({
				where: { id: job.id },
				data: { status: "paused", nextRunAt: new Date() },
			});
		}
		return this.getRequiredCurrentTraktImport(userDid);
	}

	async resumeTraktImport(userDid: string): Promise<TraktImportJobDto> {
		const job = await this.requireTraktImportJob(userDid);
		if (job.status === "paused" || job.status === "failed") {
			await this.prisma.backgroundJob.update({
				where: { id: job.id },
				data: {
					status: "queued",
					nextRunAt: new Date(),
					lastError: null,
					completedAt: null,
				},
			});
		}
		return this.getRequiredCurrentTraktImport(userDid);
	}

	async acknowledgeTraktImport(userDid: string): Promise<TraktImportJobDto> {
		const job = await this.requireTraktImportJob(userDid);
		const data = parseTraktImportData(job.data);
		await this.prisma.backgroundJob.update({
			where: { id: job.id },
			data: { data: { ...data, acknowledgedAt: new Date().toISOString() } },
		});
		return this.getRequiredCurrentTraktImport(userDid);
	}

	async snoozeTraktReminder(userDid: string): Promise<TraktImportJobDto> {
		const job = await this.requireTraktImportJob(userDid);
		const data = parseTraktImportData(job.data);
		const reminderSnoozedUntil = new Date(
			Date.now() + 7 * 24 * 60 * 60 * 1000,
		).toISOString();
		await this.prisma.backgroundJob.update({
			where: { id: job.id },
			data: { data: { ...data, reminderSnoozedUntil } },
		});
		return this.getRequiredCurrentTraktImport(userDid);
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

	async processNextTraktImportJob(): Promise<void> {
		const job = await this.prisma.backgroundJob.findFirst({
			where: {
				type: TRAKT_IMPORT_JOB_TYPE,
				status: { in: ACTIVE_TRAKT_JOB_STATUSES },
				nextRunAt: { lte: new Date() },
			},
			orderBy: [{ nextRunAt: "asc" }, { createdAt: "asc" }],
		});

		if (!job) {
			return;
		}

		await this.processTraktImportJob(job.id);
	}

	async importNormalizedItems(
		userDid: string,
		session: ATSession,
		items: NormalizedImportItemDto[],
		options?: { onRateLimit?: (snapshot: PdsRateLimitSnapshot) => void },
	): Promise<ImportHistoryResponseDto> {
		if (items.length > 100) {
			throw new BadRequestException(
				"A maximum of 100 items can be imported per request",
			);
		}

		const built = await this.buildPendingWrites(userDid, items);
		const { pendingWrites } = built;
		let imported = 0;
		let skipped = built.skipped;
		let failed = built.failed;
		const errors: ImportErrorDto[] = [...built.errors];

		if (pendingWrites.length === 0) {
			return { imported, skipped, failed, errors };
		}

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		for (
			let batchStart = 0;
			batchStart < pendingWrites.length;
			batchStart += PDS_APPLY_WRITES_BATCH_SIZE
		) {
			const batch = pendingWrites.slice(
				batchStart,
				batchStart + PDS_APPLY_WRITES_BATCH_SIZE,
			);
			const batchLabel = `${batchStart + 1}–${batchStart + batch.length}`;
			let results: WriteResult[] | undefined;

			this.logger.debug(
				`PDS applyWrites: sending batch of ${batch.length} records (items ${batchLabel}) to ${session.did}`,
			);
			try {
				const created = await this.applyWriteBatch(
					agent,
					session,
					batch,
					"create",
					options,
				);
				results = created.results;
				this.logger.debug(
					`PDS applyWrites: batch of ${batch.length} succeeded (commit ${created.commitCid})`,
				);
			} catch (writeError) {
				let error: unknown = writeError;
				// Crash-recovery / idempotent re-import: rkeys are deterministic
				// content hashes, so if a previous run wrote these records to the
				// PDS but died before the DB write, the `create` batch fails with
				// "record already exists". Retry the same batch as `update` ops —
				// the record at that rkey is byte-identical, so this is an
				// idempotent overwrite. Keeps batching (one extra round-trip per
				// affected batch, not per item).
				if (!isPdsRateLimitError(error) && isRecordExistsError(error)) {
					this.logger.debug(
						`PDS applyWrites: batch ${batchLabel} already exists, retrying as update (idempotent re-import)`,
					);
					try {
						const updated = await this.applyWriteBatch(
							agent,
							session,
							batch,
							"update",
							options,
						);
						results = updated.results;
					} catch (retryError) {
						// Update retry also failed — fall through to normal error
						// handling below using the retry error.
						error = retryError;
					}
				}

				if (!results) {
					if (isPdsRateLimitError(error)) {
						this.logger.warn(
							`PDS applyWrites: rate limited on batch ${batchLabel}`,
						);
						throw new PdsRateLimitError(getPdsRetryAfterSeconds(error));
					}
					this.logger.warn(
						`PDS applyWrites: batch ${batchLabel} failed: ${getErrorMessage(error)}`,
					);
					const classified = classifyImportWriteError(error);
					for (const pw of batch) {
						failed += 1;
						errors.push({
							index: pw.itemIndex + 1,
							code: "write_failed",
							reason: classified.reason,
							message: classified.message,
						});
					}
					continue;
				}
			}

			const indexed = await this.indexWrittenBatch(userDid, batch, results);
			imported += indexed.imported;
			skipped += indexed.skipped;
			failed += indexed.failed;
			errors.push(...indexed.errors);
		}

		return {
			imported,
			skipped,
			failed,
			errors,
		};
	}

	/**
	 * Phase 1: drop duplicates and build the PDS records. No network calls, so a
	 * whole page is prepared before we spend any of the write budget.
	 */
	private async buildPendingWrites(
		userDid: string,
		items: NormalizedImportItemDto[],
	): Promise<{
		pendingWrites: PendingWrite[];
		skipped: number;
		failed: number;
		errors: ImportErrorDto[];
	}> {
		const pendingWrites: PendingWrite[] = [];
		const dedupeSet = new Set<string>();
		let skipped = 0;
		let failed = 0;
		const errors: ImportErrorDto[] = [];

		for (let index = 0; index < items.length; index++) {
			const item = items[index];
			const dedupeKey = buildImportKey(item);
			if (dedupeSet.has(dedupeKey)) {
				skipped += 1;
				continue;
			}
			dedupeSet.add(dedupeKey);

			if (await this.alreadyImported(userDid, item)) {
				skipped += 1;
				continue;
			}

			if (item.type === "movie" && item.movieTmdbId) {
				const { rkey, record, collection } =
					this.moviesService.buildMovieWatchRecord(
						String(item.movieTmdbId),
						item.watchedAt,
						deterministicMovieWatchRkey(
							String(item.movieTmdbId),
							item.watchedAt,
						),
					);
				pendingWrites.push({
					type: "movie",
					itemIndex: index,
					item,
					rkey,
					record,
					collection,
					movieTmdbId: String(item.movieTmdbId),
				});
				continue;
			}

			if (
				item.type === "episode" &&
				item.showTmdbId &&
				item.seasonNumber !== undefined &&
				item.episodeNumber !== undefined
			) {
				const { rkey, record, collection } =
					this.showsService.buildEpisodeWatchRecord(
						String(item.showTmdbId),
						item.seasonNumber,
						item.episodeNumber,
						item.watchedAt,
						deterministicEpisodeWatchRkey(
							String(item.showTmdbId),
							item.seasonNumber,
							item.episodeNumber,
							item.watchedAt,
						),
					);
				pendingWrites.push({
					type: "episode",
					itemIndex: index,
					item,
					rkey,
					record,
					collection,
					showTmdbId: String(item.showTmdbId),
					seasonNumber: item.seasonNumber,
					episodeNumber: item.episodeNumber,
				});
				continue;
			}

			failed += 1;
			errors.push({
				index: index + 1,
				code: "invalid_item",
				message: "This item is missing required fields.",
			});
		}

		return { pendingWrites, skipped, failed, errors };
	}

	/**
	 * Phase 2: one applyWrites round-trip for the whole batch. `op` is "update"
	 * only on the idempotent re-import path, where the records already exist.
	 */
	private async applyWriteBatch(
		agent: Agent,
		session: ATSession,
		batch: PendingWrite[],
		op: "create" | "update",
		options?: { onRateLimit?: (snapshot: PdsRateLimitSnapshot) => void },
	): Promise<{ results: WriteResult[]; commitCid: string }> {
		const response = await agent.com.atproto.repo.applyWrites({
			repo: session.did,
			writes: batch.map((pw) => ({
				$type: `com.atproto.repo.applyWrites#${op}` as
					| "com.atproto.repo.applyWrites#create"
					| "com.atproto.repo.applyWrites#update",
				collection: pw.collection,
				rkey: pw.rkey,
				value: pw.record as Record<string, unknown>,
			})),
			validate: false,
		});

		reportPdsRateLimit(response.headers, options);

		return {
			commitCid: response.data.commit?.cid ?? "unknown",
			results: batch.map((pw, i) => {
				const result = response.data.results?.[i] as
					| { uri?: string; cid?: string }
					| undefined;
				return {
					uri: result?.uri ?? `at://${session.did}/${pw.collection}/${pw.rkey}`,
					cid: result?.cid ?? "",
				};
			}),
		};
	}

	/**
	 * Phase 3: index each written record (TMDB fetch + DB write). A failure here
	 * is per-item, never fatal for the batch.
	 */
	private async indexWrittenBatch(
		userDid: string,
		batch: PendingWrite[],
		results: WriteResult[],
	): Promise<{
		imported: number;
		skipped: number;
		failed: number;
		errors: ImportErrorDto[];
	}> {
		let imported = 0;
		let skipped = 0;
		let failed = 0;
		const errors: ImportErrorDto[] = [];

		for (let i = 0; i < batch.length; i++) {
			const pw = batch[i];
			const { uri, cid } = results[i];
			try {
				if (pw.type === "movie") {
					await this.moviesService.indexTrackedMovie(
						uri,
						cid,
						pw.rkey,
						userDid,
						pw.movieTmdbId,
						pw.item.watchedAt,
					);
				} else {
					await this.showsService.indexTrackedEpisode(
						uri,
						cid,
						pw.rkey,
						userDid,
						pw.showTmdbId,
						pw.seasonNumber,
						pw.episodeNumber,
						pw.item.watchedAt,
					);
				}
				imported += 1;
			} catch (error) {
				const classified = classifyImportWriteError(error);
				this.logger.warn(
					`Failed to index item at index ${pw.itemIndex + 1} (${describeImportItem(pw.item)}): ${classified.rawMessage}`,
				);
				if (classified.reason === "duplicate_record") {
					skipped += 1;
					continue;
				}
				failed += 1;
				errors.push({
					index: pw.itemIndex + 1,
					code: "write_failed",
					reason: classified.reason,
					message: classified.message,
				});
			}
		}

		return { imported, skipped, failed, errors };
	}

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
			const raw = payload[offset] as TraktHistoryPayloadItem | undefined;
			const normalized = normalizeTraktApiItem(payload[offset], sourceIndex);
			const rawType =
				raw?.type === "movie" || raw?.type === "episode" ? raw.type : "unknown";
			const media = rawType === "movie" ? raw?.movie : raw?.show;
			const title = getOptionalStringValue(media?.title);
			const year = getOptionalIntegerValue(media?.year);
			const traktId = getOptionalIdentifierValue(media?.ids?.trakt);
			const traktSlug = getOptionalStringValue(media?.ids?.slug);
			const stableIdentity =
				traktId ?? traktSlug ?? `${title ?? "unknown"}:${year ?? ""}`;
			const traktMediaKey =
				rawType === "movie"
					? `movie:${stableIdentity}`
					: rawType === "episode"
						? `show:${stableIdentity}`
						: undefined;
			const parsedWatchedAt =
				typeof raw?.watched_at === "string" &&
				!Number.isNaN(Date.parse(raw.watched_at))
					? new Date(raw.watched_at)
					: undefined;

			let initialOutcome: RecordedTraktPageItem["initialOutcome"] =
				"couldnt_import";
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
					: await this.alreadyImported(userDid, normalized.item);
				initialOutcome = alreadyOnShelf ? "already_on_shelf" : "pending";
			} else if (
				normalized.skip?.reason === "missing_tmdb_id" &&
				traktMediaKey &&
				parsedWatchedAt &&
				(rawType === "movie" ||
					(rawType === "episode" &&
						Number.isInteger(raw?.episode?.season) &&
						Number.isInteger(raw?.episode?.number)))
			) {
				initialOutcome = "unmatched";
			}

			await this.prisma.traktImportItem.upsert({
				where: { jobId_sourceIndex: { jobId, sourceIndex } },
				create: {
					jobId,
					sourceIndex,
					outcome: initialOutcome,
					mediaType: rawType,
					watchedAt: parsedWatchedAt,
					title,
					year,
					episodeTitle: getOptionalStringValue(raw?.episode?.title),
					seasonNumber: getOptionalIntegerValue(raw?.episode?.season),
					episodeNumber: getOptionalIntegerValue(raw?.episode?.number),
					traktMediaKey,
					traktId,
					traktSlug,
					tmdbId: normalized.item
						? String(
								normalized.item.type === "movie"
									? normalized.item.movieTmdbId
									: normalized.item.showTmdbId,
							)
						: undefined,
					reason: normalized.skip?.reason,
					message: normalized.skip?.message,
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
			const createdWatchRkey =
				entry.item.type === "movie"
					? deterministicMovieWatchRkey(
							String(entry.item.movieTmdbId),
							entry.item.watchedAt,
						)
					: deterministicEpisodeWatchRkey(
							String(entry.item.showTmdbId),
							entry.item.seasonNumber ?? 0,
							entry.item.episodeNumber ?? 0,
							entry.item.watchedAt,
						);

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

	private async processTraktImportJob(jobId: string): Promise<void> {
		const job = await this.prisma.backgroundJob.findUnique({
			where: { id: jobId },
		});
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

		const session = await this.restoreImportSession(job.userDid);
		if (!session) {
			await this.failTraktImportJob(
				job.id,
				"Your sign-in session expired. Please sign in again and retry the import.",
			);
			return;
		}

		await this.prisma.backgroundJob.update({
			where: { id: job.id },
			data: {
				status: "running",
				startedAt: job.startedAt ?? new Date(),
				lastError: null,
			},
		});

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
			const importResult = await this.importNormalizedItems(
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

			await this.prisma.backgroundJob.update({
				where: { id: job.id },
				data: {
					status: isComplete
						? "completed"
						: lowBudget
							? "waiting_retry"
							: "running",
					data: updatedData,
					lastError: lowBudget
						? `Pausing so your account stays under its PDS write limit. Retrying in ${formatRetryDelay(throttleSeconds)}.`
						: null,
					nextRunAt: isComplete
						? new Date()
						: lowBudget
							? new Date(Date.now() + throttleSeconds * 1000)
							: new Date(Date.now() + TRAKT_PAGE_DELAY_MS),
					completedAt: isComplete ? new Date() : null,
				},
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
				await this.prisma.backgroundJob.update({
					where: { id: job.id },
					data: {
						status: "waiting_retry",
						nextRunAt: new Date(Date.now() + retryAfterSeconds * 1000),
						lastError: `PDS rate limit reached. Retrying in ${formatRetryDelay(retryAfterSeconds)}.`,
					},
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
				await this.prisma.backgroundJob.update({
					where: { id: job.id },
					data: {
						status: "waiting_retry",
						data: { ...jobData, rateLimitRetries: retryCount + 1 },
						nextRunAt: new Date(Date.now() + retryAfterSeconds * 1000),
						lastError: `Trakt rate limit reached. Retrying in ${formatRetryDelay(retryAfterSeconds)}.`,
					},
				});
				return;
			}

			if (error instanceof TraktApiError) {
				await this.failTraktImportJob(job.id, error.message);
				return;
			}

			await this.failTraktImportJob(job.id, getErrorMessage(error));
		}
	}

	private async failTraktImportJob(
		jobId: string,
		message?: string,
	): Promise<void> {
		await this.prisma.backgroundJob.update({
			where: { id: jobId },
			data: {
				status: "failed",
				lastError:
					message ||
					"Trakt import failed. Please retry later or use CSV import.",
				completedAt: new Date(),
				nextRunAt: new Date(),
			},
		});
	}

	private async alreadyImported(
		userDid: string,
		item: NormalizedImportItemDto,
	): Promise<boolean> {
		// Pre-check on the deterministic rkey: the same logical watch (item +
		// watchedDate) always maps to the same rkey, so this is correct even
		// after a partial crash. It's purely an optimization — the index write
		// is an idempotent upsert on the same rkey, so a missed pre-check can't
		// produce a duplicate. We additionally scope by userDid as a safety
		// check (rkey is globally unique, but a foreign rkey must never match).
		if (item.type === "movie" && item.movieTmdbId) {
			const rkey = deterministicMovieWatchRkey(
				String(item.movieTmdbId),
				item.watchedAt,
			);
			const existing = await this.prisma.trackedMovie.findFirst({
				where: { userDid, rkey },
				select: { id: true },
			});
			return !!existing;
		}

		if (
			item.type === "episode" &&
			item.showTmdbId &&
			item.seasonNumber !== undefined &&
			item.episodeNumber !== undefined
		) {
			const rkey = deterministicEpisodeWatchRkey(
				String(item.showTmdbId),
				item.seasonNumber,
				item.episodeNumber,
				item.watchedAt,
			);
			const existing = await this.prisma.trackedEpisode.findFirst({
				where: { userDid, rkey },
				select: { id: true },
			});
			return !!existing;
		}

		return false;
	}

	private async findLatestTraktImportJob(
		userDid: string,
		options: { statuses: TraktJobStatus[]; recentSince?: Date },
	) {
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

	async getTraktImportIssues(
		userDid: string,
		page = 1,
		pageSize = 25,
		outcome?: "unmatched" | "couldnt_import",
	): Promise<PaginatedTraktImportIssuesDto> {
		const job = await this.requireTraktImportJob(userDid);
		const safePage = Math.max(1, Math.floor(page));
		const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
		const where = {
			jobId: job.id,
			outcome: outcome ?? { in: ["unmatched", "couldnt_import"] },
		};
		const [items, total] = await Promise.all([
			this.prisma.traktImportItem.findMany({
				where,
				orderBy: { sourceIndex: "asc" },
				skip: (safePage - 1) * safePageSize,
				take: safePageSize,
			}),
			this.prisma.traktImportItem.count({ where }),
		]);
		return {
			items: items.map((item) => mapTraktImportIssue(item)),
			total,
			page: safePage,
			pageSize: safePageSize,
		};
	}

	async getTraktMatchCandidates(
		userDid: string,
		matchKey: string,
		query?: string,
	): Promise<TraktMatchCandidateDto[]> {
		const job = await this.requireTraktImportJob(userDid);
		const source = await this.prisma.traktImportItem.findFirst({
			where: { jobId: job.id, traktMediaKey: matchKey, outcome: "unmatched" },
			orderBy: { sourceIndex: "asc" },
		});
		if (!source) throw new NotFoundException("Unmatched Trakt title not found");
		const searchQuery = query?.trim() || source.title || "";
		if (!searchQuery) return [];

		if (source.mediaType === "movie") {
			const response = await this.moviesService.searchMovies(searchQuery);
			return response.results
				.sort(
					(a, b) =>
						candidateYearScore(b.release_date, source.year) -
						candidateYearScore(a.release_date, source.year),
				)
				.slice(0, 10)
				.map((movie) => ({
					tmdbId: String(movie.id),
					mediaType: "movie" as const,
					title: movie.title,
					year: yearFromDate(movie.release_date),
					posterPath: movie.poster_path,
					overview: movie.overview,
				}));
		}

		const response = await this.showsService.searchShows(searchQuery);
		return response.results
			.sort(
				(a, b) =>
					candidateYearScore(b.first_air_date, source.year) -
					candidateYearScore(a.first_air_date, source.year),
			)
			.slice(0, 10)
			.map((show) => ({
				tmdbId: String(show.id),
				mediaType: "show" as const,
				title: show.name,
				year: yearFromDate(show.first_air_date),
				posterPath: show.poster_path,
				overview: show.overview,
			}));
	}

	async confirmTraktMatch(
		userDid: string,
		matchKey: string,
		tmdbId: string,
	): Promise<TraktImportJobDto> {
		const job = await this.requireTraktImportJob(userDid);
		const rows = await this.prisma.traktImportItem.findMany({
			where: { jobId: job.id, traktMediaKey: matchKey, outcome: "unmatched" },
			orderBy: { sourceIndex: "asc" },
		});
		if (rows.length === 0)
			throw new NotFoundException("Unmatched Trakt title not found");
		const session = await this.restoreImportSession(userDid);
		if (!session) throw new BadRequestException("Your sign-in session expired");
		const mediaType = rows[0].mediaType === "movie" ? "movie" : "show";
		await this.prisma.traktImportMatch.upsert({
			where: { jobId_matchKey: { jobId: job.id, matchKey } },
			create: { jobId: job.id, matchKey, mediaType, tmdbId },
			update: { tmdbId, confirmedAt: new Date() },
		});

		for (const row of rows) {
			if (!row.watchedAt) {
				await this.markTraktItemCouldntImport(
					row.id,
					"invalid_watched_at",
					"Missing watch date",
				);
				continue;
			}
			const item: NormalizedImportItemDto | null =
				row.mediaType === "movie"
					? {
							type: "movie",
							movieTmdbId: Number(tmdbId),
							watchedAt: row.watchedAt.toISOString(),
						}
					: row.seasonNumber !== null && row.episodeNumber !== null
						? {
								type: "episode",
								showTmdbId: Number(tmdbId),
								seasonNumber: row.seasonNumber,
								episodeNumber: row.episodeNumber,
								watchedAt: row.watchedAt.toISOString(),
							}
						: null;
			if (!item || !Number.isInteger(Number(tmdbId)) || Number(tmdbId) <= 0) {
				await this.markTraktItemCouldntImport(
					row.id,
					"invalid_match",
					"The selected TMDB item is invalid",
				);
				continue;
			}
			const result = await this.importNormalizedItems(userDid, session, [item]);
			if (result.imported > 0) {
				await this.prisma.traktImportItem.update({
					where: { id: row.id },
					data: {
						outcome: "imported",
						tmdbId,
						reason: null,
						message: null,
						createdWatchRkey:
							item.type === "movie"
								? deterministicMovieWatchRkey(tmdbId, item.watchedAt)
								: deterministicEpisodeWatchRkey(
										tmdbId,
										item.seasonNumber ?? 0,
										item.episodeNumber ?? 0,
										item.watchedAt,
									),
					},
				});
			} else if (result.skipped > 0) {
				await this.prisma.traktImportItem.update({
					where: { id: row.id },
					data: {
						outcome: "already_on_shelf",
						tmdbId,
						reason: null,
						message: null,
					},
				});
			} else {
				const error = result.errors[0];
				await this.markTraktItemCouldntImport(
					row.id,
					error?.reason ?? error?.code ?? "write_failed",
					error?.message ?? "This Watch could not be added",
				);
			}
		}

		return this.getRequiredCurrentTraktImport(userDid);
	}

	async rejectTraktMatch(
		userDid: string,
		matchKey: string,
	): Promise<TraktImportJobDto> {
		const job = await this.requireTraktImportJob(userDid);
		await this.prisma.traktImportItem.updateMany({
			where: { jobId: job.id, traktMediaKey: matchKey, outcome: "unmatched" },
			data: {
				outcome: "couldnt_import",
				reason: "no_tmdb_match",
				message: "You confirmed that no matching TMDB item exists.",
			},
		});
		return this.getRequiredCurrentTraktImport(userDid);
	}

	private async mapTraktImportJobWithIssues(
		job: NonNullable<BackgroundJobRecord>,
	): Promise<TraktImportJobDto> {
		const [items, issueRows] = await Promise.all([
			this.prisma.traktImportItem.findMany({
				where: { jobId: job.id },
				orderBy: { sourceIndex: "asc" },
			}),
			this.prisma.traktImportItem.findMany({
				where: {
					jobId: job.id,
					outcome: { in: ["unmatched", "couldnt_import"] },
				},
				orderBy: { sourceIndex: "asc" },
				take: 25,
			}),
		]);
		const base = mapTraktImportJob(job);
		const importedCount = items.filter(
			(item) => item.outcome === "imported",
		).length;
		const alreadyOnShelfCount = items.filter(
			(item) => item.outcome === "already_on_shelf",
		).length;
		const unmatchedItems = items.filter((item) => item.outcome === "unmatched");
		const couldntImportCount = items.filter(
			(item) => item.outcome === "couldnt_import",
		).length;
		const groups = new Map<
			string,
			TraktImportJobDto["unmatchedGroups"][number]
		>();
		for (const item of unmatchedItems) {
			if (!item.traktMediaKey) continue;
			const existing = groups.get(item.traktMediaKey);
			if (existing) {
				existing.watchCount += 1;
				if (item.watchedAt)
					existing.watchedAt.push(item.watchedAt.toISOString());
				continue;
			}
			groups.set(item.traktMediaKey, {
				matchKey: item.traktMediaKey,
				mediaType: item.mediaType === "movie" ? "movie" : "show",
				title: item.title ?? "Untitled",
				year: item.year ?? undefined,
				watchCount: 1,
				watchedAt: item.watchedAt ? [item.watchedAt.toISOString()] : [],
			});
		}
		return {
			...base,
			sourceCount: items.length || base.sourceCount,
			// Jobs created before durable outcome rows were introduced retain their
			// aggregate counters. New jobs derive all result counts from the complete
			// item ledger so matching changes are reflected immediately.
			importedCount: items.length ? importedCount : base.importedCount,
			skippedCount: items.length ? alreadyOnShelfCount : base.skippedCount,
			failedCount: items.length ? couldntImportCount : base.failedCount,
			alreadyOnShelfCount: items.length
				? alreadyOnShelfCount
				: base.alreadyOnShelfCount,
			unmatchedCount: items.length
				? unmatchedItems.length
				: base.unmatchedCount,
			couldntImportCount: items.length
				? couldntImportCount
				: base.couldntImportCount,
			issuesPreview: issueRows.map((item) => mapTraktImportIssue(item)),
			unmatchedGroups: [...groups.values()],
		};
	}

	private async requireTraktImportJob(userDid: string) {
		const job = await this.prisma.backgroundJob.findFirst({
			where: { type: TRAKT_IMPORT_JOB_TYPE, userDid },
			orderBy: { createdAt: "desc" },
		});
		if (!job) throw new NotFoundException("Trakt import not found");
		return job;
	}

	private async getRequiredCurrentTraktImport(
		userDid: string,
	): Promise<TraktImportJobDto> {
		const job = await this.getCurrentTraktImport(userDid);
		if (!job) throw new NotFoundException("Trakt import not found");
		return job;
	}

	private async markTraktItemCouldntImport(
		id: string,
		reason: string,
		message: string,
	): Promise<void> {
		await this.prisma.traktImportItem.update({
			where: { id },
			data: { outcome: "couldnt_import", reason, message },
		});
	}

	private async restoreImportSession(
		userDid: string,
	): Promise<ATSession | null> {
		try {
			const session = await this.authService.restore(userDid);
			return session ? (session as unknown as ATSession) : null;
		} catch (error) {
			this.logger.warn(
				`Failed to restore auth session for ${userDid}: ${getErrorMessage(error)}`,
			);
			return null;
		}
	}
}
