import {
	BadRequestException,
	HttpException,
	HttpStatus,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MoviesService } from "../movies/movies.service";
import { PrismaService } from "../prisma/prisma.service";
import { ShowsService } from "../shows/shows.service";
import type {
	FetchTraktPublicHistoryResponseDto,
	ImportErrorDto,
	ImportHistoryResponseDto,
	ImportSkipDto,
	NormalizedImportItemDto,
} from "./dto/import-history.dto";

interface ATSession {
	did: string;
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
	) {
		this.traktApiKey = this.configService.get<string>("TRAKT_API_KEY") ?? "";
	}

	async fetchTraktPublicHistory(
		username: string,
		maxItems?: number,
	): Promise<FetchTraktPublicHistoryResponseDto> {
		if (!this.traktApiKey) {
			throw new BadRequestException(
				"Trakt import is not configured on this server. You can still import via CSV.",
			);
		}

		const normalizedUsername = username.trim();
		if (!normalizedUsername) {
			throw new BadRequestException("Trakt username is required");
		}

		const safeMaxItems =
			typeof maxItems === "number"
				? Math.max(Math.floor(maxItems), 1)
				: Number.POSITIVE_INFINITY;
		const pageSize = 100;
		let page = 1;
		let sourceCount = 0;
		const items: NormalizedImportItemDto[] = [];
		const skipped: ImportSkipDto[] = [];

		while (items.length < safeMaxItems) {
			const url = new URL(
				`/users/${encodeURIComponent(normalizedUsername)}/history`,
				this.traktBaseUrl,
			);
			url.searchParams.set("page", String(page));
			url.searchParams.set("limit", String(pageSize));

			const response = await fetch(url.toString(), {
				headers: {
					"trakt-api-key": this.traktApiKey,
					"trakt-api-version": "2",
					"User-Agent": this.traktUserAgent,
				},
				signal: AbortSignal.timeout(12_000),
			});

			if (response.status === 404) {
				throw new NotFoundException("Trakt user not found");
			}
			if (response.status === 401 || response.status === 403) {
				throw new BadRequestException(
					"Trakt profile is private or unavailable. Try CSV import instead.",
				);
			}
			if (response.status === 429) {
				throw new HttpException(
					"Trakt rate limit reached. Please retry in a few minutes or use CSV import.",
					HttpStatus.TOO_MANY_REQUESTS,
				);
			}
			if (response.status >= 500) {
				throw new ServiceUnavailableException(
					"Trakt is temporarily unavailable. Please retry later or use CSV import.",
				);
			}
			if (!response.ok) {
				throw new BadRequestException("Failed to fetch Trakt public history");
			}

			const payload = (await response.json()) as unknown;
			if (!Array.isArray(payload)) {
				throw new BadRequestException("Unexpected Trakt response format");
			}

			sourceCount += payload.length;
			for (let i = 0; i < payload.length; i++) {
				if (items.length >= safeMaxItems) {
					break;
				}
				const result = this.normalizeTraktApiItem(
					payload[i],
					sourceCount - payload.length + i + 1,
				);
				if (result.item) {
					items.push(result.item);
				} else if (result.skip) {
					skipped.push(result.skip);
				}
			}

			if (payload.length < pageSize) {
				break;
			}

			page += 1;
		}

		return {
			items,
			skipped,
			sourceCount,
		};
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
					error instanceof Error
						? error.message
						: "Failed to import watch item";
				this.logger.warn(
					`Failed to import item at index ${index + 1}: ${error instanceof Error ? error.message : String(error)}`,
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

	private normalizeTraktApiItem(
		rawItem: unknown,
		index: number,
	): { item?: NormalizedImportItemDto; skip?: ImportSkipDto } {
		if (!rawItem || typeof rawItem !== "object") {
			return {
				skip: {
					index,
					reason: "unsupported_type",
					message: "Invalid item format",
				},
			};
		}

		const item = rawItem as {
			type?: unknown;
			action?: unknown;
			watched_at?: unknown;
			movie?: { ids?: { tmdb?: unknown } };
			show?: { ids?: { tmdb?: unknown } };
			episode?: { season?: unknown; number?: unknown };
		};

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
}
