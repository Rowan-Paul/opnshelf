import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

// Mock PrismaService before importing MoviesService
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { MoviesService } from './movies.service';
import { PrismaService } from '../prisma/prisma.service';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('MoviesService', () => {
  let service: MoviesService;

  const mockPrismaService = {
    trackedMovie: {
      findMany: jest.fn(),
    },
    movie: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'TMDB_API_KEY') return 'test-api-key';
      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MoviesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<MoviesService>(MoviesService);
  });

  describe('searchMovies', () => {
    it('should search movies from TMDB API', async () => {
      const mockResponse = {
        results: [{ id: 1, title: 'Test Movie', release_date: '2024-01-01' }],
        total_pages: 1,
        total_results: 1,
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.searchMovies('test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          'search/movie?api_key=test-api-key&query=test&page=1',
        ),
      );
      expect(result).toEqual(mockResponse);
    });

    it('should use custom page number', async () => {
      const mockResponse = { results: [], total_pages: 5, total_results: 100 };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await service.searchMovies('test', 3);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('&page=3'),
      );
    });

    it('should encode query parameter', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      await service.searchMovies('test movie & stuff');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('query=test%20movie%20%26%20stuff'),
      );
    });

    it('should throw error when TMDB API fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(service.searchMovies('test')).rejects.toThrow(
        'Failed to search movies',
      );
    });
  });

  describe('getMovieDetails', () => {
    it('should get movie details from TMDB API', async () => {
      const mockMovie = {
        id: 123,
        title: 'Test Movie',
        overview: 'A test movie',
        release_date: '2024-01-01',
        poster_path: '/poster.jpg',
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockMovie),
      });

      const result = await service.getMovieDetails('123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/movie/123?api_key=test-api-key'),
      );
      expect(result).toEqual(mockMovie);
    });

    it('should throw error when movie not found', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(service.getMovieDetails('999999')).rejects.toThrow(
        'Movie not found',
      );
    });
  });

  describe('getUserMovies', () => {
    it('should return tracked movies for a user', async () => {
      const mockTrackedMovies = [
        {
          id: '1',
          userDid: 'did:plc:abc123',
          movieId: '123',
          status: 'watched',
          movie: { movieId: '123', title: 'Test Movie' },
        },
      ];
      mockPrismaService.trackedMovie.findMany.mockResolvedValue(
        mockTrackedMovies,
      );

      const result = await service.getUserMovies('did:plc:abc123');

      expect(result).toEqual(mockTrackedMovies);
      expect(mockPrismaService.trackedMovie.findMany).toHaveBeenCalledWith({
        where: { userDid: 'did:plc:abc123' },
        include: { movie: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when user has no tracked movies', async () => {
      mockPrismaService.trackedMovie.findMany.mockResolvedValue([]);

      const result = await service.getUserMovies('did:plc:unknown');

      expect(result).toEqual([]);
    });
  });

  describe('getMovieByTMDBId', () => {
    it('should return movie from database', async () => {
      const mockMovie = {
        movieId: '123',
        title: 'Test Movie',
        posterPath: '/poster.jpg',
        releaseYear: 2024,
      };
      mockPrismaService.movie.findUnique.mockResolvedValue(mockMovie);

      const result = await service.getMovieByTMDBId('123');

      expect(result).toEqual(mockMovie);
      expect(mockPrismaService.movie.findUnique).toHaveBeenCalledWith({
        where: { movieId: '123' },
      });
    });

    it('should return null when movie not in database', async () => {
      mockPrismaService.movie.findUnique.mockResolvedValue(null);

      const result = await service.getMovieByTMDBId('999');

      expect(result).toBeNull();
    });
  });

  describe('upsertMovie', () => {
    it('should upsert movie with full data', async () => {
      const movieData = {
        id: 123,
        title: 'Test Movie',
        poster_path: '/poster.jpg',
        backdrop_path: '/backdrop.jpg',
        release_date: '2024-06-15',
        overview: 'A great test movie',
      };
      const mockUpsertedMovie = {
        movieId: '123',
        title: 'Test Movie',
        posterPath: '/poster.jpg',
        backdropPath: '/backdrop.jpg',
        releaseYear: 2024,
        releaseDate: new Date('2024-06-15'),
        overview: 'A great test movie',
      };
      mockPrismaService.movie.upsert.mockResolvedValue(mockUpsertedMovie);

      const result = await service.upsertMovie(movieData);

      expect(result).toEqual(mockUpsertedMovie);
      expect(mockPrismaService.movie.upsert).toHaveBeenCalledWith({
        where: { movieId: '123' },
        create: expect.objectContaining({
          movieId: '123',
          title: 'Test Movie',
          posterPath: '/poster.jpg',
          backdropPath: '/backdrop.jpg',
          releaseYear: 2024,
          overview: 'A great test movie',
        }),
        update: expect.objectContaining({
          title: 'Test Movie',
          posterPath: '/poster.jpg',
          backdropPath: '/backdrop.jpg',
          releaseYear: 2024,
          overview: 'A great test movie',
        }),
      });
    });

    it('should handle movie without release date', async () => {
      const movieData = {
        id: 456,
        title: 'Movie Without Date',
        poster_path: null,
        backdrop_path: null,
        release_date: null,
        overview: 'No release date',
      };
      mockPrismaService.movie.upsert.mockResolvedValue({
        movieId: '456',
        title: 'Movie Without Date',
        posterPath: null,
        backdropPath: null,
        releaseYear: null,
        releaseDate: null,
        overview: 'No release date',
      });

      await service.upsertMovie(movieData);

      expect(mockPrismaService.movie.upsert).toHaveBeenCalledWith({
        where: { movieId: '456' },
        create: expect.objectContaining({
          releaseYear: null,
          releaseDate: null,
        }),
        update: expect.objectContaining({
          releaseYear: null,
          releaseDate: null,
        }),
      });
    });

    it('should handle movie with empty release date string', async () => {
      const movieData = {
        id: 789,
        title: 'Movie With Empty Date',
        poster_path: null,
        backdrop_path: null,
        release_date: '',
        overview: null,
      };
      mockPrismaService.movie.upsert.mockResolvedValue({
        movieId: '789',
        title: 'Movie With Empty Date',
      });

      await service.upsertMovie(movieData);

      expect(mockPrismaService.movie.upsert).toHaveBeenCalledWith({
        where: { movieId: '789' },
        create: expect.objectContaining({
          releaseYear: null,
          releaseDate: null,
        }),
        update: expect.objectContaining({
          releaseYear: null,
          releaseDate: null,
        }),
      });
    });
  });
});
