import { Agent } from "@atproto/api";
import {
	BadRequestException,
	HttpException,
	HttpStatus,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
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
	StartTraktImportResponseDto,
	TraktHistoryPreviewItemDto,
	TraktImportJobDto,
	TraktPublicProfileDto,
} from "./dto/import-history.dto";
import type { AuthService } from "../auth/auth.service";
import {
	TRAKT_IMPORT_JOB_TYPE,
	buildTraktImportData,
	parseTraktImportData,
	type TraktImportJobData,
} from "./background-job-data";

interface ATSession {
	did: string;
}

type TraktProfilePayload = {
	username?: unknown;
	name?: unknown;
	private?: unknown;
	vip?: unknown;
	ids?: {
		slug?: unknown;
	};
	images?: {
		avatar?: {
			full?: unknown;
			medium?: unknown;
			thumb?: unknown;
		};
	};
};

type TraktHistoryPayloadItem = {
	type?: unknown;
	action?: unknown;
	watched_at?: unknown;
	movie?: {
		title?: unknown;
		year?: unknown;
		ids?: {
			tmdb?: unknown;
		};
	};
	show?: {
		title?: unknown;
		year?: unknown;
		ids?: {
			tmdb?: unknown;
		};
	};
	episode?: {
		season?: unknown;
		number?: unknown;
		title?: unknown;
	};
};

type TraktJobStatus =
	| "queued"
	| "running"
	| "waiting_retry"
	| "completed"
	| "failed";

type ImportWriteFailureReason =
	| "duplicate_record"
	| "metadata_unavailable"
	| "upstream_write_failed"
	| "unknown";

type ClassifiedImportWriteError = {
	reason: ImportWriteFailureReason;
	message: string;
	rawMessage: string;
};

type PdsRateLimitSnapshot = {
	/** Points remaining in the current (binding) repo-write window. */
	remaining?: number;
	/** Unix epoch (seconds) when that window resets. */
	reset?: number;
};

type BackgroundJobRecord = Awaited<
	ReturnType<PrismaService["backgroundJob"]["findFirst"]>
>;

const TRAKT_HISTORY_PAGE_SIZE = 100;
const TRAKT_PREVIEW_ITEM_LIMIT = 5;
const TRAKT_PREVIEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVE_TRAKT_JOB_STATUSES: TraktJobStatus[] = [
	"queued",
	"running",
	"waiting_retry",
];
const RECENT_TERMINAL_JOB_WINDOW_MS = 15 * 60 * 1000;
// A job stuck in "running" longer than this was almost certainly orphaned by a
// process crash (the worker is single-instance, so no other instance owns it).
const STALE_RUNNING_MS = 5 * 60 * 1000;
const TRAKT_RATE_LIMIT_BACKOFF_SECONDS = [60, 300, 600]; // 1min, 5min, 10min, then +5min each time
const TRAKT_PAGE_DELAY_MS = 800;
const PDS_APPLY_WRITES_BATCH_SIZE = 200;
const PDS_RETRY_FALLBACK_SECONDS = 60;
// PDS repo writes have BOTH an hourly and a daily budget. When the daily budget
// (atproto: ~35k points/day) is exhausted, ratelimit-reset points at the next
// day rollover — up to ~24h out. Cap at 25h (24h + 1h margin) so clock skew or a
// window measured slightly past 24h can't clip a legitimate reset and re-trip us.
// A 1h cap made us wake hourly, re-trip the still-empty daily budget, and
// busy-loop forever without progress.
const PDS_RETRY_MAX_SECONDS = 25 * 60 * 60;
// Leave at least this many repo-write points unspent in the current window so
// the user's own interactive writes (rate, review, mark-watched) are never
// starved by a background import — they share one per-account PDS budget. We
// read the live `ratelimit-remaining` after each batch and pause until the
// window resets once it drops below this. A page costs ≤300 points (≤100
// creates × 3), so pausing at 1000 both avoids tripping the next 429 and keeps
// ~300 writes of headroom for the user.
// ponytail: fixed reserve; revisit only if the PDS exposes per-route budgets.
const PDS_WRITE_RESERVE_POINTS = 1000;

/**
 * Humanize a retry delay for user-facing status messages. Rate-limit waits can
 * be many minutes now (PDS write budgets refill hourly), so raw seconds —
 * "Retrying in 2717 seconds" — read badly.
 */
