import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Logger,
	Param,
	Post,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
import {
	ApiBody,
	ApiOperation,
	ApiParam,
	ApiQuery,
	ApiResponse,
	ApiTags,
} from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import {
	type DiscoverMoviesDto,
	MovieDto,
	PaginatedMoviesQueryDto,
	PaginatedMoviesResponseDto,
	SearchResultsDto,
	TMDBMovieDetailDto,
	TrackedMovieDto,
	WatchHistoryItemDto,
	WatchProvidersResponseDto,
} from "./dto/movie.dto";
import type { ATSession } from "./movies.service";
import { MoviesService } from "./movies.service";

@ApiTags("movies")
@Controller("movies")
export class MoviesController {
	private readonly logger = new Logger(MoviesController.name);

	constructor(private readonly moviesService: MoviesService) {}

	@Get("search")
	@ApiOperation({ summary: "Search movies from TMDB" })
	@ApiQuery({ name: "query", required: true, description: "Search term" })
	@ApiResponse({ status: 200, type: SearchResultsDto })
	async searchMovies(@Query("query") query: string) {
		return this.moviesService.searchMovies(query);
	}

	@Get("discover")
	@ApiOperation({ summary: "Discover popular movies from TMDB" })
	@ApiResponse({ status: 200, type: SearchResultsDto })
	async discoverMovies(@Query() discoverDto: DiscoverMoviesDto) {
		return this.moviesService.discoverMovies(
			discoverDto.sortBy,
			discoverDto.page ?? 1,
			discoverDto.year,
		);
	}

	@Get("tmdb/:movieId")
	@ApiOperation({ summary: "Get movie details from TMDB" })
	@ApiResponse({ status: 200, type: TMDBMovieDetailDto })
	async getMovieDetails(@Param("movieId") movieId: string) {
		// Get movie details from TMDB
		const movieData = await this.moviesService.getMovieDetails(movieId);

		// Ensure movie is in database with colors
		const movie = await this.moviesService.upsertMovie(movieData);

		// Get movie credits
		const credits = await this.moviesService.getMovieCredits(movieId);

		// Return combined data with colors and credits
		return {
			...movieData,
			colors: movie.colors ?? undefined,
			credits,
		};
	}

	@Get("tmdb/:movieId/watch-providers")
	@ApiOperation({
		summary: "Get watch providers for a movie from TMDB/JustWatch",
	})
	@ApiResponse({ status: 200, type: WatchProvidersResponseDto })
	@ApiQuery({
		name: "country",
		required: false,
		description: "ISO 3166-1 country code (e.g. US, GB)",
	})
	async getWatchProviders(
		@Param("movieId") movieId: string,
		@Query("country") country: string = "US",
	) {
		const data = await this.moviesService.getWatchProviders(movieId);
		if (!data) return { providers: null };
		const countryData = data.results[country] ?? null;
		return {
			providers: countryData,
			availableCountries: Object.keys(data.results),
		};
	}

	@Get("tmdb/:movieId/recommendations")
	@ApiOperation({ summary: "Get TMDB recommendations (similar movies)" })
	@ApiResponse({ status: 200, type: SearchResultsDto })
	async getRecommendations(@Param("movieId") movieId: string) {
		return this.moviesService.getRecommendations(movieId);
	}

	@Get("user/:userDid")
	@ApiOperation({ summary: "Get tracked movies for a user" })
	@ApiResponse({ status: 200, type: [TrackedMovieDto] })
	async getUserMovies(@Param("userDid") userDid: string) {
		const trackedMovies = await this.moviesService.getUserMovies(userDid);
		// Match the shows endpoint: stored null colors serialize as undefined.
		return trackedMovies.map((tracked) => ({
			...tracked,
			movie: {
				...tracked.movie,
				colors: tracked.movie.colors ?? undefined,
			},
		}));
	}

	@Get("user/:userDid/paginated")
	@ApiOperation({ summary: "Get paginated tracked movies for a user" })
	@ApiResponse({ status: 200, type: PaginatedMoviesResponseDto })
	async getUserMoviesPaginated(
		@Param("userDid") userDid: string,
		@Query() query: PaginatedMoviesQueryDto,
	) {
		const limit = query.limit ?? 20;
		const result = await this.moviesService.getUserMoviesPaginated(
			userDid,
			limit,
			query.cursor,
		);

		// Ensure colors for all movies
		const itemsWithColors = await Promise.all(
			result.items.map(async (item) => {
				const colors = await this.moviesService.ensureMovieHasColors(
					item.movieId,
				);
				return {
					...item,
					watchedDate: item.watchedDate?.toISOString(),
					createdAt: item.createdAt.toISOString(),
					updatedAt: item.updatedAt.toISOString(),
					movie: {
						...item.movie,
						colors: colors ?? undefined,
					},
				};
			}),
		);

		return {
			items: itemsWithColors,
			nextCursor: result.nextCursor,
			total: result.total,
		};
	}

