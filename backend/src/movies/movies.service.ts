import { Agent } from "@atproto/api";
import { TID } from "@atproto/common";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
	$nsid as COLLECTION,
	main as movieSchema,
} from "../lexicons/app/opnshelf/movie";
import type { Main as MovieRecord } from "../lexicons/app/opnshelf/movie.defs";
import { PrismaService } from "../prisma/prisma.service";
import { ColorExtractionService } from "./color-extraction.service";

export interface TMDBMovie {
	id: number;
	title: string;
	poster_path?: string;
	backdrop_path?: string;
	release_date?: string;
	overview?: string;
}

export interface TMDBSearchResponse {
	page: number;
	results: TMDBMovie[];
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

export interface ATSession {
	did: string;
}

@Injectable()
export class MoviesService {
	private readonly logger = new Logger(MoviesService.name);
	private readonly tmdbApiKey: string;
	private readonly tmdbBaseUrl = "https://api.themoviedb.org/3";

	constructor(
		private prisma: PrismaService,
		private config: ConfigService,
		private colorExtraction: ColorExtractionService,
	) {
		this.tmdbApiKey = this.config.get("TMDB_API_KEY") ?? "";
	}

	async searchMovies(
		query: string,
		page: number = 1,
	): Promise<TMDBSearchResponse> {
		const response = await fetch(
			`${this.tmdbBaseUrl}/search/movie?api_key=${this.tmdbApiKey}&query=${encodeURIComponent(query)}&page=${page}`,
		);

		if (!response.ok) {
			throw new Error("Failed to search movies");
		}

		return response.json() as Promise<TMDBSearchResponse>;
	}

	async discoverMovies(
		sortBy: string = "popularity.desc",
		page: number = 1,
		year?: number,
	): Promise<TMDBSearchResponse> {
		let url = `${this.tmdbBaseUrl}/discover/movie?api_key=${this.tmdbApiKey}&sort_by=${sortBy}&page=${page}`;

		if (year) {
			url += `&primary_release_year=${year}`;
		}

		const response = await fetch(url);

		if (!response.ok) {
			throw new Error("Failed to discover movies");
		}

		return response.json() as Promise<TMDBSearchResponse>;
	}

	async getMovieDetails(movieId: string): Promise<TMDBMovie> {
		const response = await fetch(
			`${this.tmdbBaseUrl}/movie/${movieId}?api_key=${this.tmdbApiKey}`,
		);

		if (!response.ok) {
			throw new Error("Movie not found");
		}

		return response.json() as Promise<TMDBMovie>;
	}

	async getMovieCredits(movieId: string): Promise<TMDBCredits | null> {
		const response = await fetch(
			`${this.tmdbBaseUrl}/movie/${movieId}/credits?api_key=${this.tmdbApiKey}`,
		);

		if (!response.ok) {
			this.logger.warn(`Failed to fetch credits for movie ${movieId}`);
			return null;
		}

		const data = (await response.json()) as TMDBCredits;

		// Sort cast by order and limit to top 15
		const sortedCast = (data.cast || [])
			.sort((a, b) => (a.order || 0) - (b.order || 0))
			.slice(0, 15);

		// Filter key crew roles
		const keyJobs = [
			"Director",
			"Producer",
			"Executive Producer",
			"Screenplay",
			"Writer",
			"Director of Photography",
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
			validate: false, // PDS may not have app.opnshelf.movie lexicon
		});

		this.logger.log(
			`Created AT record for movie ${movieId}: ${response.data.uri}`,
		);

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
				} catch {
					this.logger.warn(
						`Failed to delete record ${tracked.rkey}, may not exist in PDS`,
					);
				}
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
		await this.upsertMovie(movieData);

		// Create new TrackedMovie record (since rkey is unique, each watch is a new record)
		return this.prisma.trackedMovie.create({
			data: {
				uri,
				rkey,
				cid,
				userDid,
				movieId,
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
