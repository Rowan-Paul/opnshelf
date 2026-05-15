import { Agent } from "@atproto/api";
import { TID } from "@atproto/common";
import { Injectable, Logger } from "@nestjs/common";
import {
	$nsid as COLLECTION,
	main as episodeSchema,
} from "../lexicons/xyz/opnshelf/episode";
import type { Main as EpisodeRecord } from "../lexicons/xyz/opnshelf/episode.defs";
import { ColorExtractionService } from "../movies/color-extraction.service";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "../generated/client";
import {
	ShowsTmdbService,
	type TMDBCredits,
	type TMDBEpisode,
	type TMDBSearchResponse,
	type TMDBSeason,
	type TMDBShow,
} from "./shows-tmdb.service";

export interface ATSession {
	did: string;
}

type TrackedEpisodeWithShow = {
	id: string;
	showId: string;
	seasonNumber: number;
	episodeNumber: number;
	watchedDate: Date | null;
	createdAt: Date;
	show: {
		showId: string;
		title: string;
		posterPath: string | null;
		backdropPath: string | null;
		firstAirYear: number | null;
		firstAirDate: Date | null;
		overview: string | null;
		colors: unknown;
	};
};

type WatchlistReleaseItem = {
	mediaType: "movie" | "show";
	mediaId: string;
	movie: {
		movieId: string;
		title: string;
		posterPath: string | null;
		backdropPath: string | null;
		releaseDate: Date | null;
		overview: string | null;
		colors: unknown;
	} | null;
	show: {
		showId: string;
		title: string;
		posterPath: string | null;
		backdropPath: string | null;
		firstAirDate: Date | null;
		overview: string | null;
		colors: unknown;
	} | null;
};

type ReleaseCalendarColors = {
	primary?: string;
	secondary?: string;
	accent?: string;
	muted?: string;
};

type ReleaseCalendarItem = {
	source: "watching" | "watchlist";
	mediaType: "movie" | "show";
	releaseKind: "movie" | "show" | "episode";
	releaseDate: string;
	title: string;
	subtitle?: string;
	overview?: string;
	posterPath?: string;
	backdropPath?: string;
	showId?: string;
	movieId?: string;
	seasonNumber?: number;
	episodeNumber?: number;
	colors?: ReleaseCalendarColors;
};

@Injectable()
export class ShowsService {
	private readonly logger = new Logger(ShowsService.name);

	constructor(
		private prisma: PrismaService,
		private colorExtraction: ColorExtractionService,
		private showsTmdb: ShowsTmdbService,
	) {}

	async searchShows(
		query: string,
		page: number = 1,
	): Promise<TMDBSearchResponse> {
		return this.showsTmdb.searchShows(query, page);
	}

	async discoverShows(
		sortBy: string = "popularity.desc",
		page: number = 1,
		year?: number,
	): Promise<TMDBSearchResponse> {
		return this.showsTmdb.discoverShows(sortBy, page, year);
	}

	async getShowDetails(showId: string): Promise<TMDBShow> {
		return this.showsTmdb.getShowDetails(showId);
	}

	async getShowCredits(showId: string): Promise<TMDBCredits | null> {
		return this.showsTmdb.getShowCredits(showId);
	}

	async getSeasonDetails(
		showId: string,
		seasonNumber: number,
	): Promise<TMDBSeason> {
		return this.showsTmdb.getSeasonDetails(showId, seasonNumber);
	}

	async getEpisodeDetails(
		showId: string,
		seasonNumber: number,
		episodeNumber: number,
	): Promise<TMDBEpisode> {
		return this.showsTmdb.getEpisodeDetails(
			showId,
			seasonNumber,
			episodeNumber,
		);
	}

	async getEpisodeContext(
		showId: string,
		seasonNumber: number,
		episodeNumber: number,
	): Promise<{
		previous: { seasonNumber: number; episodeNumber: number } | null;
		next: { seasonNumber: number; episodeNumber: number } | null;
	}> {
		return this.getEpisodeContextLocal(showId, seasonNumber, episodeNumber);
	}

	async getShowByTMDBId(showId: string) {
		return this.prisma.show.findUnique({
			where: { showId },
		});
	}