	@Post("watched")
	@UseGuards(AuthGuard)
	@ApiOperation({ summary: "Mark a movie as watched" })
	@ApiBody({
		schema: {
			type: "object",
			required: ["movieId"],
			properties: {
				movieId: { type: "string", description: "TMDB movie ID" },
				watchedAt: {
					type: "string",
					format: "date-time",
					description: "Custom watch datetime (ISO 8601)",
				},
			},
		},
	})
	@ApiResponse({ status: 201, type: TrackedMovieDto })
	@ApiResponse({ status: 401, description: "Not authenticated" })
	async markWatched(
		@Body("movieId") movieId: string,
		@Body("watchedAt") watchedAt: string | undefined,
		@Req() req: AuthenticatedRequest,
	) {
		const user = req.user;

		// Write to user's PDS
		const { uri, cid, rkey, record } = await this.moviesService.markWatched(
			user.did,
			user.session as ATSession,
			movieId,
			watchedAt,
		);

		// Optimistic update: index in local DB so user sees their changes immediately
		// If this fails, the firehose ingester will catch it later
		try {
			const trackedMovie = await this.moviesService.indexTrackedMovie(
				uri,
				cid,
				rkey,
				user.did,
				movieId,
				record.watchedAt,
			);
			return trackedMovie;
		} catch (err: unknown) {
			this.logger.warn(
				{ err: err instanceof Error ? err.message : String(err) },
				"Failed to optimistically update DB; firehose will catch it",
			);
			// Return a minimal response since PDS write succeeded
			return { uri, cid, rkey, movieId, userDid: user.did };
		}
	}

	@Delete("watched/:movieId")
	@UseGuards(AuthGuard)
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ summary: "Unmark a movie as watched" })
	@ApiQuery({
		name: "mode",
		required: false,
		enum: ["latest", "all"],
		description:
			"Remove mode: latest (default) removes most recent watch, all removes all watches",
	})
	@ApiResponse({ status: 204, description: "Movie unmarked as watched" })
	@ApiResponse({ status: 401, description: "Not authenticated" })
	async unmarkWatched(
		@Param("movieId") movieId: string,
		@Query("mode") mode: "latest" | "all" = "latest",
		@Req() req: AuthenticatedRequest,
	) {
		const user = req.user;

		// Delete from user's PDS
		await this.moviesService.unmarkWatched(
			user.did,
			user.session as ATSession,
			movieId,
			mode,
		);

		// Optimistic update: remove from local DB so user sees their changes immediately
		// If this fails, the firehose ingester will catch it later
		try {
			if (mode === "all") {
				await this.moviesService.removeAllTrackedMovies(user.did, movieId);
			} else {
				await this.moviesService.removeLatestTrackedMovie(user.did, movieId);
			}
		} catch (err: unknown) {
			this.logger.warn(
				{ err: err instanceof Error ? err.message : String(err) },
				"Failed to optimistically remove from DB; firehose will catch it",
			);
		}
	}

	@Get(":movieId")
	@ApiOperation({ summary: "Get movie from database" })
	@ApiResponse({ status: 200, type: MovieDto })
	async getMovie(@Param("movieId") movieId: string) {
		// Get movie from database
		const movie = await this.moviesService.getMovieByTMDBId(movieId);

		if (!movie) {
			return null;
		}

		// Ensure colors are extracted if missing (lazy backfill)
		const colors = await this.moviesService.ensureMovieHasColors(movieId);

		return {
			...movie,
			colors: colors ?? undefined,
		};
	}

	@Get("user/:userDid/movie/:movieId/history")
	@UseGuards(AuthGuard)
	@ApiOperation({ summary: "Get watch history for a specific movie" })
	@ApiParam({ name: "userDid", description: "User DID" })
	@ApiParam({ name: "movieId", description: "TMDB movie ID" })
	@ApiResponse({
		status: 200,
		description: "Watch history retrieved successfully",
		type: [WatchHistoryItemDto],
	})
	@ApiResponse({ status: 401, description: "Not authenticated" })
	async getMovieWatchHistory(
		@Param("userDid") userDid: string,
		@Param("movieId") movieId: string,
		@Req() req: AuthenticatedRequest,
	) {
		// Ensure user can only access their own history
		if (req.user.did !== userDid) {
			throw new Error("Unauthorized");
		}

		const history = await this.moviesService.getMovieWatchHistory(
			userDid,
			movieId,
		);
		return history;
	}

	@Delete("history/:trackedMovieId")
	@UseGuards(AuthGuard)
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ summary: "Delete a specific watch history entry" })
	@ApiParam({ name: "trackedMovieId", description: "Tracked movie entry ID" })
	@ApiResponse({ status: 204, description: "Watch history entry deleted" })
	@ApiResponse({ status: 401, description: "Not authenticated" })
	@ApiResponse({ status: 404, description: "Tracked movie entry not found" })
	async deleteWatchHistoryEntry(
		@Param("trackedMovieId") trackedMovieId: string,
		@Req() req: AuthenticatedRequest,
	) {
		await this.moviesService.removeTrackedMovieById(
			req.user.did,
			req.user.session as ATSession,
			trackedMovieId,
		);
	}
}
