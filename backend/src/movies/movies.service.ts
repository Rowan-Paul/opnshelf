import { Agent } from "@atproto/api";
import { TID } from "@atproto/common";
import { Injectable, Logger } from "@nestjs/common";
import {
	$nsid as COLLECTION,
	main as movieSchema,
} from "../lexicons/xyz/opnshelf/movie";
import type { Main as MovieRecord } from "../lexicons/xyz/opnshelf/movie.defs";
import { PrismaService } from "../prisma/prisma.service";
import { ColorExtractionService } from "./color-extraction.service";
import {
	MoviesTmdbService,
	type TMDBCredits,
	type TMDBMovie,
	type TMDBSearchResponse,
	type WatchProvidersResponse,
} from "./movies-tmdb.service";

export interface ATSession {
	did: string;
}

@Injectable()
export class MoviesService {
	private readonly logger = new Logger(MoviesService.name);

	constructor(
		private prisma: PrismaService,
		private colorExtraction: ColorExtractionService,
		private moviesTmdb: MoviesTmdbService,
	) {}

	async searchMovies(
		query: string,
		page: number = 1,
	): Promise<TMDBSearchResponse> {
		return this.moviesTmdb.searchMovies(query, page);
	}

	async discoverMovies(
		sortBy: string = "popularity.desc",
		page: number = 1,
		year?: number,
	): Promise<TMDBSearchResponse> {
		return this.moviesTmdb.discoverMovies(sortBy, page, year);
	}

	async getRecommendations(
		movieId: string,
		page: number = 1,
	): Promise<TMDBSearchResponse> {
		return this.moviesTmdb.getRecommendations(movieId, page);
	}

	async getMovieDetails(movieId: string): Promise<TMDBMovie> {
		return this.moviesTmdb.getMovieDetails(movieId);
	}

	async getMovieCredits(movieId: string): Promise<TMDBCredits | null> {
		return this.moviesTmdb.getMovieCredits(movieId);
	}

	async getWatchProviders(
		movieId: string,
	): Promise<WatchProvidersResponse | null> {
		return this.moviesTmdb.getWatchProviders(movieId);
	}

	async getUserMovies(userDid: string) {
		// Get all tracked movies with their watch counts
		const trackedMovies = await this.prisma.trackedMovie.findMany({
			where: { userDid },
			include: { movie: true },
			orderBy: { watchedDate: "desc" },
		});

		// Group by movieId and take the latest watch for each movie
		const movieMap = new Map<
			string,
			(typeof trackedMovies)[0] & { watchCount: number }
		>();

		for (const tracked of trackedMovies) {
			const existing = movieMap.get(tracked.movieId);
			if (!existing) {
				// Count total watches for this movie
				const watchCount = trackedMovies.filter(
					(tm) => tm.movieId === tracked.movieId,
				).length;
				movieMap.set(tracked.movieId, { ...tracked, watchCount });
			}
		}

		return Array.from(movieMap.values());
	}

	async getUserMoviesPaginated(
		userDid: string,
		limit: number = 20,
		cursor?: string,
	) {
		const take = limit + 1; // Take one extra to determine if there's a next page

		const movies = await this.prisma.trackedMovie.findMany({
			where: { userDid },
			include: { movie: true },
			orderBy: { watchedDate: "desc" },
			take,
			...(cursor && {
				skip: 1,
				cursor: { id: cursor },
			}),
		});

		const hasMore = movies.length > limit;
		const items = hasMore ? movies.slice(0, limit) : movies;
		const nextCursor = hasMore ? items[items.length - 1]?.id : null;

		// Get total count
		const total = await this.prisma.trackedMovie.count({
			where: { userDid },
		});

		return {
			items,
			nextCursor,
			total,
		};
	}

	async getMovieWatchHistory(userDid: string, movieId: string) {
		return this.prisma.trackedMovie.findMany({
			where: { userDid, movieId },
			orderBy: { watchedDate: "desc" },
		});
	}

	async getMovieByTMDBId(movieId: string) {
		return this.prisma.movie.findUnique({
			where: { movieId },
		});
	}