	async upsertShow(showData: TMDBShow) {
		const colors = await this.colorExtraction.extractColorsFromPoster(
			showData.poster_path ?? null,
		);

		return this.prisma.show.upsert({
			where: { showId: showData.id.toString() },
			create: {
				showId: showData.id.toString(),
				title: showData.name,
				posterPath: showData.poster_path ?? null,
				backdropPath: showData.backdrop_path ?? null,
				firstAirYear: showData.first_air_date
					? new Date(showData.first_air_date).getFullYear()
					: null,
				firstAirDate: showData.first_air_date
					? new Date(showData.first_air_date)
					: null,
				overview: showData.overview ?? null,
				colors: colors ?? undefined,
			},
			update: {
				title: showData.name,
				posterPath: showData.poster_path ?? null,
				backdropPath: showData.backdrop_path ?? null,
				firstAirYear: showData.first_air_date
					? new Date(showData.first_air_date).getFullYear()
					: null,
				firstAirDate: showData.first_air_date
					? new Date(showData.first_air_date)
					: null,
				overview: showData.overview ?? null,
				colors: colors ?? undefined,
			},
		});
	}

	async syncShowMetadata(showId: string): Promise<void> {
		const STALE_MS = 24 * 60 * 60 * 1000;
		const existingSeason = await this.prisma.season.findFirst({
			where: { showId },
			select: { updatedAt: true },
			orderBy: { updatedAt: "desc" },
		});
		if (
			existingSeason &&
			Date.now() - existingSeason.updatedAt.getTime() < STALE_MS
		) {
			return;
		}

		const show = await this.showsTmdb.getShowDetails(showId);
		const dbShowId = show.id.toString();
		await this.upsertShow(show);
		const tmdbSeasons = (show.seasons ?? []).filter(
			(s) => s.season_number !== 0,
		);

		for (const tmdbSeason of tmdbSeasons) {
			let seasonDetail: TMDBSeason;
			try {
				seasonDetail = await this.showsTmdb.getSeasonDetails(
					showId,
					tmdbSeason.season_number,
				);
			} catch {
				this.logger.warn(
					`Failed to fetch season ${tmdbSeason.season_number} for show ${showId}`,
				);
				continue;
			}

			const season = await this.prisma.season.upsert({
				where: {
					tmdbId: tmdbSeason.id,
				},
				create: {
					tmdbId: tmdbSeason.id,
					showId: dbShowId,
					seasonNumber: tmdbSeason.season_number,
					name: tmdbSeason.name,
					posterPath: tmdbSeason.poster_path ?? null,
					airDate: tmdbSeason.air_date ? new Date(tmdbSeason.air_date) : null,
					episodeCount: tmdbSeason.episode_count ?? null,
				},
				update: {
					showId: dbShowId,
					seasonNumber: tmdbSeason.season_number,
					name: tmdbSeason.name,
					posterPath: tmdbSeason.poster_path ?? null,
					airDate: tmdbSeason.air_date ? new Date(tmdbSeason.air_date) : null,
					episodeCount: tmdbSeason.episode_count ?? null,
				},
			});

			const episodes = seasonDetail.episodes ?? [];
			for (const ep of episodes) {
				await this.prisma.episode.upsert({
					where: {
						showId_seasonNumber_episodeNumber: {
							showId: dbShowId,
							seasonNumber: tmdbSeason.season_number,
							episodeNumber: ep.episode_number,
						},
					},
					create: {
						tmdbId: ep.id,
						seasonId: season.id,
						showId: dbShowId,
						seasonNumber: tmdbSeason.season_number,
						episodeNumber: ep.episode_number,
						name: ep.name,
						airDate: ep.air_date ? new Date(ep.air_date) : null,
						overview: ep.overview ?? null,
						stillPath: ep.still_path ?? null,
					},
					update: {
						tmdbId: ep.id,
						name: ep.name,
						airDate: ep.air_date ? new Date(ep.air_date) : null,
						overview: ep.overview ?? null,
						stillPath: ep.still_path ?? null,
					},
				});
			}
		}
	}

	async getEpisodeContextLocal(
		showId: string,
		seasonNumber: number,
		episodeNumber: number,
	): Promise<{
		previous: { seasonNumber: number; episodeNumber: number } | null;
		next: { seasonNumber: number; episodeNumber: number } | null;
	}> {
		const hasLocalData = await this.prisma.episode.count({
			where: { showId },
		});
		if (hasLocalData === 0) {
			return this.showsTmdb.getEpisodeContext(
				showId,
				seasonNumber,
				episodeNumber,
			);
		}

		const [previous, next] = await Promise.all([
			this.prisma.episode.findFirst({
				where: {
					showId,
					seasonNumber: { not: 0 },
					OR: [
						{
							seasonNumber,
							episodeNumber: { lt: episodeNumber },
						},
						{ seasonNumber: { lt: seasonNumber, gt: 0 } },
					],
				},
				orderBy: [{ seasonNumber: "desc" }, { episodeNumber: "desc" }],
				select: { seasonNumber: true, episodeNumber: true },
			}),
			this.prisma.episode.findFirst({
				where: {
					showId,
					seasonNumber: { not: 0 },
					airDate: { not: null, lte: new Date() },
					OR: [
						{
							seasonNumber,
							episodeNumber: { gt: episodeNumber },
						},
						{ seasonNumber: { gt: seasonNumber } },
					],
				},
				orderBy: [{ seasonNumber: "asc" }, { episodeNumber: "asc" }],
				select: { seasonNumber: true, episodeNumber: true },
			}),
		]);

		return { previous, next };
	}

