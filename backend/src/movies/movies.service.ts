import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Agent } from '@atproto/api';

const COLLECTION = 'app.opnshelf.movie';

@Injectable()
export class MoviesService {
  private readonly logger = new Logger(MoviesService.name);
  private readonly tmdbApiKey: string;
  private readonly tmdbBaseUrl = 'https://api.themoviedb.org/3';

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.tmdbApiKey = this.config.get('TMDB_API_KEY') ?? '';
  }

  async searchMovies(query: string, page: number = 1) {
    const response = await fetch(
      `${this.tmdbBaseUrl}/search/movie?api_key=${this.tmdbApiKey}&query=${encodeURIComponent(query)}&page=${page}`,
    );

    if (!response.ok) {
      throw new Error('Failed to search movies');
    }

    return response.json();
  }

  async getMovieDetails(movieId: string) {
    const response = await fetch(
      `${this.tmdbBaseUrl}/movie/${movieId}?api_key=${this.tmdbApiKey}`,
    );

    if (!response.ok) {
      throw new Error('Movie not found');
    }

    return response.json();
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

  async upsertMovie(movieData: any) {
    return this.prisma.movie.upsert({
      where: { movieId: movieData.id.toString() },
      create: {
        movieId: movieData.id.toString(),
        title: movieData.title,
        posterPath: movieData.poster_path,
        backdropPath: movieData.backdrop_path,
        releaseYear: movieData.release_date
          ? new Date(movieData.release_date).getFullYear()
          : null,
        releaseDate: movieData.release_date
          ? new Date(movieData.release_date)
          : null,
        overview: movieData.overview,
      },
      update: {
        title: movieData.title,
        posterPath: movieData.poster_path,
        backdropPath: movieData.backdrop_path,
        releaseYear: movieData.release_date
          ? new Date(movieData.release_date).getFullYear()
          : null,
        releaseDate: movieData.release_date
          ? new Date(movieData.release_date)
          : null,
        overview: movieData.overview,
      },
    });
  }

  /**
   * Mark a movie as watched by creating an AT Protocol record in the user's PDS.
   * Database indexing happens via the firehose ingester or optimistic update in controller.
   */
  async markWatched(userDid: string, session: any, movieId: string) {
    const rkey = `movie-${movieId}`;
    const now = new Date().toISOString();

    // Build the AT Protocol record
    const record = {
      $type: COLLECTION,
      movieId,
      source: 'tmdb',
      watchedAt: now,
      createdAt: now,
    };

    // Create agent from session and write record to user's PDS
    const agent = new Agent(session);
    const response = await agent.com.atproto.repo.putRecord({
      repo: session.did,
      collection: COLLECTION,
      rkey,
      record,
      validate: false, // PDS may not have app.opnshelf.movie lexicon
    });

    this.logger.log(`Created AT record for movie ${movieId}: ${response.data.uri}`);

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
  async unmarkWatched(userDid: string, session: any, movieId: string) {
    const rkey = `movie-${movieId}`;

    // Create agent from session and delete record from user's PDS
    const agent = new Agent(session);
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
