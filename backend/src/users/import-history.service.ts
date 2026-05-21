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
const TRAKT_RATE_LIMIT_BACKOFF_SECONDS = [60, 300, 600]; // 1min, 5min, 10min, then +5min each time
const TRAKT_PAGE_DELAY_MS = 800;
const PDS_APPLY_WRITES_BATCH_SIZE = 200;
const PDS_RETRY_FALLBACK_SECONDS = 60;
const PDS_RETRY_MAX_SECONDS = 5 * 60;

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
	private readonly traktUserAgent = "OpnShelf/1.0 (+https://opnshelf.xyz)";
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
			} catch (error) {
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
			const importResult = await this.importNormalizedItems(
				job.userDid,
				session,
				normalized.items,
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

			await this.prisma.backgroundJob.update({
				where: { id: job.id },
				data: {
					status: isComplete ? "completed" : "running",
					data: updatedData,
					lastError: null,
					nextRunAt: isComplete
						? new Date()
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
						lastError: `PDS rate limit reached. Retrying in ${retryAfterSeconds} seconds.`,
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
						lastError: `Trakt rate limit reached. Retrying in ${retryAfterSeconds} seconds.`,
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
		const watchedDate = new Date(item.watchedAt);

		if (item.type === "movie" && item.movieTmdbId) {
			const existing = await this.prisma.trackedMovie.findFirst({
				where: {
					userDid,
					movieId: String(item.movieTmdbId),
					watchedDate,
				},
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
			const existing = await this.prisma.trackedEpisode.findFirst({
				where: {
					userDid,
					showId: String(item.showTmdbId),
					seasonNumber: item.seasonNumber,
					episodeNumber: item.episodeNumber,
					watchedDate,
				},
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

	private getPdsRetryAfterSeconds(error: unknown): number | undefined {
		if (typeof error !== "object" || error === null) return undefined;
		const headers = (error as Record<string, unknown>).headers;
		if (!headers || typeof headers !== "object") return undefined;
		const retryAfter =
			(headers as Record<string, string>)["retry-after"] ??
			(headers as Record<string, string>)["Retry-After"];
		if (!retryAfter) return undefined;
		const parsed = Number(retryAfter);
		return Number.isFinite(parsed) ? parsed : undefined;
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