	async getLocalSeasons(showId: string) {
		return this.prisma.season.findMany({
			where: { showId, seasonNumber: { not: 0 } },
			orderBy: { seasonNumber: "asc" },
			include: { _count: { select: { episodes: true } } },
		});
	}

	async getLocalEpisodes(showId: string, seasonNumber: number) {
		return this.prisma.episode.findMany({
			where: { showId, seasonNumber },
			orderBy: { episodeNumber: "asc" },
		});
	}

	async ensureShowHasColors(showId: string): Promise<{
		primary?: string;
		secondary?: string;
		accent?: string;
		muted?: string;
	} | null> {
		const show = await this.prisma.show.findUnique({
			where: { showId },
			select: {
				posterPath: true,
				colors: true,
			},
		});

		if (!show) {
			return null;
		}

		const existingColors = show.colors as {
			primary?: string;
			secondary?: string;
			accent?: string;
			muted?: string;
		} | null;
		if (existingColors?.primary) {
			return existingColors;
		}

		const colors = await this.colorExtraction.extractColorsFromPoster(
			show.posterPath,
		);
		if (!colors) {
			return existingColors ?? null;
		}

		await this.prisma.show.update({
			where: { showId },
			data: { colors },
		});

		return colors;
	}

	async getUserShows(userDid: string) {
		const trackedEpisodes = await this.prisma.trackedEpisode.findMany({
			where: { userDid },
			include: { show: true },
			orderBy: { watchedDate: "desc" },
		});

		const showMap = new Map<
			string,
			(typeof trackedEpisodes)[0] & { watchCount: number }
		>();
		for (const tracked of trackedEpisodes) {
			const existing = showMap.get(tracked.showId);
			if (!existing) {
				const watchCount = trackedEpisodes.filter(
					(te) => te.showId === tracked.showId,
				).length;
				showMap.set(tracked.showId, { ...tracked, watchCount });
			}
		}

		return Array.from(showMap.values());
	}

