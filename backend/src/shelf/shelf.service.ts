import { Injectable } from "@nestjs/common";
import { Prisma } from "../generated/client";
import { PrismaService } from "../prisma/prisma.service";
import { ColorExtractionService } from "../movies/color-extraction.service";

interface ShelfItem {
	id: string;
	type: "movie" | "episode";
	watchedDate: Date | null;
	createdAt: Date;
	data: MovieData | EpisodeData;
}

interface MovieData {
	id: string;
	movieId: string;
	title: string;
	posterPath?: string;
	backdropPath?: string;
	releaseYear?: number;
	releaseDate?: Date;
	overview?: string;
	colors?: unknown;
	watchedDate: Date | null;
	createdAt: Date;
}

interface EpisodeData {
	id: string;
	showId: string;
	showTitle: string;
	seasonNumber: number;
	episodeNumber: number;
	posterPath?: string;
	backdropPath?: string;
	firstAirYear?: number;
	firstAirDate?: Date;
	overview?: string;
	colors?: unknown;
	watchedDate: Date | null;
	createdAt: Date;
}

interface RawShelfRow {
	trackedId: string;
	type: "movie" | "episode";
	watchedDate: Date | null;
	createdAt: Date;
	movieId: string | null;
	showId: string | null;
	title: string;
	posterPath: string | null;
	backdropPath: string | null;
	releaseYear: number | null;
	releaseDate: Date | null;
	seasonNumber: number | null;
	episodeNumber: number | null;
	firstAirYear: number | null;
	firstAirDate: Date | null;
	overview: string | null;
}

@Injectable()
export class ShelfService {
	constructor(
		private prisma: PrismaService,
		private colorExtraction: ColorExtractionService,
	) {}