function formatRetryDelay(totalSeconds: number): string {
	const s = Math.max(0, Math.round(totalSeconds));
	if (s < 60) return `${s} second${s === 1 ? "" : "s"}`;
	const minutes = Math.round(s / 60);
	if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
	const hours = Math.floor(minutes / 60);
	const remMinutes = minutes % 60;
	const hourPart = `${hours} hour${hours === 1 ? "" : "s"}`;
	return remMinutes > 0
		? `${hourPart} ${remMinutes} minute${remMinutes === 1 ? "" : "s"}`
		: hourPart;
}

class TraktApiError extends Error {
	constructor(
		message: string,
		public readonly status: number,
		public readonly retryAfterSeconds?: number,
	) {
		super(message);
	}
}

class PdsRateLimitError extends Error {
	constructor(public readonly retryAfterSeconds?: number) {
		super("PDS rate limit reached");
	}
}

@Injectable()
export class ImportHistoryService {
	private readonly logger = new Logger(ImportHistoryService.name);
	private readonly traktApiKey: string;
	private readonly traktBaseUrl = "https://api.trakt.tv";
	private readonly traktUserAgent = "Opnshelf/1.0 (+https://opnshelf.xyz)";
	private readonly allowedActions = new Set(["watch", "scrobble", "checkin"]);

	constructor(
		private readonly prisma: PrismaService,
		private readonly moviesService: MoviesService,
		private readonly showsService: ShowsService,
		private readonly configService: ConfigService,
		@Inject(AUTH_SERVICE)
		private readonly authService: Pick<AuthService, "restore">,
	) {
		this.traktApiKey = this.configService.get<string>("TRAKT_API_KEY") ?? "";
	}