	async getUserUpNext(
		userDid: string,
		page: number = 1,
		pageSize: number = 8,
		sortBy: "lastWatched" | "title" | "progress" = "lastWatched",
		sortOrder: "asc" | "desc" = "desc",
	) {
		// Query 1: one anchor per show via Prisma distinct (S0 excluded, tie-broken)
		const anchors = (await this.prisma.trackedEpisode.findMany({
			where: { userDid, seasonNumber: { not: 0 } },
			orderBy: [
				{ watchedDate: "desc" },
				{ createdAt: "desc" },
				{ seasonNumber: "desc" },
				{ episodeNumber: "desc" },
			],
			distinct: ["showId"],
			include: { show: true },
		})) as TrackedEpisodeWithShow[];

		if (anchors.length === 0) {
			return {
				items: [],
				total: 0,
				page: 1,
				pageSize: Math.min(Math.max(pageSize, 1), 50),
				totalPages: 0,
				hasPreviousPage: false,
				hasNextPage: false,
			};
		}

		const showIds = anchors.map((a) => a.showId);
		const _anchorMap = new Map(anchors.map((a) => [a.showId, a]));
		const now = new Date();

		// Build VALUES clause for the raw SQL query
		const anchorValues = anchors
			.map(
				(a) =>
					`('${a.showId.replace(/'/g, "''")}', ${a.seasonNumber}, ${a.episodeNumber})`,
			)
			.join(", ");

		// Queries 2-4 run in parallel
		const [nextEpisodeRows, totalsByShow, watchedRaw] = await Promise.all([
			// Query 2: next episode for all anchors (raw SQL DISTINCT ON)
			this.prisma.$queryRaw<
				Array<{
					showId: string;
					seasonNumber: number;
					episodeNumber: number;
					name: string;
					airDate: Date | null;
					overview: string | null;
					stillPath: string | null;
				}>
			>(Prisma.sql`
				SELECT DISTINCT ON (e."showId")
					e."showId",
					e."seasonNumber",
					e."episodeNumber",
					e."name",
					e."airDate",
					e."overview",
					e."stillPath"
				FROM "Episode" e
				JOIN (VALUES ${Prisma.raw(anchorValues)}) AS anchors("showId", "seasonNumber", "episodeNumber")
					ON e."showId" = anchors."showId"
				WHERE e."seasonNumber" != 0
					AND e."airDate" IS NOT NULL
					AND e."airDate" <= ${now}
					AND (
						(e."seasonNumber" = anchors."seasonNumber" AND e."episodeNumber" > anchors."episodeNumber")
						OR e."seasonNumber" > anchors."seasonNumber"
					)
				ORDER BY e."showId", e."seasonNumber" ASC, e."episodeNumber" ASC
			`),

			// Query 3: total aired episodes per show
			this.prisma.episode.groupBy({
				by: ["showId"],
				where: {
					showId: { in: showIds },
					seasonNumber: { not: 0 },
					airDate: { not: null, lte: now },
				},
				_count: true,
			}),

			// Query 4: distinct watched episodes per show
			this.prisma.trackedEpisode.groupBy({
				by: ["showId", "seasonNumber", "episodeNumber"],
				where: {
					userDid,
					showId: { in: showIds },
					seasonNumber: { not: 0 },
				},
			}),
		]);

		// Build lookup maps
		const nextEpMap = new Map(nextEpisodeRows.map((r) => [r.showId, r]));
		const totalsMap = new Map(totalsByShow.map((r) => [r.showId, r._count]));
		const watchedCountMap = new Map<string, number>();
		for (const row of watchedRaw) {
			watchedCountMap.set(
				row.showId,
				(watchedCountMap.get(row.showId) ?? 0) + 1,
			);
		}

		// Assembly: join, filter, sort
		const items: Array<{
			showId: string;
			watchCount: number;
			totalEpisodes: number;
			episodesWatched: number;
			latestWatchedDate: string;
			lastWatched: { seasonNumber: number; episodeNumber: number };
			nextEpisode: {
				seasonNumber: number;
				episodeNumber: number;
				name: string;
				airDate?: string;
				overview?: string;
				stillPath?: string;
			};
			show: {
				showId: string;
				title: string;
				posterPath?: string;
				backdropPath?: string;
				firstAirYear?: number;
				firstAirDate?: string;
				overview?: string;
				colors?: unknown;
			};
		}> = [];

		for (const anchor of anchors) {
			const nextEp = nextEpMap.get(anchor.showId);
			if (!nextEp) continue;

			const totalEpisodes = totalsMap.get(anchor.showId) ?? 0;
			const episodesWatched = watchedCountMap.get(anchor.showId) ?? 0;

			if (totalEpisodes > 0 && episodesWatched >= totalEpisodes) continue;

			const colors = await this.ensureShowHasColors(anchor.showId);
			const latestWatchedDate = anchor.watchedDate ?? anchor.createdAt;

			items.push({
				showId: anchor.showId,
				watchCount: episodesWatched,
				totalEpisodes,
				episodesWatched,
				latestWatchedDate: latestWatchedDate.toISOString(),
				lastWatched: {
					seasonNumber: anchor.seasonNumber,
					episodeNumber: anchor.episodeNumber,
				},
				nextEpisode: {
					seasonNumber: nextEp.seasonNumber,
					episodeNumber: nextEp.episodeNumber,
					name: nextEp.name,
					airDate: nextEp.airDate?.toISOString(),
					overview: nextEp.overview ?? undefined,
					stillPath: nextEp.stillPath ?? undefined,
				},
				show: {
					showId: anchor.show.showId,
					title: anchor.show.title,
					posterPath: anchor.show.posterPath ?? undefined,
					backdropPath: anchor.show.backdropPath ?? undefined,
					firstAirYear: anchor.show.firstAirYear ?? undefined,
					firstAirDate: anchor.show.firstAirDate?.toISOString(),
					overview: anchor.show.overview ?? undefined,
					colors: colors ?? undefined,
				},
			});
		}

		const dir = sortOrder === "asc" ? 1 : -1;
		items.sort((a, b) => {
			switch (sortBy) {
				case "title":
					return dir * a.show.title.localeCompare(b.show.title);
				case "progress": {
					const pA =
						a.totalEpisodes > 0 ? a.episodesWatched / a.totalEpisodes : 0;
					const pB =
						b.totalEpisodes > 0 ? b.episodesWatched / b.totalEpisodes : 0;
					return dir * (pA - pB);
				}
				default:
					return (
						dir *
						(new Date(a.latestWatchedDate).getTime() -
							new Date(b.latestWatchedDate).getTime())
					);
			}
		});

		const safePageSize = Math.min(Math.max(pageSize, 1), 50);
		const total = items.length;
		const totalPages = total > 0 ? Math.ceil(total / safePageSize) : 0;
		const requestedPage = Math.max(page, 1);
		const currentPage =
			totalPages > 0 ? Math.min(requestedPage, totalPages) : 1;
		const start = (currentPage - 1) * safePageSize;
		const pagedItems =
			totalPages > 0 ? items.slice(start, start + safePageSize) : [];

		return {
			items: pagedItems,
			total,
			page: currentPage,
			pageSize: safePageSize,
			totalPages,
			hasPreviousPage: totalPages > 0 && currentPage > 1,
			hasNextPage: totalPages > 0 && currentPage < totalPages,
		};
	}

