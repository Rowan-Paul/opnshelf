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
		return this.showsTmdb.getEpisodeContext(
			showId,
			seasonNumber,
			episodeNumber,
		);
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

	async getUserUpNext(userDid: string, page: number = 1, pageSize: number = 8) {
		const trackedEpisodes = (await this.prisma.trackedEpisode.findMany({
			where: { userDid },
			include: { show: true },
			orderBy: [{ watchedDate: "desc" }, { createdAt: "desc" }],
		})) as TrackedEpisodeWithShow[];

		const showMap = new Map<
			string,
			{
				latest: TrackedEpisodeWithShow;
				watchCount: number;
				latestWatchedDate: Date;
			}
		>();

		for (const tracked of trackedEpisodes) {
			const latestWatchedDate = tracked.watchedDate ?? tracked.createdAt;
			const existing = showMap.get(tracked.showId);

			if (!existing) {
				showMap.set(tracked.showId, {
					latest: tracked,
					watchCount: 1,
					latestWatchedDate,
				});
				continue;
			}

			existing.watchCount += 1;
		}

		const allItems = await Promise.all(
			Array.from(showMap.values()).map(
				async ({ latest, watchCount, latestWatchedDate }) => {
					try {
						const context = await this.showsTmdb.getEpisodeContext(
							latest.showId,
							latest.seasonNumber,
							latest.episodeNumber,
						);

						if (!context.next) {
							return null;
						}

						const nextEpisode = await this.showsTmdb.getEpisodeDetails(
							latest.showId,
							context.next.seasonNumber,
							context.next.episodeNumber,
						);
						const colors = await this.ensureShowHasColors(latest.showId);

						return {
							showId: latest.showId,
							watchCount,
							latestWatchedDate: latestWatchedDate.toISOString(),
							lastWatched: {
								seasonNumber: latest.seasonNumber,
								episodeNumber: latest.episodeNumber,
							},
							nextEpisode: {
								seasonNumber: nextEpisode.season_number,
								episodeNumber: nextEpisode.episode_number,
								name: nextEpisode.name,
								airDate: nextEpisode.air_date,
								overview: nextEpisode.overview,
								stillPath: nextEpisode.still_path,
							},
							show: {
								showId: latest.show.showId,
								title: latest.show.title,
								posterPath: latest.show.posterPath ?? undefined,
								backdropPath: latest.show.backdropPath ?? undefined,
								firstAirYear: latest.show.firstAirYear ?? undefined,
								firstAirDate: latest.show.firstAirDate?.toISOString(),
								overview: latest.show.overview ?? undefined,
								colors: colors ?? undefined,
							},
						};
					} catch (error) {
						this.logger.warn(
							`Failed to compute up next for show ${latest.showId}: ${error instanceof Error ? error.message : String(error)}`,
						);
						return null;
					}
				},
			),
		);

		const items = allItems.filter(
			(item): item is NonNullable<typeof item> => item !== null,
		);
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
		await this.upsertShow(showData);

		return this.prisma.trackedEpisode.create({
			data: {
				uri,
				rkey,
				cid,
				userDid,
				showId,
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
		await this.upsertShow(showData);

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
						showId,
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
		await this.upsertShow(showData);

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
						showId,
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
}