	async fetchTraktPublicHistory(
		username: string,
	): Promise<FetchTraktPublicHistoryResponseDto> {
		try {
			this.ensureTraktConfigured();

			const normalizedUsername = this.normalizeUsername(username);
			const profile = await this.fetchTraktPublicProfile(normalizedUsername);
			const startAt = new Date(Date.now() - TRAKT_PREVIEW_WINDOW_MS);
			let page = 1;
			let pageCount = Number.POSITIVE_INFINITY;
			const items: NormalizedImportItemDto[] = [];
			const skipped: ImportSkipDto[] = [];
			const previewItems: TraktHistoryPreviewItemDto[] = [];

			while (page <= pageCount) {
				const pageResult = await this.fetchTraktHistoryPage(
					normalizedUsername,
					page,
					{ startAt },
				);
				pageCount = pageResult.pageCount ?? pageCount;
				const baseIndex = items.length + skipped.length + 1;

				for (let i = 0; i < pageResult.payload.length; i++) {
					const result = this.normalizeTraktApiItem(
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
			throw this.toPublicTraktException(error);
		}
	}

	async startTraktImport(
		userDid: string,
		username: string,
	): Promise<StartTraktImportResponseDto> {
		try {
			this.ensureTraktConfigured();
			const normalizedUsername = this.normalizeUsername(username);
			const existingJob = await this.findLatestTraktImportJob(userDid, {
				statuses: ACTIVE_TRAKT_JOB_STATUSES,
			});

			if (existingJob) {
				const existingData = parseTraktImportData(existingJob.data);
				const existingProfile = this.buildProfileFromJobData(existingData);
				const preview = await this.fetchTraktPreview(
					existingData.traktUsername,
				).catch((error: unknown) => {
					this.logger.warn(
						`Unable to refresh Trakt preview for existing job ${existingJob.id}: ${this.getErrorMessage(error)}`,
					);
					return {
						profile: existingProfile,
						previewItems: [] as TraktHistoryPreviewItemDto[],
						sourcePreviewCount: 0,
					};
				});

				return {
					profile: preview.profile,
					previewItems: preview.previewItems,
					sourcePreviewCount: preview.sourcePreviewCount,
					job: this.mapTraktImportJob(existingJob),
				};
			}

			const preview = await this.fetchTraktPreview(normalizedUsername);
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
				job: this.mapTraktImportJob(job),
			};
		} catch (error) {
			throw this.toPublicTraktException(error);
		}
	}

	async getCurrentTraktImport(
		userDid: string,
	): Promise<TraktImportJobDto | null> {
		const activeJob = await this.findLatestTraktImportJob(userDid, {
			statuses: ACTIVE_TRAKT_JOB_STATUSES,
		});
		if (activeJob) {
			return this.mapTraktImportJob(activeJob);
		}

		const recentTerminalJob = await this.prisma.backgroundJob.findFirst({
			where: {
				type: TRAKT_IMPORT_JOB_TYPE,
				userDid,
				status: { in: ["completed", "failed"] },
				updatedAt: {
					gte: new Date(Date.now() - RECENT_TERMINAL_JOB_WINDOW_MS),
				},
			},
			orderBy: [
				{ completedAt: "desc" },
				{ updatedAt: "desc" },
				{ createdAt: "desc" },
			],
		});

		return recentTerminalJob ? this.mapTraktImportJob(recentTerminalJob) : null;
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

		let imported = 0;
		let skipped = 0;
		let failed = 0;
		const errors: ImportErrorDto[] = [];
		const dedupeSet = new Set<string>();

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

		// Phase 1: filter duplicates and build PDS records (no network calls)
		const pendingWrites: PendingWrite[] = [];

		for (let index = 0; index < items.length; index++) {
			const item = items[index];
			const dedupeKey = this.buildImportKey(item);
			if (dedupeSet.has(dedupeKey)) {
				skipped += 1;
				continue;
			}
			dedupeSet.add(dedupeKey);

			const alreadyImported = await this.alreadyImported(userDid, item);
			if (alreadyImported) {
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

			type WriteResult = { uri: string; cid: string };
			let batchResults: WriteResult[];

			this.logger.debug(
				`PDS applyWrites: sending batch of ${batch.length} records (items ${batchStart + 1}–${batchStart + batch.length}) to ${session.did}`,
			);
			try {
				const response = await agent.com.atproto.repo.applyWrites({
					repo: session.did,
					writes: batch.map((pw) => ({
						$type: "com.atproto.repo.applyWrites#create" as const,
						collection: pw.collection,
						rkey: pw.rkey,
						value: pw.record as Record<string, unknown>,
					})),
					validate: false,
				});
				this.logger.debug(
					`PDS applyWrites: batch of ${batch.length} succeeded (commit ${response.data.commit?.cid ?? "unknown"})`,
				);
				this.reportPdsRateLimit(response.headers, options);
				batchResults = batch.map((pw, i) => {
					const result = response.data.results?.[i] as
						| { uri?: string; cid?: string }
						| undefined;
					return {
						uri:
							result?.uri ?? `at://${session.did}/${pw.collection}/${pw.rkey}`,
						cid: result?.cid ?? "",
					};
				});
			} catch (writeError) {
				let error: unknown = writeError;
				// Crash-recovery / idempotent re-import: rkeys are deterministic
				// content hashes, so if a previous run wrote these records to the
				// PDS but died before the DB write, the `create` batch fails with
				// "record already exists". Retry the same batch as `update` ops —
				// the record at that rkey is byte-identical, so this is an
				// idempotent overwrite. Keeps batching (one extra round-trip per
				// affected batch, not per item).
				if (
					!this.isPdsRateLimitError(error) &&
					this.isRecordExistsError(error)
				) {
					this.logger.debug(
						`PDS applyWrites: batch ${batchStart + 1}–${batchStart + batch.length} already exists, retrying as update (idempotent re-import)`,
					);
					try {
						const response = await agent.com.atproto.repo.applyWrites({
							repo: session.did,
							writes: batch.map((pw) => ({
								$type: "com.atproto.repo.applyWrites#update" as const,
								collection: pw.collection,
								rkey: pw.rkey,
								value: pw.record as Record<string, unknown>,
							})),
							validate: false,
						});
						batchResults = batch.map((pw, i) => {
							const result = response.data.results?.[i] as
								| { uri?: string; cid?: string }
								| undefined;
							return {
								uri:
									result?.uri ??
									`at://${session.did}/${pw.collection}/${pw.rkey}`,
								cid: result?.cid ?? "",
							};
						});
						this.reportPdsRateLimit(response.headers, options);
						// Fall through to indexing with the update results.
						for (let i = 0; i < batch.length; i++) {
							const pw = batch[i];
							const { uri, cid } = batchResults[i];
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
							} catch (indexError) {
								const itemContext = this.describeImportItem(pw.item);
								const classified = this.classifyImportWriteError(indexError);
								this.logger.warn(
									`Failed to index item at index ${pw.itemIndex + 1} (${itemContext}): ${classified.rawMessage}`,
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
						continue;
					} catch (retryError) {
						// Update retry also failed — fall through to normal error
						// handling below using the retry error.
						error = retryError;
					}
				}
				if (this.isPdsRateLimitError(error)) {
					this.logger.warn(
						`PDS applyWrites: rate limited on batch ${batchStart + 1}–${batchStart + batch.length}`,
					);
					throw new PdsRateLimitError(this.getPdsRetryAfterSeconds(error));
				}
				const errMsg = this.getErrorMessage(error);
				this.logger.warn(
					`PDS applyWrites: batch ${batchStart + 1}–${batchStart + batch.length} failed: ${errMsg}`,
				);
				const classified = this.classifyImportWriteError(error);
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

			// Phase 3: index each result (TMDB fetch + DB write)
			for (let i = 0; i < batch.length; i++) {
				const pw = batch[i];
				const { uri, cid } = batchResults[i];
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
					const itemContext = this.describeImportItem(pw.item);
					const classified = this.classifyImportWriteError(error);
					this.logger.warn(
						`Failed to index item at index ${pw.itemIndex + 1} (${itemContext}): ${classified.rawMessage}`,
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
		}

		return {
			imported,
			skipped,
			failed,
			errors,
		};
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
			const pageResult = await this.fetchTraktHistoryPage(
				jobData.traktUsername,
				jobData.currentPage,
			);
			const totalPages =
				pageResult.pageCount ?? jobData.totalPages ?? jobData.currentPage;
			const normalized = this.normalizeTraktPage(
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
			const nextPage = jobData.currentPage + 1;
			const hasKnownTotalPages =
				Number.isInteger(totalPages) && totalPages >= 1;
			const isComplete =
				pageResult.payload.length === 0 ||
				(hasKnownTotalPages
					? nextPage > totalPages
					: pageResult.payload.length < TRAKT_HISTORY_PAGE_SIZE);

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
				failedCount: jobData.failedCount + importResult.failed,
			};

			// Pace the import against the live repo-write budget: import and user
			// share one per-account PDS limit, so when remaining points drop below
			// the reserve we pause until the window resets rather than draining it
			// and locking the user out of their own account.
			const lowBudget =
				!isComplete &&
				rateLimit?.remaining !== undefined &&
				rateLimit.remaining < PDS_WRITE_RESERVE_POINTS;
			const throttleSeconds = lowBudget
				? this.secondsUntilPdsReset(rateLimit)
				: 0;
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

			await this.failTraktImportJob(job.id, this.getErrorMessage(error));
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

	private async fetchTraktPreview(username: string): Promise<{
		profile: TraktPublicProfileDto;
		previewItems: TraktHistoryPreviewItemDto[];
		sourcePreviewCount: number;
	}> {
		const profile = await this.fetchTraktPublicProfile(username);
		const pageResult = await this.fetchTraktHistoryPage(username, 1);
		const normalized = this.normalizeTraktPage(pageResult.payload, 1);

		return {
			profile,
			previewItems: normalized.previewItems,
			sourcePreviewCount: pageResult.payload.length,
		};
	}

	private normalizeTraktPage(
		payload: unknown[],
		startIndex: number,
	): {
		items: NormalizedImportItemDto[];
		skipped: ImportSkipDto[];
		previewItems: TraktHistoryPreviewItemDto[];
	} {
		const items: NormalizedImportItemDto[] = [];
		const skipped: ImportSkipDto[] = [];
		const previewItems: TraktHistoryPreviewItemDto[] = [];

		for (let index = 0; index < payload.length; index++) {
			const result = this.normalizeTraktApiItem(
				payload[index],
				startIndex + index,
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

		return { items, skipped, previewItems };
	}

	private normalizeTraktApiItem(
		rawItem: unknown,
		index: number,
	): {
		item?: NormalizedImportItemDto;
		skip?: ImportSkipDto;
		previewItem?: TraktHistoryPreviewItemDto;
	} {
		if (!rawItem || typeof rawItem !== "object") {
			return {
				skip: {
					index,
					reason: "unsupported_type",
					message: "Invalid item format",
				},
			};
		}

		const item = rawItem as TraktHistoryPayloadItem;
		const action =
			typeof item.action === "string" ? (item.action as string) : "watch";
		if (!this.allowedActions.has(action)) {
			return {
				skip: {
					index,
					reason: "unsupported_action",
					message: `Unsupported action: ${String(item.action ?? "unknown")}`,
				},
			};
		}

		const normalizedAction = action as "watch" | "scrobble" | "checkin";
		if (
			typeof item.watched_at !== "string" ||
			Number.isNaN(Date.parse(item.watched_at))
		) {
			return {
				skip: {
					index,
					reason: "invalid_watched_at",
					message: "Missing or invalid watched_at timestamp",
				},
			};
		}

		const watchedAt = new Date(item.watched_at).toISOString();

		if (item.type === "movie") {
			const tmdbId = item.movie?.ids?.tmdb;
			if (
				typeof tmdbId !== "number" ||
				!Number.isInteger(tmdbId) ||
				tmdbId < 1
			) {
				return {
					skip: {
						index,
						reason: "missing_tmdb_id",
						message: "Movie item is missing a TMDB id",
					},
				};
			}

			return {
				item: {
					type: "movie",
					movieTmdbId: tmdbId,
					action: normalizedAction,
					watchedAt,
				},
				previewItem: {
					type: "movie",
					title: this.getStringValue(item.movie?.title, "Untitled movie"),
					subtitle: this.buildMovieSubtitle(item.movie?.year),
					watchedAt,
				},
			};
		}

		if (item.type === "episode") {
			const tmdbId = item.show?.ids?.tmdb;
			const seasonNumber = item.episode?.season;
			const episodeNumber = item.episode?.number;

			if (
				typeof tmdbId !== "number" ||
				!Number.isInteger(tmdbId) ||
				tmdbId < 1
			) {
				return {
					skip: {
						index,
						reason: "missing_tmdb_id",
						message: "Episode item is missing a show TMDB id",
					},
				};
			}

			if (
				typeof seasonNumber !== "number" ||
				typeof episodeNumber !== "number" ||
				!Number.isInteger(seasonNumber) ||
				!Number.isInteger(episodeNumber) ||
				seasonNumber < 0 ||
				episodeNumber < 1
			) {
				return {
					skip: {
						index,
						reason: "missing_episode_ref",
						message: "Episode item is missing season and episode numbers",
					},
				};
			}

			return {
				item: {
					type: "episode",
					showTmdbId: tmdbId,
					seasonNumber,
					episodeNumber,
					action: normalizedAction,
					watchedAt,
				},
				previewItem: {
					type: "episode",
					title: this.getStringValue(item.show?.title, "Untitled show"),
					subtitle: this.buildEpisodeSubtitle(
						seasonNumber,
						episodeNumber,
						item.episode?.title,
					),
					watchedAt,
				},
			};
		}

		return {
			skip: {
				index,
				reason: "unsupported_type",
				message: `Unsupported item type: ${String(item.type ?? "unknown")}`,
			},
		};
	}

	private async fetchTraktHistoryPage(
		username: string,
		page: number,
		options?: { startAt?: Date },
	): Promise<{ payload: unknown[]; pageCount?: number }> {
		const url = this.createTraktUrl(
			`/users/${encodeURIComponent(username)}/history`,
		);
		url.searchParams.set("page", String(page));
		url.searchParams.set("limit", String(TRAKT_HISTORY_PAGE_SIZE));
		if (options?.startAt) {
			url.searchParams.set("start_at", options.startAt.toISOString());
		}

		const { data, headers } =
			await this.fetchTraktJsonWithHeaders<unknown>(url);
		if (!Array.isArray(data)) {
			throw new BadRequestException("Unexpected Trakt response format");
		}

		return {
			payload: data,
			pageCount: this.parsePaginationPageCount(headers),
		};
	}

	private buildImportKey(item: NormalizedImportItemDto): string {
		if (item.type === "movie") {
			return `movie:${item.movieTmdbId}:${item.watchedAt}`;
		}
		return `episode:${item.showTmdbId}:${item.seasonNumber}:${item.episodeNumber}:${item.watchedAt}`;
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

	private describeImportItem(item: NormalizedImportItemDto): string {
		const watchedAt = item.watchedAt;
		const action = item.action ?? "watch";

		if (item.type === "movie") {
			return `movie tmdb=${item.movieTmdbId ?? "unknown"}, watchedAt=${watchedAt}, action=${action}`;
		}

		return `episode showTmdb=${item.showTmdbId ?? "unknown"}, season=${item.seasonNumber ?? "unknown"}, episode=${item.episodeNumber ?? "unknown"}, watchedAt=${watchedAt}, action=${action}`;
	}

	private createTraktUrl(pathname: string): URL {
		return new URL(pathname, this.traktBaseUrl);
	}

	private async fetchTraktPublicProfile(
		username: string,
	): Promise<TraktPublicProfileDto> {
		const url = this.createTraktUrl(
			`/users/${encodeURIComponent(username)}?extended=full`,
		);
		const payload = await this.fetchTraktJson<unknown>(url);

		if (!payload || typeof payload !== "object") {
			throw new BadRequestException("Unexpected Trakt profile format");
		}

		return this.mapTraktProfilePayload(
			payload as TraktProfilePayload,
			username,
		);
	}

	private mapTraktProfilePayload(
		profile: TraktProfilePayload,
		fallbackUsername: string,
	): TraktPublicProfileDto {
		return {
			username: this.getStringValue(profile.username, fallbackUsername),
			slug: this.getStringValue(profile.ids?.slug, fallbackUsername),
			name: this.getOptionalStringValue(profile.name),
			isPrivate: profile.private === true,
			isVip: profile.vip === true,
			avatarUrl: this.resolveTraktAvatarUrl(profile.images?.avatar),
		};
	}

	private async fetchTraktJson<T>(url: URL): Promise<T> {
		const { data } = await this.fetchTraktJsonWithHeaders<T>(url);
		return data;
	}

	private async fetchTraktJsonWithHeaders<T>(
		url: URL,
	): Promise<{ data: T; headers: Headers }> {
		const response = await fetch(url.toString(), {
			headers: {
				"trakt-api-key": this.traktApiKey,
				"trakt-api-version": "2",
				"User-Agent": this.traktUserAgent,
			},
			signal: AbortSignal.timeout(12_000),
		});

		if (response.status === 404) {
			throw new TraktApiError("Trakt user not found", 404);
		}
		if (response.status === 401 || response.status === 403) {
			throw new TraktApiError(
				"Trakt profile is private or unavailable. Try CSV import instead.",
				response.status,
			);
		}
		if (response.status === 429) {
			throw new TraktApiError(
				"Trakt rate limit reached. We will retry in the background shortly.",
				429,
				this.parseRetryAfterSeconds(response.headers),
			);
		}
		if (response.status >= 500) {
			throw new TraktApiError(
				"Trakt is temporarily unavailable. Please retry later or use CSV import.",
				response.status,
			);
		}
		if (!response.ok) {
			throw new TraktApiError(
				"Failed to fetch Trakt public history",
				response.status,
			);
		}

		return {
			data: (await response.json()) as T,
			headers: response.headers ?? new Headers(),
		};
	}

	private parsePaginationPageCount(headers: Headers): number | undefined {
		const rawValue = headers.get("x-pagination-page-count");
		if (!rawValue) {
			return undefined;
		}

		const parsed = Number.parseInt(rawValue, 10);
		if (!Number.isInteger(parsed) || parsed < 1) {
			return undefined;
		}

		return parsed;
	}

	private parseRetryAfterSeconds(headers: Headers): number | undefined {
		const rawValue = headers.get("retry-after");
		if (!rawValue) {
			return undefined;
		}

		const parsed = Number.parseInt(rawValue, 10);
		if (!Number.isInteger(parsed) || parsed < 1) {
			return undefined;
		}

		return parsed;
	}

	private getStringValue(value: unknown, fallback: string): string {
		return typeof value === "string" && value.trim() ? value.trim() : fallback;
	}

	private getOptionalStringValue(value: unknown): string | undefined {
		if (typeof value !== "string") {
			return undefined;
		}
		const trimmed = value.trim();
		return trimmed ? trimmed : undefined;
	}

	private resolveTraktAvatarUrl(
		avatar:
			| {
					full?: unknown;
					medium?: unknown;
					thumb?: unknown;
			  }
			| undefined,
	): string | undefined {
		const candidate =
			this.getOptionalStringValue(avatar?.full) ??
			this.getOptionalStringValue(avatar?.medium) ??
			this.getOptionalStringValue(avatar?.thumb);

		if (!candidate) {
			return undefined;
		}

		if (candidate.startsWith("//")) {
			return `https:${candidate}`;
		}

		if (candidate.startsWith("http://")) {
			return `https://${candidate.slice("http://".length)}`;
		}

		return candidate;
	}

	private buildMovieSubtitle(year: unknown): string {
		if (typeof year === "number" && Number.isInteger(year) && year > 1800) {
			return `Movie • ${year}`;
		}
		return "Movie";
	}

	private buildEpisodeSubtitle(
		seasonNumber: number,
		episodeNumber: number,
		episodeTitle: unknown,
	): string {
		const episodeCode = `S${String(seasonNumber).padStart(2, "0")}E${String(episodeNumber).padStart(2, "0")}`;
		const title = this.getOptionalStringValue(episodeTitle);
		return title ? `${episodeCode} • ${title}` : episodeCode;
	}

	private ensureTraktConfigured(): void {
		if (!this.traktApiKey) {
			throw new BadRequestException(
				"Trakt import is not configured on this server. You can still import via CSV.",
			);
		}
	}

	private normalizeUsername(username: string): string {
		const normalizedUsername = username.trim();
		if (!normalizedUsername) {
			throw new BadRequestException("Trakt username is required");
		}
		return normalizedUsername;
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

	private mapTraktImportJob(
		job: NonNullable<BackgroundJobRecord>,
	): TraktImportJobDto {
		const jobData = parseTraktImportData(job.data);
		return {
			id: job.id,
			traktUsername: jobData.traktUsername,
			status: job.status as TraktImportJobDto["status"],
			currentPage: jobData.currentPage,
			totalPages: jobData.totalPages ?? undefined,
			sourceCount: jobData.sourceCount,
			normalizedCount: jobData.normalizedCount,
			importedCount: jobData.importedCount,
			skippedCount: jobData.skippedCount,
			failedCount: jobData.failedCount,
			nextRunAt: job.nextRunAt.toISOString(),
			lastError: job.lastError ?? undefined,
			profileUsername: jobData.profileUsername,
			profileSlug: jobData.profileSlug,
			profileName: jobData.profileName,
			profileAvatarUrl: jobData.profileAvatarUrl,
			startedAt: job.startedAt?.toISOString(),
			completedAt: job.completedAt?.toISOString(),
			createdAt: job.createdAt.toISOString(),
			updatedAt: job.updatedAt.toISOString(),
		};
	}

	private buildProfileFromJobData(
		jobData: TraktImportJobData,
	): TraktPublicProfileDto {
		return {
			username: jobData.profileUsername ?? jobData.traktUsername,
			slug: jobData.profileSlug ?? jobData.traktUsername,
			name: jobData.profileName,
			isPrivate: false,
			isVip: false,
			avatarUrl: jobData.profileAvatarUrl,
		};
	}

	private async restoreImportSession(
		userDid: string,
	): Promise<ATSession | null> {
		try {
			const session = await this.authService.restore(userDid);
			return session ? (session as unknown as ATSession) : null;
		} catch (error) {
			this.logger.warn(
				`Failed to restore auth session for ${userDid}: ${this.getErrorMessage(error)}`,
			);
			return null;
		}
	}

	private isPdsRateLimitError(error: unknown): boolean {
		return (
			typeof error === "object" &&
			error !== null &&
			"status" in error &&
			(error as { status: unknown }).status === 429
		);
	}

	/**
	 * True when an applyWrites batch failed because a record at one of the
	 * (deterministic) rkeys already exists in the PDS. This is the crash-recovery
	 * signal: a prior run wrote to the PDS but died before the DB write. The
	 * caller retries the batch as `update` ops, which is a safe idempotent
	 * overwrite because the rkey is a content hash (existing record is identical).
	 */
	private isRecordExistsError(error: unknown): boolean {
		const message = this.getErrorMessage(error).toLowerCase();
		return (
			message.includes("already exists") ||
			message.includes("recordalreadyexists") ||
			message.includes("could not create") ||
			message.includes("invalidswap")
		);
	}

	/**
	 * Read the IETF RateLimit headers off a successful applyWrites response so the
	 * caller can pace itself against the live repo-write budget. Returns undefined
	 * when the PDS doesn't surface them (older builds) — callers fall back to
	 * reacting to a 429 instead.
	 */
	private parsePdsRateLimitSnapshot(
		headers: unknown,
	): PdsRateLimitSnapshot | undefined {
		if (typeof headers !== "object" || headers === null) return undefined;
		const h = headers as Record<string, string>;
		const remainingRaw = h["ratelimit-remaining"] ?? h["RateLimit-Remaining"];
		const resetRaw = h["ratelimit-reset"] ?? h["RateLimit-Reset"];
		const remaining =
			remainingRaw === undefined ? undefined : Number(remainingRaw);
		const reset = resetRaw === undefined ? undefined : Number(resetRaw);
		const snapshot: PdsRateLimitSnapshot = {
			remaining: Number.isFinite(remaining) ? remaining : undefined,
			reset: Number.isFinite(reset) ? reset : undefined,
		};
		return snapshot.remaining === undefined && snapshot.reset === undefined
			? undefined
			: snapshot;
	}

	private reportPdsRateLimit(
		headers: unknown,
		options?: { onRateLimit?: (snapshot: PdsRateLimitSnapshot) => void },
	): void {
		if (!options?.onRateLimit) return;
		const snapshot = this.parsePdsRateLimitSnapshot(headers);
		if (snapshot) options.onRateLimit(snapshot);
	}

	/** Seconds until the binding repo-write window resets, floored and capped. */
	private secondsUntilPdsReset(snapshot?: PdsRateLimitSnapshot): number {
		if (snapshot?.reset !== undefined && Number.isFinite(snapshot.reset)) {
			const delta = Math.ceil(snapshot.reset - Date.now() / 1000) + 1;
			if (delta > 0) return Math.min(delta, PDS_RETRY_MAX_SECONDS);
		}
		return PDS_RETRY_FALLBACK_SECONDS;
	}

	private getPdsRetryAfterSeconds(error: unknown): number | undefined {
		if (typeof error !== "object" || error === null) return undefined;
		const headers = (error as Record<string, unknown>).headers;
		if (!headers || typeof headers !== "object") return undefined;
		const h = headers as Record<string, string>;

		// The atproto PDS throttles repo writes with the IETF RateLimit headers,
		// NOT Retry-After. `ratelimit-reset` is the absolute Unix epoch (seconds)
		// when the (hourly) write budget refills — convert it to a delay from now.
		// Reading the wrong header here is why we used to busy-retry every 60s and
		// keep re-hitting the limit before the window had actually reset.
		const reset = h["ratelimit-reset"] ?? h["RateLimit-Reset"];
		if (reset) {
			const resetEpoch = Number(reset);
			if (Number.isFinite(resetEpoch)) {
				// +1s so we resume just after the window rolls, not on its edge.
				const delta = Math.ceil(resetEpoch - Date.now() / 1000) + 1;
				if (delta > 0) return delta;
			}
		}

		// Fallback: some proxies send a plain Retry-After (delta seconds).
		const retryAfter = h["retry-after"] ?? h["Retry-After"];
		if (retryAfter) {
			const parsed = Number(retryAfter);
			if (Number.isFinite(parsed)) return parsed;
		}
		return undefined;
	}

	private classifyImportWriteError(error: unknown): ClassifiedImportWriteError {
		const rawMessage =
			this.getErrorMessage(error) || "Failed to import watch item";
		const normalizedMessage = rawMessage.toLowerCase();

		if (
			normalizedMessage.includes("unique constraint failed") ||
			normalizedMessage.includes("duplicate key") ||
			normalizedMessage.includes("duplicate") ||
			normalizedMessage.includes("trackedmovie_rkey_key") ||
			normalizedMessage.includes("trackedepisode_rkey_key") ||
			normalizedMessage.includes("`rkey`")
		) {
			return {
				reason: "duplicate_record",
				message: "This watch was already imported.",
				rawMessage,
			};
		}

		if (
			normalizedMessage.includes("tmdb") ||
			normalizedMessage.includes("show details") ||
			normalizedMessage.includes("movie details") ||
			normalizedMessage.includes("metadata") ||
			normalizedMessage.includes("season details") ||
			normalizedMessage.includes("episode details")
		) {
			return {
				reason: "metadata_unavailable",
				message: "We couldn't fetch details for this title right now.",
				rawMessage,
			};
		}

		if (
			normalizedMessage.includes("atproto") ||
			normalizedMessage.includes("pds") ||
			normalizedMessage.includes("putrecord") ||
			normalizedMessage.includes("repo.putrecord") ||
			normalizedMessage.includes("repo#putrecord") ||
			normalizedMessage.includes("upstream")
		) {
			return {
				reason: "upstream_write_failed",
				message: "We couldn't save this watch right now. Please try again.",
				rawMessage,
			};
		}

		return {
			reason: "unknown",
			message: "We couldn't import this item.",
			rawMessage,
		};
	}

	private getErrorMessage(error: unknown): string {
		if (error instanceof TraktApiError) {
			return error.message;
		}
		if (error instanceof HttpException) {
			return error.message;
		}
		if (error instanceof Error) {
			return error.message;
		}
		return String(error);
	}

	private toPublicTraktException(error: unknown): Error {
		if (error instanceof HttpException) {
			return error;
		}
		if (error instanceof TraktApiError) {
			if (error.status === 404) {
				return new NotFoundException(error.message);
			}
			if (error.status === 401 || error.status === 403 || error.status < 500) {
				return new BadRequestException(error.message);
			}
			if (error.status === 429) {
				return new HttpException(error.message, HttpStatus.TOO_MANY_REQUESTS);
			}
			return new ServiceUnavailableException(error.message);
		}
		if (error instanceof Error) {
			return error;
		}
		return new Error(String(error));
	}
}
