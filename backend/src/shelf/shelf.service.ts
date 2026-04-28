import { Injectable, NotFoundException } from "@nestjs/common";
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
	episodeTitle?: string;
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
	episodeName: string | null;
	firstAirYear: number | null;
	firstAirDate: Date | null;
	overview: string | null;
}

interface RawActivityRow {
	dayKey: string;
	count: number;
}

type ShelfActivitySummary = {
	watchedLast7Days: number;
	watchedLast30Days: number;
	dailyActivity: Array<{
		date: string;
		count: number;
	}>;
};

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
					shelf."episodeName",
					shelf."firstAirYear",
					shelf."firstAirDate",
					shelf."overview"
				FROM (
				SELECT
					'movie:' || tm.id AS "trackedId",
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
						NULL::text AS "episodeName",
						NULL::integer AS "firstAirYear",
						NULL::timestamp AS "firstAirDate",
						m.overview AS "overview"
					FROM "TrackedMovie" tm
					INNER JOIN "Movie" m ON m."movieId" = tm."movieId"
					WHERE tm."userDid" = ${userDid}

					UNION ALL

				SELECT
					'episode:' || te.id AS "trackedId",
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
						ep.name AS "episodeName",
						s."firstAirYear" AS "firstAirYear",
						s."firstAirDate" AS "firstAirDate",
						ep.overview AS "overview"
					FROM "TrackedEpisode" te
					INNER JOIN "Show" s ON s."showId" = te."showId"
					LEFT JOIN "Episode" ep ON ep."showId" = te."showId" 
						AND ep."seasonNumber" = te."seasonNumber" 
						AND ep."episodeNumber" = te."episodeNumber"
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
							episodeTitle: row.episodeName ?? undefined,
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

	async getUserActivitySummary(userDid: string): Promise<ShelfActivitySummary> {
		const user = await this.prisma.user.findUnique({
			where: { did: userDid },
			select: { timezone: true },
		});

		if (!user) {
			throw new NotFoundException("User not found");
		}

		const dailyKeys = buildTrailingDayKeys(user.timezone, 30);
		const startDayKey = dailyKeys[0];
		const endDayKey = dailyKeys[dailyKeys.length - 1];

		const rows = await this.prisma.$queryRaw<RawActivityRow[]>(Prisma.sql`
			SELECT
				TO_CHAR(activity."localDay", 'YYYY-MM-DD') AS "dayKey",
				COUNT(*)::integer AS "count"
			FROM (
				SELECT
					(COALESCE(tm."watchedDate", tm."createdAt") AT TIME ZONE ${user.timezone})::date AS "localDay"
				FROM "TrackedMovie" tm
				WHERE tm."userDid" = ${userDid}

				UNION ALL

				SELECT
					(COALESCE(te."watchedDate", te."createdAt") AT TIME ZONE ${user.timezone})::date AS "localDay"
				FROM "TrackedEpisode" te
				WHERE te."userDid" = ${userDid}
			) activity
			WHERE activity."localDay" BETWEEN CAST(${startDayKey} AS DATE) AND CAST(${endDayKey} AS DATE)
			GROUP BY activity."localDay"
			ORDER BY activity."localDay" ASC
		`);

		const countsByDay = new Map(
			rows.map((row) => [row.dayKey, Number(row.count)]),
		);
		const dailyActivity = dailyKeys.map((date) => ({
			date,
			count: countsByDay.get(date) ?? 0,
		}));
		const watchedLast30Days = dailyActivity.reduce(
			(sum, bucket) => sum + bucket.count,
			0,
		);
		const watchedLast7Days = dailyActivity
			.slice(-7)
			.reduce((sum, bucket) => sum + bucket.count, 0);

		return {
			watchedLast7Days,
			watchedLast30Days,
			dailyActivity,
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

function buildTrailingDayKeys(
	timeZone: string,
	dayCount: number,
	now: Date = new Date(),
) {
	const { year, month, day } = getDatePartsInTimeZone(now, timeZone);
	const today = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));

	return Array.from({ length: dayCount }, (_, index) => {
		const date = new Date(today);
		date.setUTCDate(today.getUTCDate() - (dayCount - 1 - index));
		return formatUtcDateKey(date);
	});
}

function getDatePartsInTimeZone(date: Date, timeZone: string) {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(date);

	return {
		year: Number(parts.find((part) => part.type === "year")?.value),
		month: Number(parts.find((part) => part.type === "month")?.value),
		day: Number(parts.find((part) => part.type === "day")?.value),
	};
}

function formatUtcDateKey(date: Date) {
	return [
		String(date.getUTCFullYear()),
		String(date.getUTCMonth() + 1).padStart(2, "0"),
		String(date.getUTCDate()).padStart(2, "0"),
	].join("-");
}
