import { Test, TestingModule } from '@nestjs/testing';

// Mock PrismaService before importing
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { MoviesController } from './movies.controller';
import { MoviesService } from './movies.service';

describe('MoviesController', () => {
  let controller: MoviesController;
  let moviesService: jest.Mocked<MoviesService>;

  const mockMoviesService = {
    searchMovies: jest.fn(),
    getMovieDetails: jest.fn(),
    getUserMovies: jest.fn(),
    getMovieByTMDBId: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MoviesController],
      providers: [{ provide: MoviesService, useValue: mockMoviesService }],
    }).compile();

    controller = module.get<MoviesController>(MoviesController);
    moviesService = module.get(MoviesService);
  });

  describe('searchMovies', () => {
    it('should search movies with query', async () => {
      const mockResults = {
        results: [
          { id: 1, title: 'Test Movie', release_date: '2024-01-01' },
          { id: 2, title: 'Another Movie', release_date: '2024-02-01' },
        ],
        total_pages: 1,
        total_results: 2,
      };
      mockMoviesService.searchMovies.mockResolvedValue(mockResults);

      const result = await controller.searchMovies({ query: 'test' });

      expect(result).toEqual(mockResults);
      expect(mockMoviesService.searchMovies).toHaveBeenCalledWith('test');
    });

    it('should handle empty search results', async () => {
      const mockResults = { results: [], total_pages: 0, total_results: 0 };
      mockMoviesService.searchMovies.mockResolvedValue(mockResults);

      const result = await controller.searchMovies({ query: 'nonexistent' });

      expect(result).toEqual(mockResults);
    });
  });

  describe('getMovieDetails', () => {
    it('should return movie details from TMDB', async () => {
      const mockMovie = {
        id: 123,
        title: 'Test Movie',
        overview: 'A test movie description',
        release_date: '2024-01-01',
        poster_path: '/poster.jpg',
        backdrop_path: '/backdrop.jpg',
        runtime: 120,
        vote_average: 7.5,
      };
      mockMoviesService.getMovieDetails.mockResolvedValue(mockMovie);

      const result = await controller.getMovieDetails('123');

      expect(result).toEqual(mockMovie);
      expect(mockMoviesService.getMovieDetails).toHaveBeenCalledWith('123');
    });

    it('should handle movie not found', async () => {
      mockMoviesService.getMovieDetails.mockRejectedValue(
        new Error('Movie not found'),
      );

      await expect(controller.getMovieDetails('999999')).rejects.toThrow(
        'Movie not found',
      );
    });
  });

  describe('getUserMovies', () => {
    it('should return tracked movies for a user', async () => {
      const mockTrackedMovies = [
        {
          id: '1',
          rkey: 'abc123',
          uri: 'at://did:plc:abc123/app.bsky.movie/abc123',
          cid: 'cid123',
          userDid: 'did:plc:abc123',
          movieId: '123',
          status: 'watched',
          watchedDate: new Date('2024-01-15'),
          createdAt: new Date(),
          updatedAt: new Date(),
          movie: {
            movieId: '123',
            title: 'Test Movie',
            posterPath: '/poster.jpg',
            releaseYear: 2024,
          },
        },
      ];
      mockMoviesService.getUserMovies.mockResolvedValue(mockTrackedMovies);

      const result = await controller.getUserMovies('did:plc:abc123');

      expect(result).toEqual(mockTrackedMovies);
      expect(mockMoviesService.getUserMovies).toHaveBeenCalledWith(
        'did:plc:abc123',
      );
    });

    it('should return empty array for user with no tracked movies', async () => {
      mockMoviesService.getUserMovies.mockResolvedValue([]);

      const result = await controller.getUserMovies('did:plc:newuser');

      expect(result).toEqual([]);
    });
  });

  describe('getMovie', () => {
    it('should return movie from database', async () => {
      const mockMovie = {
        movieId: '123',
        title: 'Test Movie',
        posterPath: '/poster.jpg',
        backdropPath: '/backdrop.jpg',
        releaseYear: 2024,
        releaseDate: new Date('2024-01-01'),
        overview: 'A test movie',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockMoviesService.getMovieByTMDBId.mockResolvedValue(mockMovie);

      const result = await controller.getMovie('123');

      expect(result).toEqual(mockMovie);
      expect(mockMoviesService.getMovieByTMDBId).toHaveBeenCalledWith('123');
    });

    it('should return null when movie not in database', async () => {
      mockMoviesService.getMovieByTMDBId.mockResolvedValue(null);

      const result = await controller.getMovie('999');

      expect(result).toBeNull();
    });
  });
});