	async getUserReleaseCalendar(
		userDid: string,
		query?: { startDate?: string; endDate?: string },
	) {
		// Parse date range or default to all upcoming dates
		const startDate = query?.startDate
			? new Date(query.startDate)
			: new Date("1970-01-01");
		const endDate = query?.endDate
			? new Date(query.endDate)
			: new Date("2099-12-31");

		// Get shows the user is watching (has tracked episodes for)
		const trackedEpisodes = await this.prisma.trackedEpisode.findMany({
			where: { userDid },
			select: { showId: true },
			distinct: ["showId"],
		});

		const showIds = trackedEpisodes.map((t) => t.showId);

		// Query episodes from watched shows with air dates in range
		const episodes = await this.prisma.episode.findMany({
			where: {
				showId: { in: showIds },
				airDate: {
					gte: startDate,
					lte: endDate,
				},
			},
			include: {
				season: {
					include: {
						show: true,
					},
				},
			},
			orderBy: { airDate: "asc" },
		});

		const watchingItems: ReleaseCalendarItem[] = await Promise.all(
			episodes.map(async (episode) => {
				const show = episode.season.show;
				const colors = await this.ensureShowHasColors(show.showId);

				return {
					source: "watching" as const,
					mediaType: "show" as const,
					releaseKind: "episode" as const,
					releaseDate: episode.airDate?.toISOString().split("T")[0] ?? "",
					title: show.title,
					subtitle: `S${episode.seasonNumber} E${episode.episodeNumber} · ${episode.name}`,
					overview: episode.overview ?? show.overview ?? undefined,
					posterPath: show.posterPath ?? undefined,
					backdropPath: show.backdropPath ?? undefined,
					showId: show.showId,
					seasonNumber: episode.seasonNumber,
					episodeNumber: episode.episodeNumber,
					colors: (colors ?? show.colors ?? undefined) as
						| ReleaseCalendarColors
						| undefined,
				};
			}),
		);

		// Get watchlist
		const watchlist = await this.prisma.list.findFirst({
			where: { userDid, slug: "watchlist" },
			select: {
				items: {
					where: {
						OR: [
							{
								mediaType: "movie",
								movie: {
									releaseDate: {
										gte: startDate,
										lte: endDate,
									},
								},
							},
							{
								mediaType: "show",
								show: {
									firstAirDate: {
										gte: startDate,
										lte: endDate,
									},
								},
							},
						],
					},
					select: {
						mediaType: true,
						mediaId: true,
						movie: {
							select: {
								movieId: true,
								title: true,
								posterPath: true,
								backdropPath: true,
								releaseDate: true,
								overview: true,
								colors: true,
							},
						},
						show: {
							select: {
								showId: true,
								title: true,
								posterPath: true,
								backdropPath: true,
								firstAirDate: true,
								overview: true,
								colors: true,
							},
						},
					},
				},
			},
		});

		const watchlistItems: ReleaseCalendarItem[] = (
			watchlist?.items ?? []
		).flatMap((item): ReleaseCalendarItem[] => {
			const watchlistItem = item as WatchlistReleaseItem;

			if (watchlistItem.mediaType === "movie" && watchlistItem.movie) {
				return [
					{
						source: "watchlist" as const,
						mediaType: "movie" as const,
						releaseKind: "movie" as const,
						releaseDate:
							watchlistItem.movie.releaseDate?.toISOString().split("T")[0] ??
							"",
						title: watchlistItem.movie.title,
						subtitle: "Watchlist movie release",
						overview: watchlistItem.movie.overview ?? undefined,
						posterPath: watchlistItem.movie.posterPath ?? undefined,
						backdropPath: watchlistItem.movie.backdropPath ?? undefined,
						movieId: watchlistItem.movie.movieId,
						colors: watchlistItem.movie.colors as
							| ReleaseCalendarColors
							| undefined,
					},
				];
			}

			if (watchlistItem.mediaType === "show" && watchlistItem.show) {
				return [
					{
						source: "watchlist" as const,
						mediaType: "show" as const,
						releaseKind: "show" as const,
						releaseDate:
							watchlistItem.show.firstAirDate?.toISOString().split("T")[0] ??
							"",
						title: watchlistItem.show.title,
						subtitle: "Watchlist series release",
						overview: watchlistItem.show.overview ?? undefined,
						posterPath: watchlistItem.show.posterPath ?? undefined,
						backdropPath: watchlistItem.show.backdropPath ?? undefined,
						showId: watchlistItem.show.showId,
						colors: watchlistItem.show.colors as
							| ReleaseCalendarColors
							| undefined,
					},
				];
			}

			return [];
		});

		const items: ReleaseCalendarItem[] = [...watchingItems, ...watchlistItems]
			.filter((item) => item.releaseDate)
			.sort((left, right) => {
				const releaseDateCompare =
					this.parseReleaseDate(left.releaseDate).getTime() -
					this.parseReleaseDate(right.releaseDate).getTime();
				if (releaseDateCompare !== 0) {
					return releaseDateCompare;
				}

				return left.title.localeCompare(right.title);
			});

		return {
			items,
			total: items.length,
		};
	}

