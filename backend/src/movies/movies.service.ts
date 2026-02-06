import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Agent } from '@atproto/api';
import {
  main as movieSchema,
  $nsid as COLLECTION,
} from '../lexicons/app/opnshelf/movie';
import type { Main as MovieRecord } from '../lexicons/app/opnshelf/movie.defs';
import { ColorExtractionService } from './color-extraction.service';

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

export interface ATSession {
  did: string;
}

@Injectable()
export class MoviesService {
  private readonly logger = new Logger(MoviesService.name);
  private readonly tmdbApiKey: string;
  private readonly tmdbBaseUrl = 'https://api.themoviedb.org/3';

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private colorExtraction: ColorExtractionService,
  ) {
    this.tmdbApiKey = this.config.get('TMDB_API_KEY') ?? '';
  }

  async searchMovies(
    query: string,
    page: number = 1,
  ): Promise<TMDBSearchResponse> {
    const response = await fetch(
      `${this.tmdbBaseUrl}/search/movie?api_key=${this.tmdbApiKey}&query=${encodeURIComponent(query)}&page=${page}`,
    );

    if (!response.ok) {
      throw new Error('Failed to search movies');
    }

    return response.json() as Promise<TMDBSearchResponse>;
  }

  async getMovieDetails(movieId: string): Promise<TMDBMovie> {
    const response = await fetch(
      `${this.tmdbBaseUrl}/movie/${movieId}?api_key=${this.tmdbApiKey}`,
    );

    if (!response.ok) {
      throw new Error('Movie not found');
    }

    return response.json() as Promise<TMDBMovie>;
  }

  async getUserMovies(userDid: string) {
    return this.prisma.trackedMovie.findMany({
      where: { userDid },
      include: { movie: true },
      orderBy: { createdAt: 'desc' },
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
        // Only update colors if they don't exist (lazy backfill)
        colors: undefined,
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
  async markWatched(userDid: string, session: ATSession, movieId: string) {
    const rkey = `movie-${movieId}`;
    const now = new Date().toISOString();

    // Build the AT Protocol record using the generated schema builder
    // This ensures type safety and validation
    const record: MovieRecord = movieSchema.build({
      movieId,
      source: 'tmdb',
      watchedAt: now,
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
   * Unmark a movie as watched by deleting the AT Protocol record from the user's PDS.
   * Database cleanup happens via the firehose ingester or optimistic update in controller.
   */
  async unmarkWatched(userDid: string, session: ATSession, movieId: string) {
    const rkey = `movie-${movieId}`;

    // Create agent from session and delete record from user's PDS
    const agent = new Agent(
      session as unknown as ConstructorParameters<typeof Agent>[0],
    );
    await agent.com.atproto.repo.deleteRecord({
      repo: session.did,
      collection: COLLECTION,
      rkey,
    });

    this.logger.log(`Deleted AT record for movie ${movieId}`);

    return { rkey, movieId };
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

    // Upsert TrackedMovie in database
    return this.prisma.trackedMovie.upsert({
      where: { uri },
      create: {
        uri,
        rkey,
        cid,
        userDid,
        movieId,
        watchedDate: new Date(watchedAt),
        status: 'watched',
      },
      update: {
        cid,
        watchedDate: new Date(watchedAt),
        status: 'watched',
      },
      include: { movie: true },
    });
  }

  /**
   * Remove a tracked movie from the database.
   * Called by controller after successful PDS delete for immediate user feedback.
   */
  async removeTrackedMovie(userDid: string, movieId: string) {
    await this.prisma.trackedMovie.deleteMany({
      where: {
        userDid,
        movieId,
      },
    });
  }
}
