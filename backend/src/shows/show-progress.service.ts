import { Injectable } from "@nestjs/common";
import { Prisma } from "../generated/client";
import { PrismaService } from "../prisma/prisma.service";
import { ShowCatalogueService } from "./show-catalogue.service";

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

function parseReleaseDate(value: string | Date) {
	if (value instanceof Date) {
		return value;
	}

	if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return new Date(`${value}T12:00:00Z`);
	}

	return new Date(value);
}

/**
 * Read models over a user's episode Watches: which Shows they follow, what is
 * Up Next, per-Show progress, the release calendar, and Watch history.
 */
@Injectable()
export class ShowProgressService {
	constructor(
		private prisma: PrismaService,
		private catalogue: ShowCatalogueService,
	) {}

	async getUserShows(userDid: string) {
		const trackedEpisodes = await this.prisma.trackedEpisode.findMany({
			where: { userDid },
			include: { show: true },
			orderBy: { watchedDate: "desc" },
		});

		// Counts TrackedEpisode rows, so rewatches count again: this is episode
		// Watches for the show, not distinct episodes watched.
		const showMap = new Map<
			string,
			(typeof trackedEpisodes)[0] & { episodeWatchCount: number }
		>();
		for (const tracked of trackedEpisodes) {
			const existing = showMap.get(tracked.showId);
			if (!existing) {
				showMap.set(tracked.showId, { ...tracked, episodeWatchCount: 1 });
			} else {
				existing.episodeWatchCount += 1;
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
		showIdFilter?: string,
	) {
		// Query 1: one anchor per show via Prisma distinct (S0 excluded, tie-broken)
		const anchors = (await this.prisma.trackedEpisode.findMany({
			where: {
				userDid,
				seasonNumber: { not: 0 },
				...(showIdFilter ? { showId: showIdFilter } : {}),
			},
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
		const now = new Date();

		// Parameterised VALUES rows for the raw SQL query. Explicit casts keep
		// the column types inferable for the join and comparisons below.
		const anchorRows = Prisma.join(
			anchors.map(
				(a) =>
					Prisma.sql`(${a.showId}::text, ${a.seasonNumber}::int, ${a.episodeNumber}::int)`,
			),
		);

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
				JOIN (VALUES ${anchorRows}) AS anchors("showId", "seasonNumber", "episodeNumber")
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

			const latestWatchedDate = anchor.watchedDate ?? anchor.createdAt;

			items.push({
				showId: anchor.showId,
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
					colors: undefined,
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
		await Promise.all(
			pagedItems.map(async (item) => {
				item.show.colors =
					(await this.catalogue.ensureShowHasColors(item.showId)) ?? undefined;
			}),
		);

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
				const colors = await this.catalogue.ensureShowHasColors(show.showId);

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
					parseReleaseDate(left.releaseDate).getTime() -
					parseReleaseDate(right.releaseDate).getTime();
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

	async getShowProgress(userDid: string, showIds: string[]) {
		const ids = [...new Set(showIds)];
		const now = new Date();
		const watches = await this.prisma.trackedEpisode.findMany({
			where: { userDid, showId: { in: ids } },
			select: { showId: true, seasonNumber: true, episodeNumber: true },
		});
		const loadMetadata = () =>
			Promise.all([
				this.prisma.season.findMany({
					where: { showId: { in: ids }, seasonNumber: { gt: 0 } },
					select: { showId: true, seasonNumber: true, episodeCount: true },
				}),
				this.prisma.episode.findMany({
					where: { showId: { in: ids }, seasonNumber: { gt: 0 } },
					select: {
						showId: true,
						seasonNumber: true,
						episodeNumber: true,
						airDate: true,
					},
				}),
			]);
		const [seasons, episodes] = await loadMetadata();
		const watchedByShow = new Map<string, Set<string>>();
		for (const watch of watches) {
			const entries = watchedByShow.get(watch.showId) ?? new Set<string>();
			entries.add(`${watch.seasonNumber}:${watch.episodeNumber}`);
			watchedByShow.set(watch.showId, entries);
		}
		const seasonsByShow = new Map<string, typeof seasons>();
		for (const season of seasons) {
			const entries = seasonsByShow.get(season.showId) ?? [];
			entries.push(season);
			seasonsByShow.set(season.showId, entries);
		}
		const episodesByShow = new Map<string, typeof episodes>();
		for (const episode of episodes) {
			const entries = episodesByShow.get(episode.showId) ?? [];
			entries.push(episode);
			episodesByShow.set(episode.showId, entries);
		}
		const hasCompleteMetadata = (showId: string) => {
			const showSeasons = seasonsByShow.get(showId) ?? [];
			const showEpisodes = episodesByShow.get(showId) ?? [];
			return (
				showSeasons.length > 0 &&
				showSeasons.every(
					(season) =>
						season.episodeCount !== null &&
						showEpisodes.filter(
							(episode) => episode.seasonNumber === season.seasonNumber,
						).length === season.episodeCount,
				)
			);
		};

		return ids.map((showId) => {
			const showSeasons = seasonsByShow.get(showId) ?? [];
			const showEpisodes = episodesByShow.get(showId) ?? [];
			const isComplete = hasCompleteMetadata(showId);
			const watched = watchedByShow.get(showId) ?? new Set<string>();
			if (!isComplete) {
				return {
					showId,
					hasWatches: watched.size > 0,
					episodesWatched: watched.size,
					episodesTotal: 0,
					state: "unavailable" as const,
					remainingEpisodes: 0,
					percentage: 0,
					seasons: [],
				};
			}

			let episodesWatched = 0;
			let episodesTotal = 0;
			const seasonProgress = showSeasons.map((season) => {
				const eligible = showEpisodes.filter(
					(episode) =>
						episode.seasonNumber === season.seasonNumber &&
						episode.airDate !== null &&
						episode.airDate <= now,
				);
				const watchedCount = eligible.filter((episode) =>
					watched.has(`${season.seasonNumber}:${episode.episodeNumber}`),
				).length;
				episodesWatched += watchedCount;
				episodesTotal += eligible.length;
				const remainingEpisodes = Math.max(eligible.length - watchedCount, 0);
				return {
					seasonNumber: season.seasonNumber,
					episodesWatched: watchedCount,
					episodesTotal: eligible.length,
					state:
						eligible.length === 0 || watchedCount === 0
							? ("unwatched" as const)
							: watchedCount === eligible.length
								? ("complete" as const)
								: ("partial" as const),
					remainingEpisodes,
					percentage:
						eligible.length === 0
							? 0
							: Math.round((watchedCount / eligible.length) * 100),
				};
			});
			const remainingEpisodes = Math.max(episodesTotal - episodesWatched, 0);
			return {
				showId,
				hasWatches: watched.size > 0,
				episodesWatched,
				episodesTotal,
				state:
					episodesTotal === 0 || episodesWatched === 0
						? ("unwatched" as const)
						: episodesWatched === episodesTotal
							? ("complete" as const)
							: ("partial" as const),
				remainingEpisodes,
				percentage:
					episodesTotal === 0
						? 0
						: Math.round((episodesWatched / episodesTotal) * 100),
				seasons: seasonProgress,
			};
		});
	}
}
