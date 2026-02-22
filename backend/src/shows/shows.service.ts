import { Agent } from "@atproto/api";
import { TID } from "@atproto/common";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
	$nsid as COLLECTION,
	main as episodeSchema,
} from "../lexicons/app/opnshelf/episode";
import type { Main as EpisodeRecord } from "../lexicons/app/opnshelf/episode.defs";
import { ColorExtractionService } from "../movies/color-extraction.service";
import { PrismaService } from "../prisma/prisma.service";

export interface ATSession {
	did: string;
}

export interface TMDBShow {
	id: number;
	name: string;
	poster_path?: string;
	backdrop_path?: string;
	first_air_date?: string;
	overview?: string;
	genres?: Array<{ id: number; name: string }>;
	number_of_seasons?: number;
	number_of_episodes?: number;
	popularity: number;
	vote_average: number;
	vote_count: number;
}

export interface TMDBSearchResponse {
	page: number;
	results: TMDBShow[];
	total_results: number;
	total_pages: number;
}

export interface TMDBCredits {
	cast: {
		id: number;
		name: string;
		character?: string;
		profile_path?: string;
		order: number;
	}[];
	crew: {
		id: number;
		name: string;
		job?: string;
		department?: string;
		profile_path?: string;
	}[];
}

export interface TMDBEpisode {
	id: number;
	name: string;
	episode_number: number;
	season_number: number;
	air_date?: string;
	overview?: string;
	still_path?: string;
	vote_average?: number;
}

export interface TMDBSeason {
	id: number;
	name: string;
	season_number: number;
	overview?: string;
	poster_path?: string;
	air_date?: string;
	episodes: TMDBEpisode[];
}

@Injectable()
export class ShowsService {
	private readonly logger = new Logger(ShowsService.name);
	private readonly tmdbApiKey: string;
	private readonly tmdbBaseUrl = "https://api.themoviedb.org/3";

	constructor(
		private prisma: PrismaService,
		private config: ConfigService,
		private colorExtraction: ColorExtractionService,
	) {
		this.tmdbApiKey = this.config.get("TMDB_API_KEY") ?? "";
	}

	async searchShows(
		query: string,
		page: number = 1,
	): Promise<TMDBSearchResponse> {
		const response = await fetch(
			`${this.tmdbBaseUrl}/search/tv?api_key=${this.tmdbApiKey}&query=${encodeURIComponent(query)}&page=${page}`,
		);

		if (!response.ok) {
			throw new Error("Failed to search shows");
		}

		return response.json() as Promise<TMDBSearchResponse>;
	}

	async discoverShows(
		sortBy: string = "popularity.desc",
		page: number = 1,
		year?: number,
	): Promise<TMDBSearchResponse> {
		let url = `${this.tmdbBaseUrl}/discover/tv?api_key=${this.tmdbApiKey}&sort_by=${sortBy}&page=${page}`;

		if (year) {
			url += `&first_air_date_year=${year}`;
		}

		const response = await fetch(url);

		if (!response.ok) {
			throw new Error("Failed to discover shows");
		}

		return response.json() as Promise<TMDBSearchResponse>;
	}

	async getShowDetails(showId: string): Promise<TMDBShow> {
		const response = await fetch(
			`${this.tmdbBaseUrl}/tv/${showId}?api_key=${this.tmdbApiKey}`,
		);

		if (!response.ok) {
			throw new Error("Show not found");
		}

		return response.json() as Promise<TMDBShow>;
	}

