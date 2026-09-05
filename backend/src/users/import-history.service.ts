import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import {
	deterministicEpisodeWatchRkey,
	deterministicMovieWatchRkey,
} from "../common/watch-rkey";
import { MoviesService } from "../movies/movies.service";
import { PrismaService } from "../prisma/prisma.service";
import { ShowsService } from "../shows/shows.service";
import type {
	FetchTraktPublicHistoryResponseDto,
	ImportHistoryResponseDto,
	ImportSkipDto,
	NormalizedImportItemDto,
	PaginatedTraktImportIssuesDto,
	StartTraktImportResponseDto,
	TraktHistoryPreviewItemDto,
	TraktImportJobDto,
	TraktMatchCandidateDto,
} from "./dto/import-history.dto";
import {
	buildTraktImportData,
	parseTraktImportData,
} from "./background-job-data";
import {
	type PdsRateLimitSnapshot,
	toPublicTraktException,
} from "./import-errors";
import {
	importItemFromMatchedRow,
	importItemFromRetryRow,
	rankMovieMatchCandidates,
	rankShowMatchCandidates,
	summarizeTraktImportJob,
} from "./import/trakt-import-ledger";
import {
	ACTIVE_TRAKT_JOB_STATUSES,
	TraktImportJobStore,
	isUniqueConstraintError,
} from "./import/trakt-import-job.store";
import { TraktImportWorker } from "./import/trakt-import-worker.service";
import {
	type ATSession,
	WatchImportWriter,
} from "./import/watch-import-writer.service";
import {
	TRAKT_PREVIEW_ITEM_LIMIT,
	normalizeTraktApiItem,
} from "./trakt-normalize";
import { TRAKT_HISTORY_PAGE_SIZE, TraktApiClient } from "./trakt-api.client";
import {
	type BackgroundJobRecord,
	buildProfileFromJobData,
	getTraktImportRecovery,
	mapTraktImportIssue,
	mapTraktImportJob,
} from "./trakt-job-dto";

const TRAKT_PREVIEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Public surface of the Trakt Import and CSV import. Composes the job store
 * (persistence), the Watch writer (PDS + index writes), and the page worker;
 * owns the User-facing flows: preview, start, controls, issues, and matching.
 */