	async getUserEpisodesPaginated(
		userDid: string,
		limit: number = 20,
		cursor?: string,
	) {
		const take = limit + 1; // Take one extra to determine if there's a next page

		const episodes = await this.prisma.trackedEpisode.findMany({
			where: { userDid },
			include: { show: true },
			orderBy: { watchedDate: "desc" },
			take,
			...(cursor && {
				skip: 1,
				cursor: { id: cursor },
			}),
		});

		const hasMore = episodes.length > limit;
		const items = hasMore ? episodes.slice(0, limit) : episodes;
		const nextCursor = hasMore ? items[items.length - 1]?.id : null;

		// Get total count
		const total = await this.prisma.trackedEpisode.count({
			where: { userDid },
		});

		return {
			items,
			nextCursor,
			total,
		};
	}

	async getEpisodeWatchHistory(userDid: string, showId: string) {
		return this.prisma.trackedEpisode.findMany({
			where: { userDid, showId },
			orderBy: { watchedDate: "desc" },
		});
	}

	buildEpisodeWatchRecord(
		showId: string,
		seasonNumber: number,
		episodeNumber: number,
		customWatchedAt?: string,
	) {
		const rkey = TID.nextStr();
		const now = new Date().toISOString();
		const watchedAt = customWatchedAt
			? new Date(customWatchedAt).toISOString()
			: now;
		const record: EpisodeRecord = episodeSchema.build({
			showId,
			seasonNumber,
			episodeNumber,
			source: "tmdb",
			watchedAt,
			createdAt: now,
		});
		return { rkey, record, collection: COLLECTION };
	}

	async markEpisodeWatched(
		_userDid: string,
		session: ATSession,
		showId: string,
		seasonNumber: number,
		episodeNumber: number,
		customWatchedAt?: string,
	) {
		const rkey = TID.nextStr();
		const watchedAt = customWatchedAt
			? new Date(customWatchedAt).toISOString()
			: new Date().toISOString();
		const now = new Date().toISOString();

		const record: EpisodeRecord = episodeSchema.build({
			showId,
			seasonNumber,
			episodeNumber,
			source: "tmdb",
			watchedAt,
			createdAt: now,
		});

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);
		const response = await agent.com.atproto.repo.putRecord({
			repo: session.did,
			collection: COLLECTION,
			rkey,
			record,
			validate: false,
		});