	async upsertMovie(movieData: TMDBMovie) {
		// Extract colors from poster if available
		const colors = await this.colorExtraction.extractColorsFromPoster(
			movieData.poster_path ?? null,
		);

		return this.prisma.movie.upsert({
			where: { movieId: movieData.id.toString() },
			create: {
				movieId: movieData.id.toString(),
				title: movieData.title,
				posterPath: movieData.poster_path ?? null,
				backdropPath: movieData.backdrop_path ?? null,
				releaseYear: movieData.release_date
					? new Date(movieData.release_date).getFullYear()
					: null,
				releaseDate: movieData.release_date
					? new Date(movieData.release_date)
					: null,
				overview: movieData.overview ?? null,
				colors: colors ?? undefined,
			},
			update: {
				title: movieData.title,
				posterPath: movieData.poster_path ?? null,
				backdropPath: movieData.backdrop_path ?? null,
				releaseYear: movieData.release_date
					? new Date(movieData.release_date).getFullYear()
					: null,
				releaseDate: movieData.release_date
					? new Date(movieData.release_date)
					: null,
				overview: movieData.overview ?? null,
				// Keep palette in sync with current extraction algorithm.
				colors: colors ?? undefined,
			},
		});
	}

	async ensureMovieHasColors(movieId: string): Promise<{
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

		// If colors already exist, return them
		const existingColors = movie.colors as {
			primary?: string;
			secondary?: string;
			accent?: string;
			muted?: string;
		} | null;
		if (existingColors?.primary) {
			return existingColors;
		}

		// Extract colors if missing
		const colors = await this.colorExtraction.extractColorsFromPoster(
			movie.posterPath,
		);

		if (!colors) {
			return existingColors ?? null;
		}

		// Update the movie with extracted colors
		await this.prisma.movie.update({
			where: { movieId },
			data: {
				colors: colors,
			},
		});

		return colors;
	}

	/**
	 * Mark a movie as watched by creating an AT Protocol record in the user's PDS.
	 * Database indexing happens via the firehose ingester or optimistic update in controller.
	 */
	/**
	 * Build a Watch record for the PDS.
	 *
	 * When `deterministicRkey` is provided (history import), the same logical
	 * watch always maps to the same rkey, so re-issuing the PDS write is an
	 * idempotent overwrite rather than a duplicate. Interactive single watches
	 * omit it and get a fresh chronological TID.
	 */
	buildMovieWatchRecord(
		movieId: string,
		customWatchedAt?: string,
		deterministicRkey?: string,
	) {
		const rkey = deterministicRkey ?? TID.nextStr();
		const now = new Date().toISOString();
		const watchedAt = customWatchedAt
			? new Date(customWatchedAt).toISOString()
			: now;
		const record: MovieRecord = movieSchema.build({
			movieId,
			source: "tmdb",
			watchedAt,
			createdAt: now,
		});
		return { rkey, record, collection: COLLECTION };
	}

	async markWatched(
		_userDid: string,
		session: ATSession,
		movieId: string,
		customWatchedAt?: string,
	) {
		// Generate unique TID for rkey (chronological sortable, collision-resistant)
		const rkey = TID.nextStr();
		const watchedAt = customWatchedAt
			? new Date(customWatchedAt).toISOString()
			: new Date().toISOString();
		const now = new Date().toISOString();

		// Build the AT Protocol record using the generated schema builder
		const record: MovieRecord = movieSchema.build({
			movieId,
			source: "tmdb",
			watchedAt,
			createdAt: now,
		});

		// Create agent from session and write record to user's PDS
		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);
		const response = await agent.com.atproto.repo.putRecord({
			repo: session.did,
			collection: COLLECTION,
			rkey,
			record,
			validate: false, // PDS may not have xyz.opnshelf.movie lexicon
		});