@Injectable()
export class ImportHistoryService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly moviesService: MoviesService,
		private readonly showsService: ShowsService,
		private readonly traktApi: TraktApiClient,
		private readonly jobStore: TraktImportJobStore,
		private readonly writer: WatchImportWriter,
		private readonly worker: TraktImportWorker,
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
			const existingJob = await this.jobStore.findLatestJob(userDid, {
				statuses: [
					...ACTIVE_TRAKT_JOB_STATUSES,
					"paused",
					"completed",
					"failed",
				],
			});

			if (existingJob) {
				return this.mapExistingTraktImport(existingJob);
			}

			const preview = await this.traktApi.fetchPreview(normalizedUsername);
			let job: NonNullable<BackgroundJobRecord>;
			try {
				job = await this.jobStore.createJob(
					userDid,
					buildTraktImportData({
						traktUsername: normalizedUsername,
						profileUsername: preview.profile.username,
						profileSlug: preview.profile.slug,
						profileName: preview.profile.name,
						profileAvatarUrl: preview.profile.avatarUrl,
					}),
				);
			} catch (error) {
				if (!isUniqueConstraintError(error)) {
					throw error;
				}

				const winningJob = await this.jobStore.findLatestJob(userDid, {
					statuses: [
						...ACTIVE_TRAKT_JOB_STATUSES,
						"paused",
						"completed",
						"failed",
					],
				});
				if (!winningJob) {
					throw error;
				}
				return this.mapExistingTraktImport(winningJob);
			}

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

	private mapExistingTraktImport(
		job: NonNullable<BackgroundJobRecord>,
	): StartTraktImportResponseDto {
		const data = parseTraktImportData(job.data);
		return {
			profile: buildProfileFromJobData(data),
			previewItems: [],
			sourcePreviewCount: 0,
			job: mapTraktImportJob(job),
		};
	}

	async getCurrentTraktImport(
		userDid: string,
	): Promise<TraktImportJobDto | null> {
		const job = await this.jobStore.findCurrentJob(userDid);

		return job ? this.mapTraktImportJobWithIssues(job) : null;
	}

	async pauseTraktImport(userDid: string): Promise<TraktImportJobDto> {
		const job = await this.jobStore.requireJob(userDid);
		await this.jobStore.persistStatusControl(job.id, "pause");
		return this.getRequiredCurrentTraktImport(userDid);
	}

	async resumeTraktImport(userDid: string): Promise<TraktImportJobDto> {
		const job = await this.jobStore.requireJob(userDid);
		await this.jobStore.persistStatusControl(job.id, "resume");
		return this.getRequiredCurrentTraktImport(userDid);
	}

	async acknowledgeTraktImport(userDid: string): Promise<TraktImportJobDto> {
		const job = await this.jobStore.requireJob(userDid);
		await this.jobStore.persistControl(job.id, {
			acknowledgedAt: new Date().toISOString(),
		});
		return this.getRequiredCurrentTraktImport(userDid);
	}

	async snoozeTraktReminder(userDid: string): Promise<TraktImportJobDto> {
		const job = await this.jobStore.requireJob(userDid);
		const reminderSnoozedUntil = new Date(
			Date.now() + 7 * 24 * 60 * 60 * 1000,
		).toISOString();
		await this.jobStore.persistControl(job.id, { reminderSnoozedUntil });
		return this.getRequiredCurrentTraktImport(userDid);
	}

	async reapStaleRunningJobs(): Promise<void> {
		await this.jobStore.reapStaleRunningJobs();
	}

	async processNextTraktImportJob(): Promise<void> {
		await this.worker.processNextTraktImportJob();
	}

	async importNormalizedItems(
		userDid: string,
		session: ATSession,
		items: NormalizedImportItemDto[],
		options?: { onRateLimit?: (snapshot: PdsRateLimitSnapshot) => void },
	): Promise<ImportHistoryResponseDto> {
		return this.writer.importNormalizedItems(userDid, session, items, options);
	}

	async getTraktImportIssues(
		userDid: string,
		page = 1,
		pageSize = 25,
		outcome?: "unmatched" | "couldnt_import",
	): Promise<PaginatedTraktImportIssuesDto> {
		const job = await this.jobStore.requireJob(userDid);
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
		const job = await this.jobStore.requireJob(userDid);
		const sources = await this.prisma.traktImportItem.findMany({
			where: { jobId: job.id, traktMediaKey: matchKey },
			orderBy: { sourceIndex: "asc" },
		});
		const source = sources.find(
			(item) => getTraktImportRecovery(item) === "match",
		);
		if (!source) throw new NotFoundException("Matchable Trakt title not found");
		const searchQuery = query?.trim() || source.title || "";
		if (!searchQuery) return [];

		if (source.mediaType === "movie") {
			const response = await this.moviesService.searchMovies(searchQuery);
			return rankMovieMatchCandidates(response.results, source.year);
		}

		const response = await this.showsService.searchShows(searchQuery);
		return rankShowMatchCandidates(response.results, source.year);
	}

	async confirmTraktMatch(
		userDid: string,
		matchKey: string,
		tmdbId: string,
	): Promise<TraktImportJobDto> {
		const job = await this.jobStore.requireJob(userDid);
		const sourceRows = await this.prisma.traktImportItem.findMany({
			where: { jobId: job.id, traktMediaKey: matchKey },
			orderBy: { sourceIndex: "asc" },
		});
		const rows = sourceRows.filter(
			(row) => getTraktImportRecovery(row) === "match",
		);
		if (rows.length === 0)
			throw new NotFoundException("Matchable Trakt title not found");
		const session = await this.writer.restoreImportSession(userDid);
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
			const item = importItemFromMatchedRow(
				{ ...row, watchedAt: row.watchedAt },
				tmdbId,
			);
			if (!item || !Number.isInteger(Number(tmdbId)) || Number(tmdbId) <= 0) {
				await this.markTraktItemCouldntImport(
					row.id,
					"invalid_match",
					"The selected TMDB item is invalid",
				);
				continue;
			}
			const result = await this.writer.importNormalizedItems(userDid, session, [
				item,
			]);
			if (result.imported > 0) {
				await this.prisma.traktImportItem.update({
					where: { id: row.id },
					data: {
						outcome: "imported",
						tmdbId,
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

	async retryTraktImportItem(
		userDid: string,
		itemId: string,
	): Promise<TraktImportJobDto> {
		const job = await this.jobStore.requireJob(userDid);
		const row = await this.prisma.traktImportItem.findFirst({
			where: { id: itemId, jobId: job.id },
		});
		if (!row || getTraktImportRecovery(row) !== "retry") {
			throw new NotFoundException("Retryable Trakt item not found");
		}
		if (
			!row.watchedAt ||
			!row.tmdbId ||
			!Number.isInteger(Number(row.tmdbId))
		) {
			throw new BadRequestException("This item cannot be retried");
		}
		const item = importItemFromRetryRow({
			...row,
			watchedAt: row.watchedAt,
			tmdbId: row.tmdbId,
		});
		if (!item) throw new BadRequestException("This item cannot be retried");
		const session = await this.writer.restoreImportSession(userDid);
		if (!session) throw new BadRequestException("Your sign-in session expired");
		const result = await this.writer.importNormalizedItems(userDid, session, [
			item,
		]);
		if (result.imported > 0) {
			await this.prisma.traktImportItem.update({
				where: { id: row.id },
				data: { outcome: "imported" },
			});
		} else if (result.skipped > 0) {
			await this.prisma.traktImportItem.update({
				where: { id: row.id },
				data: { outcome: "already_on_shelf" },
			});
		} else {
			const error = result.errors[0];
			await this.markTraktItemCouldntImport(
				row.id,
				error?.reason ?? error?.code ?? "write_failed",
				error?.message ?? "This Watch could not be added",
			);
		}
		return this.getRequiredCurrentTraktImport(userDid);
	}

	async rejectTraktMatch(
		userDid: string,
		matchKey: string,
	): Promise<TraktImportJobDto> {
		const job = await this.jobStore.requireJob(userDid);
		const rows = await this.prisma.traktImportItem.findMany({
			where: { jobId: job.id, traktMediaKey: matchKey },
		});
		if (!rows.some((row) => getTraktImportRecovery(row) === "match")) {
			throw new NotFoundException("Matchable Trakt title not found");
		}
		// Deferring a match is deliberately a no-op: this is a lifetime queue and
		// the same title must remain available when the User later finds it.
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
		return summarizeTraktImportJob(job, items, issueRows);
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
}