		return {
			uri: response.data.uri,
			cid: response.data.cid,
			rkey,
			record,
		};
	}

	async indexTrackedEpisode(
		uri: string,
		cid: string,
		rkey: string,
		userDid: string,
		showId: string,
		seasonNumber: number,
		episodeNumber: number,
		watchedAt: string,
	) {
		const showData = await this.getShowDetails(showId);

		if (!showData || !showData.id) {
			throw new Error(
				`Failed to fetch show details for showId ${showId}: invalid response from TMDB`,
			);
		}

		const normalizedShowId = showData.id.toString();

		if (normalizedShowId !== showId) {
			this.logger.warn(
				`Show ID mismatch: requested ${showId}, TMDB returned ${normalizedShowId}. Using TMDB ID for tracked episode.`,
			);
		}

		await this.upsertShow(showData);
		await this.syncShowMetadata(normalizedShowId).catch((err) =>
			this.logger.warn(
				`Failed to sync metadata for show ${normalizedShowId}: ${err instanceof Error ? err.message : String(err)}`,
			),
		);

		return this.prisma.trackedEpisode.create({
			data: {
				uri,
				rkey,
				cid,
				userDid,
				showId: normalizedShowId,
				seasonNumber,
				episodeNumber,
				watchedDate: new Date(watchedAt),
				status: "watched",
			},
			include: { show: true },
		});
	}

	async unmarkEpisodeWatched(
		userDid: string,
		session: ATSession,
		showId: string,
		mode: "latest" | "all" = "latest",
		seasonNumber?: number,
		episodeNumber?: number,
	) {
		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		const where = {
			userDid,
			showId,
			...(seasonNumber !== undefined && { seasonNumber }),
			...(episodeNumber !== undefined && { episodeNumber }),
		};

		if (mode === "all") {
			const trackedEpisodes = await this.prisma.trackedEpisode.findMany({
				where,
				orderBy: { watchedDate: "desc" },
			});

			for (const tracked of trackedEpisodes) {
				try {
					await agent.com.atproto.repo.deleteRecord({
						repo: session.did,
						collection: COLLECTION,
						rkey: tracked.rkey,
					});
				} catch {
					this.logger.warn(
						`Failed to delete episode record ${tracked.rkey}, may not exist in PDS`,
					);
				}
			}

			return { showId, mode, deletedCount: trackedEpisodes.length };
		}

		const latestWatch = await this.prisma.trackedEpisode.findFirst({
			where,
			orderBy: { watchedDate: "desc" },
		});
		if (!latestWatch) {
			return { showId, mode };
		}

		await agent.com.atproto.repo.deleteRecord({
			repo: session.did,
			collection: COLLECTION,
			rkey: latestWatch.rkey,
		});

		return { showId, mode, rkey: latestWatch.rkey };
	}

	async removeAllTrackedEpisodes(
		userDid: string,
		showId: string,
		seasonNumber?: number,
		episodeNumber?: number,
	) {
		await this.prisma.trackedEpisode.deleteMany({
			where: {
				userDid,
				showId,
				...(seasonNumber !== undefined && { seasonNumber }),
				...(episodeNumber !== undefined && { episodeNumber }),
			},
		});
	}

	async removeLatestTrackedEpisode(
		userDid: string,
		showId: string,
		seasonNumber?: number,
		episodeNumber?: number,
	) {
		const latest = await this.prisma.trackedEpisode.findFirst({
			where: {
				userDid,
				showId,
				...(seasonNumber !== undefined && { seasonNumber }),
				...(episodeNumber !== undefined && { episodeNumber }),
			},
			orderBy: {
				watchedDate: "desc",
			},
		});

		if (latest) {
			await this.prisma.trackedEpisode.delete({
				where: {
					id: latest.id,
				},
			});
		}
	}

	async removeTrackedEpisodeById(
		userDid: string,
		session: ATSession,
		trackedEpisodeId: string,
	) {
		const trackedEpisode = await this.prisma.trackedEpisode.findFirst({
			where: {
				id: trackedEpisodeId,
				userDid,
			},
		});

		if (!trackedEpisode) {
			throw new Error("Tracked episode not found");
		}

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);
		await agent.com.atproto.repo.deleteRecord({
			repo: userDid,
			collection: COLLECTION,
			rkey: trackedEpisode.rkey,
		});

		await this.prisma.trackedEpisode.delete({
			where: {
				id: trackedEpisodeId,
			},
		});
	}

	async markSeasonWatched(
		userDid: string,
		session: ATSession,
		showId: string,
		seasonNumber: number,
		customWatchedAt?: string,
	) {
		const season = await this.getSeasonDetails(showId, seasonNumber);
		const episodes = season.episodes || [];

		if (episodes.length === 0) {
			return { episodes: [], count: 0 };
		}

		const watchedAt = customWatchedAt
			? new Date(customWatchedAt).toISOString()
			: new Date().toISOString();
		const now = new Date().toISOString();

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		const results: Array<{
			uri: string;
			cid: string;
			rkey: string;
			record: EpisodeRecord;
			seasonNumber: number;
			episodeNumber: number;
		}> = [];

		for (const episode of episodes) {
			const rkey = TID.nextStr();
			const record: EpisodeRecord = episodeSchema.build({
				showId,
				seasonNumber,
				episodeNumber: episode.episode_number,
				source: "tmdb",
				watchedAt,
				createdAt: now,
			});

			const response = await agent.com.atproto.repo.putRecord({
				repo: session.did,
				collection: COLLECTION,
				rkey,
				record,
				validate: false,
			});

			results.push({
				uri: response.data.uri,
				cid: response.data.cid,
				rkey,
				record,
				seasonNumber,
				episodeNumber: episode.episode_number,
			});
		}

		const showData = await this.getShowDetails(showId);

		if (!showData || !showData.id) {
			throw new Error(
				`Failed to fetch show details for showId ${showId}: invalid response from TMDB`,
			);
		}

		const normalizedShowId = showData.id.toString();

		await this.upsertShow(showData);
		await this.syncShowMetadata(normalizedShowId).catch((err) =>
			this.logger.warn(
				`Failed to sync metadata for show ${normalizedShowId}: ${err instanceof Error ? err.message : String(err)}`,
			),
		);

		const trackedEpisodes: Array<{
			id: string;
			rkey: string;
			uri: string;
			cid: string;
			userDid: string;
			showId: string;
			seasonNumber: number;
			episodeNumber: number;
			status: string;
			watchedDate: Date | null;
			createdAt: Date;
			updatedAt: Date;
			show: {
				showId: string;
				title: string;
				posterPath: string | null;
				backdropPath: string | null;
				firstAirYear: number | null;
				firstAirDate: Date | null;
				overview: string | null;
				colors: unknown;
				createdAt: Date;
				updatedAt: Date;
			};
		}> = [];
		for (const result of results) {
			try {
				const tracked = await this.prisma.trackedEpisode.create({
					data: {
						uri: result.uri,
						rkey: result.rkey,
						cid: result.cid,
						userDid,
						showId: normalizedShowId,
						seasonNumber: result.seasonNumber,
						episodeNumber: result.episodeNumber,
						watchedDate: new Date(watchedAt),
						status: "watched",
					},
					include: { show: true },
				});
				trackedEpisodes.push(tracked);
			} catch (err: unknown) {
				this.logger.warn(
					{ err: err instanceof Error ? err.message : String(err) },
					"Failed to index episode, firehose will catch it",
				);
			}
		}

		return { episodes: trackedEpisodes, count: results.length };
	}

	async markShowWatched(
		userDid: string,
		session: ATSession,
		showId: string,
		customWatchedAt?: string,
	) {
		const show = await this.getShowDetails(showId);
		const numberOfSeasons = show.number_of_seasons || 1;

		const watchedAt = customWatchedAt
			? new Date(customWatchedAt).toISOString()
			: new Date().toISOString();

		const allResults: Array<{
			uri: string;
			cid: string;
			rkey: string;
			record: EpisodeRecord;
			seasonNumber: number;
			episodeNumber: number;
		}> = [];

		for (let seasonNum = 1; seasonNum <= numberOfSeasons; seasonNum++) {
			const season = await this.getSeasonDetails(showId, seasonNum);
			const episodes = season.episodes || [];

			const now = new Date().toISOString();

			const agent = new Agent(
				session as unknown as ConstructorParameters<typeof Agent>[0],
			);

			for (const episode of episodes) {
				const rkey = TID.nextStr();
				const record: EpisodeRecord = episodeSchema.build({
					showId,
					seasonNumber: seasonNum,
					episodeNumber: episode.episode_number,
					source: "tmdb",
					watchedAt,
					createdAt: now,
				});

				const response = await agent.com.atproto.repo.putRecord({
					repo: session.did,
					collection: COLLECTION,
					rkey,
					record,
					validate: false,
				});

				allResults.push({
					uri: response.data.uri,
					cid: response.data.cid,
					rkey,
					record,
					seasonNumber: seasonNum,
					episodeNumber: episode.episode_number,
				});
			}
		}

		const showData = await this.getShowDetails(showId);

		if (!showData || !showData.id) {
			throw new Error(
				`Failed to fetch show details for showId ${showId}: invalid response from TMDB`,
			);
		}

		const normalizedShowId = showData.id.toString();

		await this.upsertShow(showData);
		await this.syncShowMetadata(normalizedShowId).catch((err) =>
			this.logger.warn(
				`Failed to sync metadata for show ${normalizedShowId}: ${err instanceof Error ? err.message : String(err)}`,
			),
		);

		const trackedEpisodes: Array<{
			id: string;
			rkey: string;
			uri: string;
			cid: string;
			userDid: string;
			showId: string;
			seasonNumber: number;
			episodeNumber: number;
			status: string;
			watchedDate: Date | null;
			createdAt: Date;
			updatedAt: Date;
			show: {
				showId: string;
				title: string;
				posterPath: string | null;
				backdropPath: string | null;
				firstAirYear: number | null;
				firstAirDate: Date | null;
				overview: string | null;
				colors: unknown;
				createdAt: Date;
				updatedAt: Date;
			};
		}> = [];
		for (const result of allResults) {
			try {
				const tracked = await this.prisma.trackedEpisode.create({
					data: {
						uri: result.uri,
						rkey: result.rkey,
						cid: result.cid,
						userDid,
						showId: normalizedShowId,
						seasonNumber: result.seasonNumber,
						episodeNumber: result.episodeNumber,
						watchedDate: new Date(watchedAt),
						status: "watched",
					},
					include: { show: true },
				});
				trackedEpisodes.push(tracked);
			} catch (err: unknown) {
				this.logger.warn(
					{ err: err instanceof Error ? err.message : String(err) },
					"Failed to index episode, firehose will catch it",
				);
			}
		}

		return { episodes: trackedEpisodes, count: allResults.length };
	}

	private parseReleaseDate(value: string | Date) {
		if (value instanceof Date) {
			return value;
		}

		if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
			return new Date(`${value}T12:00:00Z`);
		}

		return new Date(value);
	}
}
