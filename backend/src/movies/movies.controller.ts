import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { MoviesService } from './movies.service';
import {
  SearchMoviesDto,
  SearchResultsDto,
  TrackedMovieDto,
  MovieDto,
  MarkWatchedDto,
} from './dto/movie.dto';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/types';
import type { ATSession } from './movies.service';

@ApiTags('movies')
@Controller('movies')
export class MoviesController {
  private readonly logger = new Logger(MoviesController.name);

  constructor(private readonly moviesService: MoviesService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search movies from TMDB' })
  @ApiQuery({ name: 'query', required: true, description: 'Search term' })
  @ApiResponse({ status: 200, type: SearchResultsDto })
  async searchMovies(@Query() searchDto: SearchMoviesDto) {
    return this.moviesService.searchMovies(searchDto.query);
  }

  @Get('tmdb/:movieId')
  @ApiOperation({ summary: 'Get movie details from TMDB' })
  @ApiResponse({ status: 200 })
  async getMovieDetails(@Param('movieId') movieId: string) {
    // Get movie details from TMDB
    const movieData = await this.moviesService.getMovieDetails(movieId);

    // Ensure movie is in database with colors
    const movie = await this.moviesService.upsertMovie(movieData);

    // Return combined data with colors
    return {
      ...movieData,
      colors: movie.colors ?? undefined,
    };
  }

  @Get('user/:userDid')
  @ApiOperation({ summary: 'Get tracked movies for a user' })
  @ApiResponse({ status: 200, type: [TrackedMovieDto] })
  async getUserMovies(@Param('userDid') userDid: string) {
    const trackedMovies = await this.moviesService.getUserMovies(userDid);

    // Process each movie to ensure colors are included
    const moviesWithColors = await Promise.all(
      trackedMovies.map(async (tracked) => {
        const colors = await this.moviesService.ensureMovieHasColors(
          tracked.movieId,
        );

        return {
          ...tracked,
          movie: {
            ...tracked.movie,
            colors: colors ?? undefined,
          },
        };
      }),
    );

    return moviesWithColors;
  }

  @Post('watched')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Mark a movie as watched' })
  @ApiResponse({ status: 201, type: TrackedMovieDto })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async markWatched(
    @Body() body: MarkWatchedDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = req.user;

    // Write to user's PDS
    const { uri, cid, rkey, record } = await this.moviesService.markWatched(
      user.did,
      user.session as ATSession,
      body.movieId,
    );

    // Optimistic update: index in local DB so user sees their changes immediately
    // If this fails, the firehose ingester will catch it later
    try {
      const trackedMovie = await this.moviesService.indexTrackedMovie(
        uri,
        cid,
        rkey,
        user.did,
        body.movieId,
        record.watchedAt,
      );
      return trackedMovie;
    } catch (err: unknown) {
      this.logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        'Failed to optimistically update DB; firehose will catch it',
      );
      // Return a minimal response since PDS write succeeded
      return { uri, cid, rkey, movieId: body.movieId, userDid: user.did };
    }
  }

  @Delete('watched/:movieId')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unmark a movie as watched' })
  @ApiResponse({ status: 204, description: 'Movie unmarked as watched' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async unmarkWatched(
    @Param('movieId') movieId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = req.user;

    // Delete from user's PDS
    await this.moviesService.unmarkWatched(
      user.did,
      user.session as ATSession,
      movieId,
    );

    // Optimistic update: remove from local DB so user sees their changes immediately
    // If this fails, the firehose ingester will catch it later
    try {
      await this.moviesService.removeTrackedMovie(user.did, movieId);
    } catch (err: unknown) {
      this.logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        'Failed to optimistically remove from DB; firehose will catch it',
      );
    }
  }

  @Get(':movieId')
  @ApiOperation({ summary: 'Get movie from database' })
  @ApiResponse({ status: 200, type: MovieDto })
  async getMovie(@Param('movieId') movieId: string) {
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
}