	async getShowCredits(showId: string): Promise<TMDBCredits | null> {
		const response = await fetch(
			`${this.tmdbBaseUrl}/tv/${showId}/credits?api_key=${this.tmdbApiKey}`,
		);

		if (!response.ok) {
			this.logger.warn(`Failed to fetch credits for show ${showId}`);
			return null;
		}

		const data = (await response.json()) as TMDBCredits;
		const sortedCast = (data.cast || [])
			.sort((a, b) => (a.order || 0) - (b.order || 0))
			.slice(0, 15);
		const keyJobs = [
			"Director",
			"Producer",
			"Executive Producer",
			"Screenplay",
			"Writer",
			"Creator",
			"Original Music Composer",
			"Composer",
		];
		const filteredCrew = (data.crew || [])
			.filter((member) => keyJobs.includes(member.job || ""))
			.slice(0, 10);

		return {
			cast: sortedCast,
			crew: filteredCrew,
		};
	}

	async getSeasonDetails(
		showId: string,
		seasonNumber: number,
	): Promise<TMDBSeason> {
		const response = await fetch(
			`${this.tmdbBaseUrl}/tv/${showId}/season/${seasonNumber}?api_key=${this.tmdbApiKey}`,
		);
		if (!response.ok) {
			throw new Error("Season not found");
		}
		return response.json() as Promise<TMDBSeason>;
	}

	async getEpisodeDetails(
		showId: string,
		seasonNumber: number,
		episodeNumber: number,
	): Promise<TMDBEpisode> {
		const response = await fetch(
			`${this.tmdbBaseUrl}/tv/${showId}/season/${seasonNumber}/episode/${episodeNumber}?api_key=${this.tmdbApiKey}`,
		);
		if (!response.ok) {
			throw new Error("Episode not found");
		}
		return response.json() as Promise<TMDBEpisode>;
	}

	async getEpisodeContext(
		showId: string,
		seasonNumber: number,
		episodeNumber: number,
	): Promise<{
		previous: { seasonNumber: number; episodeNumber: number } | null;
		next: { seasonNumber: number; episodeNumber: number } | null;
	}> {
		const show = await this.getShowDetails(showId);
		const numberOfSeasons = show.number_of_seasons || 1;

		let previous: { seasonNumber: number; episodeNumber: number } | null = null;
		let next: { seasonNumber: number; episodeNumber: number } | null = null;

		// Try to find previous episode
		// First check current season for previous episode
		const currentSeason = await this.getSeasonDetails(showId, seasonNumber);
		const currentEpisodes = currentSeason.episodes || [];

		const prevInCurrentSeason = currentEpisodes.find(
			(e) => e.episode_number === episodeNumber - 1,
		);
		if (prevInCurrentSeason) {
			previous = { seasonNumber, episodeNumber: episodeNumber - 1 };
		} else if (seasonNumber > 1) {
			// Look in previous seasons
			for (let s = seasonNumber - 1; s >= 1; s--) {
				const prevSeason = await this.getSeasonDetails(showId, s);
				const prevEpisodes = prevSeason.episodes || [];
				if (prevEpisodes.length > 0) {
					const lastEpisode = prevEpisodes.reduce((max, ep) =>
						ep.episode_number > max.episode_number ? ep : max,
					);
					if (lastEpisode) {
						previous = {
							seasonNumber: s,
							episodeNumber: lastEpisode.episode_number,
						};
						break;
					}
				}
			}
		}

		// Try to find next episode
		const nextInCurrentSeason = currentEpisodes.find(
			(e) => e.episode_number === episodeNumber + 1,
		);
		if (nextInCurrentSeason) {
			next = { seasonNumber, episodeNumber: episodeNumber + 1 };
		} else {
			// Look in next seasons
			for (let s = seasonNumber + 1; s <= numberOfSeasons; s++) {
				const nextSeason = await this.getSeasonDetails(showId, s);
				const nextEpisodes = nextSeason.episodes || [];
				if (nextEpisodes.length > 0) {
					const firstEpisode = nextEpisodes.reduce((min, ep) =>
						ep.episode_number < min.episode_number ? ep : min,
					);
					if (firstEpisode) {
						next = {
							seasonNumber: s,
							episodeNumber: firstEpisode.episode_number,
						};
						break;
					}
				}
			}
		}

		return { previous, next };
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
