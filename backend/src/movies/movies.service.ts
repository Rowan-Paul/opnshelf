import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MoviesService {
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
}
