import { Injectable } from "@nestjs/common";
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

@Injectable()
export class ShelfService {
	constructor(
		private prisma: PrismaService,
		private colorExtraction: ColorExtractionService,
	) {}

	async getUserShelf(
		userDid: string,
		limit: number = 20,
		cursor?: string,
	): Promise<{
		items: ShelfItem[];
		nextCursor: string | null;
		total: number;
	}> {
		// Fetch all tracked movies with colors
		const trackedMovies = await this.prisma.trackedMovie.findMany({
			where: { userDid },
			include: { movie: true },
			orderBy: { watchedDate: "desc" },
		});

		// Fetch all tracked episodes with colors
		const trackedEpisodes = await this.prisma.trackedEpisode.findMany({
			where: { userDid },
			include: { show: true },
			orderBy: { watchedDate: "desc" },
		});

		// Convert to shelf items with ensured colors
		const movieItems: ShelfItem[] = await Promise.all(
			trackedMovies.map(async (tracked) => {
				const colors = await this.ensureMovieHasColors(tracked.movieId);
				return {
					id: `movie-${tracked.id}`,
					type: "movie" as const,
					watchedDate: tracked.watchedDate,
					createdAt: tracked.createdAt,
					data: {
						id: tracked.id,
						movieId: tracked.movieId,
						title: tracked.movie.title,
						posterPath: tracked.movie.posterPath ?? undefined,
						backdropPath: tracked.movie.backdropPath ?? undefined,
						releaseYear: tracked.movie.releaseYear ?? undefined,
						releaseDate: tracked.movie.releaseDate ?? undefined,
						overview: tracked.movie.overview ?? undefined,
						colors,
						watchedDate: tracked.watchedDate,
						createdAt: tracked.createdAt,
					},
				};
			}),
		);

		const episodeItems: ShelfItem[] = await Promise.all(
			trackedEpisodes.map(async (tracked) => {
				const colors = await this.ensureShowHasColors(tracked.showId);
				return {
					id: `episode-${tracked.id}`,
					type: "episode" as const,
					watchedDate: tracked.watchedDate,
					createdAt: tracked.createdAt,
					data: {
						id: tracked.id,
						showId: tracked.showId,
						showTitle: tracked.show.title,
						seasonNumber: tracked.seasonNumber,
						episodeNumber: tracked.episodeNumber,
						posterPath: tracked.show.posterPath ?? undefined,
						backdropPath: tracked.show.backdropPath ?? undefined,
						firstAirYear: tracked.show.firstAirYear ?? undefined,
						firstAirDate: tracked.show.firstAirDate ?? undefined,
						overview: tracked.show.overview ?? undefined,
						colors,
						watchedDate: tracked.watchedDate,
						createdAt: tracked.createdAt,
					},
				};
			}),
		);

		// Merge and sort by watchedDate (newest first)
		const allItems = [...movieItems, ...episodeItems].sort((a, b) => {
			const dateA = a.watchedDate?.getTime() ?? a.createdAt.getTime();
			const dateB = b.watchedDate?.getTime() ?? b.createdAt.getTime();
			return dateB - dateA;
		});

		const total = allItems.length;

		// Apply cursor-based pagination
		let startIndex = 0;
		if (cursor) {
			const cursorIndex = allItems.findIndex((item) => {
				// cursor is the watchedDate timestamp of the last item from previous page
				const itemDate =
					item.watchedDate?.toISOString() ?? item.createdAt.toISOString();
				return itemDate === cursor;
			});
			if (cursorIndex !== -1) {
				startIndex = cursorIndex + 1;
			}
		}

		const paginatedItems = allItems.slice(startIndex, startIndex + limit);
		const hasMore = startIndex + limit < allItems.length;

		// Generate next cursor from the last item's watchedDate
		const nextCursor =
			hasMore && paginatedItems.length > 0
				? (paginatedItems[
						paginatedItems.length - 1
					].watchedDate?.toISOString() ??
					paginatedItems[paginatedItems.length - 1].createdAt.toISOString())
				: null;

		return {
			items: paginatedItems,
			nextCursor,
			total,
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
