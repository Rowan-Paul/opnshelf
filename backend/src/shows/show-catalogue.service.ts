import { Injectable, Logger } from "@nestjs/common";
import { ColorExtractionService } from "../movies/color-extraction.service";
import { PrismaService } from "../prisma/prisma.service";
import {
	ShowsTmdbService,
	type TMDBSeason,
	type TMDBShow,
} from "./shows-tmdb.service";

export type ShowColors = {
	primary?: string;
	secondary?: string;
	accent?: string;
	muted?: string;
};

/**
 * The persisted Show / Season / Episode catalogue: TMDB metadata indexed into
 * Postgres, plus the local reads that prefer that index over a TMDB round-trip.
 */
@Injectable()
export class ShowCatalogueService {
	private readonly logger = new Logger(ShowCatalogueService.name);

	constructor(
		private prisma: PrismaService,
		private colorExtraction: ColorExtractionService,
		private showsTmdb: ShowsTmdbService,
	) {}

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

	async syncShowMetadata(
		showId: string,
		options: { force?: boolean } = {},
	): Promise<void> {
		const STALE_MS = 24 * 60 * 60 * 1000;
		const existingSeasons = await this.prisma.season.findMany({
			where: { showId, seasonNumber: { gt: 0 } },
			select: {
				seasonNumber: true,
				episodeCount: true,
				updatedAt: true,
				_count: { select: { episodes: true } },
			},
		});
		const newestMetadata = existingSeasons.reduce<Date | undefined>(
			(newest, season) =>
				!newest || season.updatedAt > newest ? season.updatedAt : newest,
			undefined,
		);
		const catalogueComplete =
			existingSeasons.length > 0 &&
			existingSeasons.every(
				(season) =>
					season.episodeCount !== null &&
					season._count.episodes === season.episodeCount,
			);
		if (
			!options.force &&
			catalogueComplete &&
			newestMetadata &&
			Date.now() - newestMetadata.getTime() < STALE_MS
		) {
			return;
		}

		const show = await this.showsTmdb.getShowDetails(showId);
		const dbShowId = show.id.toString();
		await this.upsertShow(show);
		const tmdbSeasons = (show.seasons ?? []).filter(
			(s) => s.season_number !== 0,
		);
		const failedSeasonNumbers: number[] = [];

		for (const tmdbSeason of tmdbSeasons) {
			let seasonDetail: TMDBSeason;
			try {
				seasonDetail = await this.showsTmdb.getSeasonDetails(
					showId,
					tmdbSeason.season_number,
				);
			} catch {
				failedSeasonNumbers.push(tmdbSeason.season_number);
				this.logger.warn(
					`Failed to fetch season ${tmdbSeason.season_number} for show ${showId}`,
				);
				continue;
			}

			const season = await this.prisma.season.upsert({
				where: {
					showId_seasonNumber: {
						showId: dbShowId,
						seasonNumber: tmdbSeason.season_number,
					},
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
					tmdbId: tmdbSeason.id,
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
		// A detail response is the catalogue lifecycle boundary. Returning it after
		// a failed season fetch would cache a misleading denominator on clients.
		if (failedSeasonNumbers.length > 0) {
			throw new Error(
				`Could not synchronize seasons ${failedSeasonNumbers.join(", ")} for show ${showId}`,
			);
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

	async ensureShowHasColors(showId: string): Promise<ShowColors | null> {
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

		const existingColors = show.colors as ShowColors | null;
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
}