		// Return the record info for optimistic updates
		return {
			uri: response.data.uri,
			cid: response.data.cid,
			rkey,
			record,
		};
	}

	/**
	 * Unmark a movie as watched by deleting AT Protocol record(s) from the user's PDS.
	 * Database cleanup happens via the firehose ingester or optimistic update in controller.
	 * @param mode - 'latest' removes most recent watch, 'all' removes all watches
	 */
	async unmarkWatched(
		userDid: string,
		session: ATSession,
		movieId: string,
		mode: "latest" | "all" = "latest",
	) {
		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		if (mode === "all") {
			// Get all tracked movies for this user and movie
			const trackedMovies = await this.prisma.trackedMovie.findMany({
				where: { userDid, movieId },
				orderBy: { watchedDate: "desc" },
			});

			// Delete all records from PDS
			for (const tracked of trackedMovies) {
				try {
					await agent.com.atproto.repo.deleteRecord({
						repo: session.did,
						collection: COLLECTION,
						rkey: tracked.rkey,
					});
					this.logger.log(
						`Deleted AT record for movie ${movieId} with rkey ${tracked.rkey}`,
					);
				} catch {}
			}

			return { movieId, mode, deletedCount: trackedMovies.length };
		} else {
			// Get the most recent watch
			const latestWatch = await this.prisma.trackedMovie.findFirst({
				where: { userDid, movieId },
				orderBy: { watchedDate: "desc" },
			});

			if (!latestWatch) {
				return { movieId, mode };
			}

			// Delete from PDS
			await agent.com.atproto.repo.deleteRecord({
				repo: session.did,
				collection: COLLECTION,
				rkey: latestWatch.rkey,
			});

			this.logger.log(
				`Deleted AT record for movie ${movieId} with rkey ${latestWatch.rkey}`,
			);
			return { movieId, mode, rkey: latestWatch.rkey };
		}
	}

	/**
	 * Optimistically index a tracked movie in the database.
	 * Called by controller after successful PDS write for immediate user feedback.
	 */
	async indexTrackedMovie(
		uri: string,
		cid: string,
		rkey: string,
		userDid: string,
		movieId: string,
		watchedAt: string,
	) {
		// Fetch movie details from TMDB and upsert in database
		const movieData = await this.getMovieDetails(movieId);

		if (!movieData || !movieData.id) {
			throw new Error(
				`Failed to fetch movie details for movieId ${movieId}: invalid response from TMDB`,
			);
		}

		const normalizedMovieId = movieData.id.toString();

		await this.upsertMovie(movieData);

		// Upsert keyed on the repository-qualified rkey so a re-run of an import (e.g. after a
		// crash between the PDS write and this DB write) overwrites rather than
		// duplicates. Stays consistent with the firehose ingester, the other
		// writer of this row, which uses the same owner-qualified identity.
		return this.prisma.trackedMovie.upsert({
			where: { userDid_rkey: { userDid, rkey } },
			create: {
				uri,
				rkey,
				cid,
				userDid,
				movieId: normalizedMovieId,
				watchedDate: new Date(watchedAt),
				status: "watched",
			},
			update: {
				uri,
				cid,
				watchedDate: new Date(watchedAt),
				status: "watched",
			},
			include: { movie: true },
		});
	}

	/**
	 * Remove all tracked movies for a user and movie.
	 * Called by controller after successful PDS delete for immediate user feedback.
	 */
	async removeAllTrackedMovies(userDid: string, movieId: string) {
		await this.prisma.trackedMovie.deleteMany({
			where: {
				userDid,
				movieId,
			},
		});
	}

	/**
	 * Remove the latest tracked movie for a user and movie.
	 * Called by controller after successful PDS delete for immediate user feedback.
	 */
	async removeLatestTrackedMovie(userDid: string, movieId: string) {
		const latest = await this.prisma.trackedMovie.findFirst({
			where: {
				userDid,
				movieId,
			},
			orderBy: {
				watchedDate: "desc",
			},
		});

		if (latest) {
			await this.prisma.trackedMovie.delete({
				where: {
					id: latest.id,
				},
			});
		}
	}

	/**
	 * Remove a specific tracked movie by ID.
	 * Called by controller to delete individual watch history entries.
	 */
	async removeTrackedMovieById(
		userDid: string,
		session: ATSession,
		trackedMovieId: string,
	) {
		const trackedMovie = await this.prisma.trackedMovie.findFirst({
			where: {
				id: trackedMovieId,
				userDid,
			},
		});

		if (!trackedMovie) {
			throw new Error("Tracked movie not found");
		}

		// Delete the AT Protocol record from user's PDS
		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);
		await agent.com.atproto.repo.deleteRecord({
			repo: userDid,
			collection: COLLECTION,
			rkey: trackedMovie.rkey,
		});

		// Delete from local database
		await this.prisma.trackedMovie.delete({
			where: {
				id: trackedMovieId,
			},
		});

		this.logger.log(
			`Deleted tracked movie ${trackedMovieId} (rkey: ${trackedMovie.rkey})`,
		);
	}
}