	async getUserShelf(
		userDid: string,
		page: number = 1,
		pageSize: number = 20,
	): Promise<{
		items: ShelfItem[];
		total: number;
		page: number;
		pageSize: number;
		totalPages: number;
		hasPreviousPage: boolean;
		hasNextPage: boolean;
	}> {
		const safePageSize = Math.min(Math.max(pageSize, 1), 50);
		const requestedPage = Math.max(page, 1);

		const [trackedMovieCount, trackedEpisodeCount] = await Promise.all([
			this.prisma.trackedMovie.count({ where: { userDid } }),
			this.prisma.trackedEpisode.count({ where: { userDid } }),
		]);

		const total = trackedMovieCount + trackedEpisodeCount;
		const totalPages = total > 0 ? Math.ceil(total / safePageSize) : 0;
		const currentPage =
			totalPages > 0 ? Math.min(requestedPage, totalPages) : 1;
		const offset = (currentPage - 1) * safePageSize;

		const rows =
			total === 0
				? []
				: await this.prisma.$queryRaw<RawShelfRow[]>(Prisma.sql`
					SELECT
						shelf."trackedId",
						shelf."type",
						shelf."watchedDate",
						shelf."createdAt",
						shelf."movieId",
						shelf."showId",
						shelf."title",
						shelf."posterPath",
						shelf."backdropPath",
						shelf."releaseYear",
						shelf."releaseDate",
						shelf."seasonNumber",
						shelf."episodeNumber",
						shelf."firstAirYear",
						shelf."firstAirDate",
						shelf."overview"
					FROM (
						SELECT
							tm.id AS "trackedId",
							'movie' AS "type",
							tm."watchedDate" AS "watchedDate",
							tm."createdAt" AS "createdAt",
							COALESCE(tm."watchedDate", tm."createdAt") AS "sortDate",
							tm."movieId" AS "movieId",
							NULL::text AS "showId",
							m.title AS "title",
							m."posterPath" AS "posterPath",
							m."backdropPath" AS "backdropPath",
							m."releaseYear" AS "releaseYear",
							m."releaseDate" AS "releaseDate",
							NULL::integer AS "seasonNumber",
							NULL::integer AS "episodeNumber",
							NULL::integer AS "firstAirYear",
							NULL::timestamp AS "firstAirDate",
							m.overview AS "overview"
						FROM "TrackedMovie" tm
						INNER JOIN "Movie" m ON m."movieId" = tm."movieId"
						WHERE tm."userDid" = ${userDid}

						UNION ALL

						SELECT
							te.id AS "trackedId",
							'episode' AS "type",
							te."watchedDate" AS "watchedDate",
							te."createdAt" AS "createdAt",
							COALESCE(te."watchedDate", te."createdAt") AS "sortDate",
							NULL::text AS "movieId",
							te."showId" AS "showId",
							s.title AS "title",
							s."posterPath" AS "posterPath",
							s."backdropPath" AS "backdropPath",
							NULL::integer AS "releaseYear",
							NULL::timestamp AS "releaseDate",
							te."seasonNumber" AS "seasonNumber",
							te."episodeNumber" AS "episodeNumber",
							s."firstAirYear" AS "firstAirYear",
							s."firstAirDate" AS "firstAirDate",
							s.overview AS "overview"
						FROM "TrackedEpisode" te
						INNER JOIN "Show" s ON s."showId" = te."showId"
						WHERE te."userDid" = ${userDid}
					) shelf
					ORDER BY
						shelf."sortDate" DESC,
						shelf."createdAt" DESC,
						shelf."type" DESC,
						shelf."trackedId" DESC
					OFFSET ${offset}
					LIMIT ${safePageSize}
				`);

		const items = await Promise.all(
			rows.map(async (row) => {
				if (row.type === "movie" && row.movieId) {
					const colors = await this.ensureMovieHasColors(row.movieId);
					return {
						id: row.trackedId,
						type: "movie" as const,
						watchedDate: row.watchedDate,
						createdAt: row.createdAt,
						data: {
							id: row.trackedId,
							movieId: row.movieId,
							title: row.title,
							posterPath: row.posterPath ?? undefined,
							backdropPath: row.backdropPath ?? undefined,
							releaseYear: row.releaseYear ?? undefined,
							releaseDate: row.releaseDate ?? undefined,
							overview: row.overview ?? undefined,
							colors,
							watchedDate: row.watchedDate,
							createdAt: row.createdAt,
						},
					};
				}

				if (
					row.type === "episode" &&
					row.showId &&
					row.seasonNumber !== null &&
					row.episodeNumber !== null
				) {
					const colors = await this.ensureShowHasColors(row.showId);
					return {
						id: row.trackedId,
						type: "episode" as const,
						watchedDate: row.watchedDate,
						createdAt: row.createdAt,
						data: {
							id: row.trackedId,
							showId: row.showId,
							showTitle: row.title,
							seasonNumber: row.seasonNumber,
							episodeNumber: row.episodeNumber,
							posterPath: row.posterPath ?? undefined,
							backdropPath: row.backdropPath ?? undefined,
							firstAirYear: row.firstAirYear ?? undefined,
							firstAirDate: row.firstAirDate ?? undefined,
							overview: row.overview ?? undefined,
							colors,
							watchedDate: row.watchedDate,
							createdAt: row.createdAt,
						},
					};
				}

				throw new Error(`Invalid shelf row for user ${userDid}`);
			}),
		);

		return {
			items,
			total,
			page: currentPage,
			pageSize: safePageSize,
			totalPages,
			hasPreviousPage: totalPages > 0 && currentPage > 1,
			hasNextPage: totalPages > 0 && currentPage < totalPages,
		};
	}

	private async ensureMovieHasColors(movieId: string): Promise<{
		primary?: string;
		secondary?: string;
		accent?: string;
		muted?: string;
	} | null> {
		const movie = await this.prisma.movie.findUnique({
			where: { movieId },
			select: {
				posterPath: true,
				colors: true,
			},
		});

		if (!movie) {
			return null;
		}

		const existingColors = movie.colors as {
			primary?: string;
			secondary?: string;
			accent?: string;
			muted?: string;
		} | null;

		if (existingColors?.primary) {
			return existingColors;
		}

		const colors = await this.colorExtraction.extractColorsFromPoster(
			movie.posterPath,
		);

		if (colors) {
			await this.prisma.movie.update({
				where: { movieId },
				data: { colors },
			});
		}

		return colors ?? existingColors ?? null;
	}

	private async ensureShowHasColors(showId: string): Promise<{
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

		if (colors) {
			await this.prisma.show.update({
				where: { showId },
				data: { colors },
			});
		}

		return colors ?? existingColors ?? null;
	}
}
