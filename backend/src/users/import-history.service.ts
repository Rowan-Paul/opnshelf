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

type TraktImportJobRecord = Awaited<
	ReturnType<PrismaService["traktImportJob"]["findFirst"]>
>;

const TRAKT_HISTORY_PAGE_SIZE = 100;
const TRAKT_PREVIEW_ITEM_LIMIT = 5;
const ACTIVE_TRAKT_JOB_STATUSES: TraktJobStatus[] = [
	"queued",
	"running",
	"waiting_retry",
];
const RECENT_TERMINAL_JOB_WINDOW_MS = 15 * 60 * 1000;
const TRAKT_RETRY_FALLBACK_SECONDS = 60;
const TRAKT_RETRY_MAX_SECONDS = 10 * 60;
const TRAKT_PAGE_DELAY_MS = 800;

class TraktApiError extends Error {
	constructor(
		message: string,
		public readonly status: number,
		public readonly retryAfterSeconds?: number,
	) {
		super(message);
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
		maxItems?: number,
	): Promise<FetchTraktPublicHistoryResponseDto> {
		try {
			this.ensureTraktConfigured();

			const normalizedUsername = this.normalizeUsername(username);
			const safeMaxItems =
				typeof maxItems === "number"
					? Math.max(Math.floor(maxItems), 1)
					: Number.POSITIVE_INFINITY;
			const profile = await this.fetchTraktPublicProfile(normalizedUsername);
			let page = 1;
			let pageCount = Number.POSITIVE_INFINITY;
			let sourceCount = 0;
			const items: NormalizedImportItemDto[] = [];
			const skipped: ImportSkipDto[] = [];
			const previewItems: TraktHistoryPreviewItemDto[] = [];

			while (items.length < safeMaxItems && page <= pageCount) {
				const pageResult = await this.fetchTraktHistoryPage(
					normalizedUsername,
					page,
				);
				pageCount = pageResult.pageCount ?? pageCount;
				sourceCount += pageResult.payload.length;

				for (let i = 0; i < pageResult.payload.length; i++) {
					if (items.length >= safeMaxItems) {
						break;
					}
					const result = this.normalizeTraktApiItem(
						pageResult.payload[i],
						sourceCount - pageResult.payload.length + i + 1,
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
				sourceCount,
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
				const existingProfile = this.buildProfileFromJob(existingJob);
				const preview = await this.fetchTraktPreview(
					existingJob.traktUsername,
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
			const job = await this.prisma.traktImportJob.create({
				data: {
					userDid,
					traktUsername: normalizedUsername,
					status: "queued",
					nextRunAt: new Date(),
					profileUsername: preview.profile.username,
					profileSlug: preview.profile.slug,
					profileName: preview.profile.name,
					profileAvatarUrl: preview.profile.avatarUrl,
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

		const recentTerminalJob = await this.prisma.traktImportJob.findFirst({
			where: {
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
		const job = await this.prisma.traktImportJob.findFirst({
			where: {
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

			try {
				if (item.type === "movie" && item.movieTmdbId) {
					const write = await this.moviesService.markWatched(
						userDid,
						session,
						String(item.movieTmdbId),
						item.watchedAt,
					);
					await this.moviesService.indexTrackedMovie(
						write.uri,
						write.cid,
						write.rkey,
						userDid,
						String(item.movieTmdbId),
						item.watchedAt,
					);
					imported += 1;
					continue;
				}

				if (
					item.type === "episode" &&
					item.showTmdbId &&
					item.seasonNumber !== undefined &&
					item.episodeNumber !== undefined
				) {
					const write = await this.showsService.markEpisodeWatched(
						userDid,
						session,
						String(item.showTmdbId),
						item.seasonNumber,
						item.episodeNumber,
						item.watchedAt,
					);
					await this.showsService.indexTrackedEpisode(
						write.uri,
						write.cid,
						write.rkey,
						userDid,
						String(item.showTmdbId),
						item.seasonNumber,
						item.episodeNumber,
						item.watchedAt,
					);
					imported += 1;
					continue;
				}

				failed += 1;
				const itemContext = this.describeImportItem(item);
				errors.push({
					index: index + 1,
					code: "invalid_item",
					message: `${itemContext}: missing required fields`,
				});
			} catch (error) {
				failed += 1;
				const itemContext = this.describeImportItem(item);
				const rawMessage =
					this.getErrorMessage(error) || "Failed to import watch item";
				this.logger.warn(
					`Failed to import item at index ${index + 1}: ${rawMessage}`,
				);
				errors.push({
					index: index + 1,
					code: "write_failed",
					message: `${itemContext}: ${rawMessage}`,
				});
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
		const job = await this.prisma.traktImportJob.findUnique({
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

		const session = await this.restoreImportSession(job.userDid);
		if (!session) {
			await this.failTraktImportJob(
				job.id,
				"Your sign-in session expired. Please sign in again and retry the import.",
			);
			return;
		}

		await this.prisma.traktImportJob.update({
			where: { id: job.id },
			data: {
				status: "running",
				startedAt: job.startedAt ?? new Date(),
				lastError: null,
			},
		});

		try {
			const pageResult = await this.fetchTraktHistoryPage(
				job.traktUsername,
				job.currentPage,
			);
			const totalPages =
				pageResult.pageCount ?? job.totalPages ?? job.currentPage;
			const normalized = this.normalizeTraktPage(
				pageResult.payload,
				job.sourceCount + 1,
			);
			const importResult = await this.importNormalizedItems(
				job.userDid,
				session,
				normalized.items,
			);
			const nextPage = job.currentPage + 1;
			const hasKnownTotalPages =
				Number.isInteger(totalPages) && totalPages >= 1;
			const isComplete =
				pageResult.payload.length === 0 ||
				(hasKnownTotalPages
					? nextPage > totalPages
					: pageResult.payload.length < TRAKT_HISTORY_PAGE_SIZE);

			await this.prisma.traktImportJob.update({
				where: { id: job.id },
				data: {
					status: isComplete ? "completed" : "running",
					currentPage: isComplete ? job.currentPage : nextPage,
					totalPages,
					sourceCount: job.sourceCount + pageResult.payload.length,
					normalizedCount: job.normalizedCount + normalized.items.length,
					importedCount: job.importedCount + importResult.imported,
					skippedCount:
						job.skippedCount + normalized.skipped.length + importResult.skipped,
					failedCount: job.failedCount + importResult.failed,
					lastError: null,
					nextRunAt: isComplete
						? new Date()
						: new Date(Date.now() + TRAKT_PAGE_DELAY_MS),
					completedAt: isComplete ? new Date() : null,
				},
			});
		} catch (error) {
			if (error instanceof TraktApiError && error.status === 429) {
				const retryAfterSeconds = this.getRetryAfterSeconds(
					error.retryAfterSeconds,
				);
				this.logger.warn(
					`Trakt rate limit reached for job ${job.id}. Retrying in ${retryAfterSeconds}s.`,
				);
				await this.prisma.traktImportJob.update({
					where: { id: job.id },
					data: {
						status: "waiting_retry",
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
		await this.prisma.traktImportJob.update({
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
	): Promise<{ payload: unknown[]; pageCount?: number }> {
		const url = this.createTraktUrl(
			`/users/${encodeURIComponent(username)}/history`,
		);
		url.searchParams.set("page", String(page));
		url.searchParams.set("limit", String(TRAKT_HISTORY_PAGE_SIZE));

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
		return this.prisma.traktImportJob.findFirst({
			where: {
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
		job: NonNullable<TraktImportJobRecord>,
	): TraktImportJobDto {
		return {
			id: job.id,
			traktUsername: job.traktUsername,
			status: job.status,
			currentPage: job.currentPage,
			totalPages: job.totalPages ?? undefined,
			sourceCount: job.sourceCount,
			normalizedCount: job.normalizedCount,
			importedCount: job.importedCount,
			skippedCount: job.skippedCount,
			failedCount: job.failedCount,
			nextRunAt: job.nextRunAt.toISOString(),
			lastError: job.lastError ?? undefined,
			profileUsername: job.profileUsername ?? undefined,
			profileSlug: job.profileSlug ?? undefined,
			profileName: job.profileName ?? undefined,
			profileAvatarUrl: job.profileAvatarUrl ?? undefined,
			startedAt: job.startedAt?.toISOString(),
			completedAt: job.completedAt?.toISOString(),
			createdAt: job.createdAt.toISOString(),
			updatedAt: job.updatedAt.toISOString(),
		};
	}

	private buildProfileFromJob(
		job: NonNullable<TraktImportJobRecord>,
	): TraktPublicProfileDto {
		return {
			username: job.profileUsername ?? job.traktUsername,
			slug: job.profileSlug ?? job.traktUsername,
			name: job.profileName ?? undefined,
			isPrivate: false,
			isVip: false,
			avatarUrl: job.profileAvatarUrl ?? undefined,
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

	private getRetryAfterSeconds(retryAfterSeconds?: number): number {
		const boundedRetry = retryAfterSeconds ?? TRAKT_RETRY_FALLBACK_SECONDS;
		return Math.max(1, Math.min(boundedRetry, TRAKT_RETRY_MAX_SECONDS));
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
