import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import type { AuthenticatedRequest } from '../auth/types';

// Mock PrismaService before importing
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

// Mock @atproto modules to prevent import errors
jest.mock('@atproto/oauth-client-node', () => ({}));
jest.mock('@atproto/api', () => ({}));

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
    markWatched: jest.fn(),
    indexTrackedMovie: jest.fn(),
    unmarkWatched: jest.fn(),
    removeTrackedMovie: jest.fn(),
  };

  const mockAuthService = {
    getUser: jest.fn(),
    revokeBySessionId: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MoviesController],
      providers: [
        { provide: MoviesService, useValue: mockMoviesService },
        { provide: AuthService, useValue: mockAuthService },
        AuthGuard,
      ],
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

  const createMockRequest = (user: {
    did: string;
    session: { did: string };
  }): AuthenticatedRequest => {
    return { user } as unknown as AuthenticatedRequest;
  };

  describe('markWatched', () => {
    it('should mark movie as watched and return tracked movie', async () => {
      const mockUser = {
        did: 'did:plc:abc123',
        session: { did: 'did:plc:abc123' },
      };
      const mockMarkWatchedResult = {
        uri: 'at://did:plc:abc123/app.opnshelf.movie/movie-456',
        cid: 'cid456',
        rkey: 'movie-456',
        record: {
          watchedAt: '2024-01-15T10:00:00Z',
        },
      };
      const mockTrackedMovie = {
        id: 'tracked-1',
        uri: 'at://did:plc:abc123/app.opnshelf.movie/movie-456',
        rkey: 'movie-456',
        cid: 'cid456',
        userDid: 'did:plc:abc123',
        movieId: '456',
        status: 'watched',
        watchedDate: new Date('2024-01-15'),
        movie: {
          movieId: '456',
          title: 'Test Movie',
        },
      };

      mockMoviesService.markWatched.mockResolvedValue(mockMarkWatchedResult);
      mockMoviesService.indexTrackedMovie.mockResolvedValue(mockTrackedMovie);

      const req = createMockRequest(mockUser);
      const result = await controller.markWatched({ movieId: '456' }, req);

      expect(mockMoviesService.markWatched).toHaveBeenCalledWith(
        'did:plc:abc123',
        mockUser.session,
        '456',
      );
      expect(mockMoviesService.indexTrackedMovie).toHaveBeenCalledWith(
        'at://did:plc:abc123/app.opnshelf.movie/movie-456',
        'cid456',
        'movie-456',
        'did:plc:abc123',
        '456',
        '2024-01-15T10:00:00Z',
      );
      expect(result).toEqual(mockTrackedMovie);
    });

    it('should return minimal response when optimistic update fails', async () => {
      const mockUser = {
        did: 'did:plc:abc123',
        session: { did: 'did:plc:abc123' },
      };
      const mockMarkWatchedResult = {
        uri: 'at://did:plc:abc123/app.opnshelf.movie/movie-789',
        cid: 'cid789',
        rkey: 'movie-789',
        record: {
          watchedAt: '2024-01-20T15:30:00Z',
        },
      };

      mockMoviesService.markWatched.mockResolvedValue(mockMarkWatchedResult);
      mockMoviesService.indexTrackedMovie.mockRejectedValue(
        new Error('DB error'),
      );

      const req = createMockRequest(mockUser);
      const result = await controller.markWatched({ movieId: '789' }, req);

      expect(result).toEqual({
        uri: 'at://did:plc:abc123/app.opnshelf.movie/movie-789',
        cid: 'cid789',
        rkey: 'movie-789',
        movieId: '789',
        userDid: 'did:plc:abc123',
      });
    });
  });

  describe('unmarkWatched', () => {
    it('should unmark movie as watched', async () => {
      const mockUser = {
        did: 'did:plc:abc123',
        session: { did: 'did:plc:abc123' },
      };

      mockMoviesService.unmarkWatched.mockResolvedValue({
        rkey: 'movie-123',
        movieId: '123',
      });
      mockMoviesService.removeTrackedMovie.mockResolvedValue({
        count: 1,
      } as unknown as ReturnType<typeof mockMoviesService.removeTrackedMovie>);

      const req = createMockRequest(mockUser);
      await controller.unmarkWatched('123', req);

      expect(mockMoviesService.unmarkWatched).toHaveBeenCalledWith(
        'did:plc:abc123',
        mockUser.session,
        '123',
      );
      expect(mockMoviesService.removeTrackedMovie).toHaveBeenCalledWith(
        'did:plc:abc123',
        '123',
      );
    });

    it('should handle failure when removing from local DB', async () => {
      const mockUser = {
        did: 'did:plc:abc123',
        session: { did: 'did:plc:abc123' },
      };

      mockMoviesService.unmarkWatched.mockResolvedValue({
        rkey: 'movie-456',
        movieId: '456',
      });
      mockMoviesService.removeTrackedMovie.mockRejectedValue(
        new Error('DB error'),
      );

      const req = createMockRequest(mockUser);
      // Should not throw
      await expect(controller.unmarkWatched('456', req)).resolves.not.toThrow();
    });
  });
});
