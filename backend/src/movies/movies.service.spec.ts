import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";

// Mock PrismaService before importing MoviesService
jest.mock("../prisma/prisma.service", () => ({
	PrismaService: jest.fn(),
}));

// Mock @atproto/api Agent
const mockPutRecord = jest.fn();
const mockDeleteRecord = jest.fn();
jest.mock("@atproto/api", () => ({
	Agent: jest.fn().mockImplementation(() => ({
		com: {
			atproto: {
				repo: {
					putRecord: mockPutRecord,
					deleteRecord: mockDeleteRecord,
				},
			},
		},
	})),
}));

// Mock lexicon module
const mockValidateMovieRecord = jest.fn();
jest.mock("../lexicons/app/opnshelf/movie", () => ({
	main: {
		build: jest.fn((data: Record<string, unknown>) => ({
			$type: "app.opnshelf.movie",
			...data,
		})),
	},
	$nsid: "app.opnshelf.movie",
	$validate: mockValidateMovieRecord,
}));

import { PrismaService } from "../prisma/prisma.service";
import { ColorExtractionService } from "./color-extraction.service";
import { MoviesService } from "./movies.service";

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("MoviesService", () => {
	let service: MoviesService;

	const mockPrismaService = {
		trackedMovie: {
			findMany: jest.fn(),
			findFirst: jest.fn(),
			upsert: jest.fn(),
			create: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn(),
		},
		movie: {
			findUnique: jest.fn(),
			upsert: jest.fn(),
			update: jest.fn(),
		},
	};

	const mockConfigService = {
		get: jest.fn((key: string) => {
			if (key === "TMDB_API_KEY") return "test-api-key";
			return undefined;
		}),
	};

	const mockColorExtractionService = {
		extractColorsFromPoster: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();
		mockPutRecord.mockReset();
		mockDeleteRecord.mockReset();
		mockValidateMovieRecord.mockReturnValue({ success: true });

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MoviesService,
				{ provide: PrismaService, useValue: mockPrismaService },
				{ provide: ConfigService, useValue: mockConfigService },
				{
					provide: ColorExtractionService,
					useValue: mockColorExtractionService,
				},
			],
		}).compile();

		service = module.get<MoviesService>(MoviesService);
	});

	describe("searchMovies", () => {
		it("should search movies from TMDB API", async () => {
			const mockResponse = {
				results: [{ id: 1, title: "Test Movie", release_date: "2024-01-01" }],
				total_pages: 1,
				total_results: 1,
			};
			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			});

			const result = await service.searchMovies("test");

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining(
					"search/movie?api_key=test-api-key&query=test&page=1",
				),
			);
			expect(result).toEqual(mockResponse);
		});

		it("should use custom page number", async () => {
			const mockResponse = { results: [], total_pages: 5, total_results: 100 };
			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			});

			await service.searchMovies("test", 3);

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("&page=3"),
			);
		});

		it("should encode query parameter", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ results: [] }),
			});

			await service.searchMovies("test movie & stuff");

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("query=test%20movie%20%26%20stuff"),
			);
		});

		it("should throw error when TMDB API fails", async () => {
			mockFetch.mockResolvedValue({
				ok: false,
				status: 500,
			});

			await expect(service.searchMovies("test")).rejects.toThrow(
				"Failed to search movies",
			);
		});
	});

	describe("getMovieDetails", () => {
		it("should get movie details from TMDB API", async () => {
			const mockMovie = {
				id: 123,
				title: "Test Movie",
				overview: "A test movie",
				release_date: "2024-01-01",
				poster_path: "/poster.jpg",
			};
			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockMovie),
			});

			const result = await service.getMovieDetails("123");

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("/movie/123?api_key=test-api-key"),
			);
			expect(result).toEqual(mockMovie);
		});

		it("should throw error when movie not found", async () => {
			mockFetch.mockResolvedValue({
				ok: false,
				status: 404,
			});

			await expect(service.getMovieDetails("999999")).rejects.toThrow(
				"Movie not found",
			);
		});
	});

	describe("getUserMovies", () => {
		it("should return tracked movies for a user with watch counts", async () => {
			const mockTrackedMovies = [
				{
					id: "1",
					userDid: "did:plc:abc123",
					movieId: "123",
					status: "watched",
					movie: { movieId: "123", title: "Test Movie" },
				},
			];
			mockPrismaService.trackedMovie.findMany.mockResolvedValue(
				mockTrackedMovies,
			);

			const result = await service.getUserMovies("did:plc:abc123");

			expect(result).toHaveLength(1);
			expect(result[0].movieId).toBe("123");
			expect((result[0] as { watchCount: number }).watchCount).toBe(1);
			expect(mockPrismaService.trackedMovie.findMany).toHaveBeenCalledWith({
				where: { userDid: "did:plc:abc123" },
				include: { movie: true },
				orderBy: { watchedDate: "desc" },
			});
		});

		it("should return empty array when user has no tracked movies", async () => {
			mockPrismaService.trackedMovie.findMany.mockResolvedValue([]);

			const result = await service.getUserMovies("did:plc:unknown");

			expect(result).toEqual([]);
		});
	});

	describe("getMovieByTMDBId", () => {
		it("should return movie from database", async () => {
			const mockMovie = {
				movieId: "123",
				title: "Test Movie",
				posterPath: "/poster.jpg",
				releaseYear: 2024,
			};
			mockPrismaService.movie.findUnique.mockResolvedValue(mockMovie);

			const result = await service.getMovieByTMDBId("123");

			expect(result).toEqual(mockMovie);
			expect(mockPrismaService.movie.findUnique).toHaveBeenCalledWith({
				where: { movieId: "123" },
			});
		});

		it("should return null when movie not in database", async () => {
			mockPrismaService.movie.findUnique.mockResolvedValue(null);

			const result = await service.getMovieByTMDBId("999");

			expect(result).toBeNull();
		});
	});

	describe("upsertMovie", () => {
		it("should upsert movie with full data", async () => {
			const movieData = {
				id: 123,
				title: "Test Movie",
				poster_path: "/poster.jpg",
				backdrop_path: "/backdrop.jpg",
				release_date: "2024-06-15",
				overview: "A great test movie",
			};
			const mockUpsertedMovie = {
				movieId: "123",
				title: "Test Movie",
				posterPath: "/poster.jpg",
				backdropPath: "/backdrop.jpg",
				releaseYear: 2024,
				releaseDate: new Date("2024-06-15"),
				overview: "A great test movie",
			};
			const mockColors = {
				primary: "#ff0000",
				secondary: "#00ff00",
				accent: "#0000ff",
				muted: "#808080",
			};
			mockColorExtractionService.extractColorsFromPoster.mockResolvedValue(
				mockColors,
			);
			mockPrismaService.movie.upsert.mockResolvedValue(mockUpsertedMovie);

			const result = await service.upsertMovie(movieData);

			expect(
				mockColorExtractionService.extractColorsFromPoster,
			).toHaveBeenCalledWith("/poster.jpg");
			expect(result).toEqual(mockUpsertedMovie);
			expect(mockPrismaService.movie.upsert).toHaveBeenCalledWith({
				where: { movieId: "123" },
				create: expect.objectContaining({
					movieId: "123",
					title: "Test Movie",
					posterPath: "/poster.jpg",
					backdropPath: "/backdrop.jpg",
					releaseYear: 2024,
					overview: "A great test movie",
					colors: mockColors,
				}),
				update: expect.objectContaining({
					title: "Test Movie",
					posterPath: "/poster.jpg",
					backdropPath: "/backdrop.jpg",
					releaseYear: 2024,
					overview: "A great test movie",
				}),
			});
		});

		it("should handle movie without release date", async () => {
			const movieData = {
				id: 456,
				title: "Movie Without Date",
				poster_path: undefined,
				backdrop_path: undefined,
				release_date: undefined,
				overview: "No release date",
			};
			mockColorExtractionService.extractColorsFromPoster.mockResolvedValue(
				null,
			);
			mockPrismaService.movie.upsert.mockResolvedValue({
				movieId: "456",
				title: "Movie Without Date",
				posterPath: null,
				backdropPath: null,
				releaseYear: null,
				releaseDate: null,
				overview: "No release date",
			});

			await service.upsertMovie(movieData);

			expect(
				mockColorExtractionService.extractColorsFromPoster,
			).toHaveBeenCalledWith(null);
			expect(mockPrismaService.movie.upsert).toHaveBeenCalledWith({
				where: { movieId: "456" },
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

		it("should handle movie with empty release date string", async () => {
			const movieData = {
				id: 789,
				title: "Movie With Empty Date",
				poster_path: undefined,
				backdrop_path: undefined,
				release_date: "",
				overview: undefined,
			};
			mockColorExtractionService.extractColorsFromPoster.mockResolvedValue(
				null,
			);
			mockPrismaService.movie.upsert.mockResolvedValue({
				movieId: "789",
				title: "Movie With Empty Date",
			});

			await service.upsertMovie(movieData);

			expect(mockPrismaService.movie.upsert).toHaveBeenCalledWith({
				where: { movieId: "789" },
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

		it("should update stored colors when extraction returns a new palette", async () => {
			const movieData = {
				id: 321,
				title: "Color Refresh Movie",
				poster_path: "/poster-refresh.jpg",
				backdrop_path: undefined,
				release_date: "2025-01-01",
				overview: "Refresh colors",
			};
			const mockColors = {
				primary: "#60a5fa",
				secondary: "#818cf8",
				accent: "#c084fc",
				muted: "#94a3b8",
			};

			mockColorExtractionService.extractColorsFromPoster.mockResolvedValue(
				mockColors,
			);
			mockPrismaService.movie.upsert.mockResolvedValue({
				movieId: "321",
				title: "Color Refresh Movie",
			});

			await service.upsertMovie(movieData);

			expect(mockPrismaService.movie.upsert).toHaveBeenCalledWith({
				where: { movieId: "321" },
				create: expect.objectContaining({
					colors: mockColors,
				}),
				update: expect.objectContaining({
					colors: mockColors,
				}),
			});
		});
	});

	describe("ensureMovieHasColors", () => {
		it("should return existing colors when movie already has them", async () => {
			const existingColors = {
				primary: "#ff0000",
				secondary: "#00ff00",
				accent: "#0000ff",
				muted: "#808080",
			};
			mockPrismaService.movie.findUnique.mockResolvedValue({
				posterPath: "/poster.jpg",
				colors: existingColors,
			});

			const result = await service.ensureMovieHasColors("123");

			expect(result).toEqual(existingColors);
			expect(
				mockColorExtractionService.extractColorsFromPoster,
			).not.toHaveBeenCalled();
		});

		it("should extract and save colors when movie has no colors", async () => {
			const newColors = {
				primary: "#ff0000",
				secondary: "#00ff00",
				accent: "#0000ff",
				muted: "#808080",
			};
			mockPrismaService.movie.findUnique.mockResolvedValue({
				posterPath: "/poster.jpg",
				colors: null,
			});
			mockColorExtractionService.extractColorsFromPoster.mockResolvedValue(
				newColors,
			);

			const result = await service.ensureMovieHasColors("456");

			expect(
				mockColorExtractionService.extractColorsFromPoster,
			).toHaveBeenCalledWith("/poster.jpg");
			expect(result).toEqual(newColors);
		});

		it("should return null when movie not found", async () => {
			mockPrismaService.movie.findUnique.mockResolvedValue(null);

			const result = await service.ensureMovieHasColors("999");

			expect(result).toBeNull();
		});

		it("should handle color extraction failure gracefully", async () => {
			mockPrismaService.movie.findUnique.mockResolvedValue({
				posterPath: "/poster.jpg",
				colors: null,
			});
			mockColorExtractionService.extractColorsFromPoster.mockResolvedValue(
				null,
			);

			const result = await service.ensureMovieHasColors("123");

			expect(result).toBeNull();
		});
	});

	describe("markWatched", () => {
		it("should create AT Protocol record with unique rkey and return record info", async () => {
			const mockSession = { did: "did:plc:abc123" };
			const mockPutRecordResponse = {
				data: {
					uri: "at://did:plc:abc123/app.opnshelf.movie/movie-123-1234567890",
					cid: "cid123",
				},
			};

			mockPutRecord.mockResolvedValue(mockPutRecordResponse);

			const result = await service.markWatched(
				"did:plc:abc123",
				mockSession,
				"123",
			);

			expect(mockPutRecord).toHaveBeenCalledWith({
				repo: "did:plc:abc123",
				collection: "app.opnshelf.movie",
				rkey: expect.stringMatching(/^[a-z0-9]+$/),
				record: expect.objectContaining({
					$type: "app.opnshelf.movie",
					movieId: "123",
					source: "tmdb",
				}),
				validate: false,
			});
			expect(result.rkey).toMatch(/^[a-z0-9]+$/);
			expect(result.record).toMatchObject({
				$type: "app.opnshelf.movie",
				movieId: "123",
				source: "tmdb",
			});
		});

		it("should use custom watchedAt when provided", async () => {
			const mockSession = { did: "did:plc:abc123" };
			const customDate = "2024-01-15T10:30:00Z";
			const mockPutRecordResponse = {
				data: {
					uri: "at://did:plc:abc123/app.opnshelf.movie/movie-123-1234567890",
					cid: "cid123",
				},
			};

			mockPutRecord.mockResolvedValue(mockPutRecordResponse);

			await service.markWatched(
				"did:plc:abc123",
				mockSession,
				"123",
				customDate,
			);

			expect(mockPutRecord).toHaveBeenCalledWith(
				expect.objectContaining({
					record: expect.objectContaining({
						watchedAt: expect.stringContaining("2024-01-15"),
					}),
				}),
			);
		});
	});

	describe("unmarkWatched", () => {
		beforeEach(() => {
			mockPrismaService.trackedMovie.findFirst = jest.fn();
			mockPrismaService.trackedMovie.findMany = jest.fn();
		});

		it("should delete latest AT Protocol record in latest mode", async () => {
			const mockSession = { did: "did:plc:abc123" };
			const latestWatch = {
				id: "tracked-1",
				rkey: "movie-123-1234567890",
				movieId: "123",
			};

			mockPrismaService.trackedMovie.findFirst.mockResolvedValue(latestWatch);
			mockDeleteRecord.mockResolvedValue({});

			const result = await service.unmarkWatched(
				"did:plc:abc123",
				mockSession,
				"123",
				"latest",
			);

			expect(mockPrismaService.trackedMovie.findFirst).toHaveBeenCalledWith({
				where: { userDid: "did:plc:abc123", movieId: "123" },
				orderBy: { watchedDate: "desc" },
			});
			expect(mockDeleteRecord).toHaveBeenCalledWith({
				repo: "did:plc:abc123",
				collection: "app.opnshelf.movie",
				rkey: "movie-123-1234567890",
			});
			expect(result).toEqual({
				movieId: "123",
				mode: "latest",
				rkey: "movie-123-1234567890",
			});
		});

		it("should delete all AT Protocol records in all mode", async () => {
			const mockSession = { did: "did:plc:abc123" };
			const allWatches = [
				{ id: "tracked-1", rkey: "movie-123-1234567890", movieId: "123" },
				{ id: "tracked-2", rkey: "movie-123-1234567880", movieId: "123" },
			];

			mockPrismaService.trackedMovie.findMany.mockResolvedValue(allWatches);
			mockDeleteRecord.mockResolvedValue({});

			const result = await service.unmarkWatched(
				"did:plc:abc123",
				mockSession,
				"123",
				"all",
			);

			expect(mockPrismaService.trackedMovie.findMany).toHaveBeenCalledWith({
				where: { userDid: "did:plc:abc123", movieId: "123" },
				orderBy: { watchedDate: "desc" },
			});
			expect(mockDeleteRecord).toHaveBeenCalledTimes(2);
			expect(mockDeleteRecord).toHaveBeenNthCalledWith(1, {
				repo: "did:plc:abc123",
				collection: "app.opnshelf.movie",
				rkey: "movie-123-1234567890",
			});
			expect(mockDeleteRecord).toHaveBeenNthCalledWith(2, {
				repo: "did:plc:abc123",
				collection: "app.opnshelf.movie",
				rkey: "movie-123-1234567880",
			});
			expect(result).toEqual({
				movieId: "123",
				mode: "all",
				deletedCount: 2,
			});
		});

		it("should return empty result when no watch record found in latest mode", async () => {
			const mockSession = { did: "did:plc:abc123" };

			mockPrismaService.trackedMovie.findFirst.mockResolvedValue(null);

			const result = await service.unmarkWatched(
				"did:plc:abc123",
				mockSession,
				"123",
				"latest",
			);

			expect(result).toEqual({ movieId: "123", mode: "latest" });
		});
	});

	describe("indexTrackedMovie", () => {
		beforeEach(() => {
			mockPrismaService.trackedMovie.create = jest.fn();
		});

		it("should create tracked movie with movie details", async () => {
			const mockMovieDetails = {
				id: 123,
				title: "Test Movie",
				poster_path: "/poster.jpg",
				backdrop_path: "/backdrop.jpg",
				release_date: "2024-01-01",
				overview: "A test movie",
			};
			const mockUpsertedMovie = {
				movieId: "123",
				title: "Test Movie",
				posterPath: "/poster.jpg",
			};
			const mockTrackedMovie = {
				id: "tracked-1",
				uri: "at://did:plc:abc123/app.opnshelf.movie/movie-123-1234567890",
				rkey: "movie-123-1234567890",
				cid: "cid123",
				userDid: "did:plc:abc123",
				movieId: "123",
				status: "watched",
				watchedDate: new Date("2024-01-15"),
				movie: mockUpsertedMovie,
			};

			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockMovieDetails),
			});
			mockPrismaService.movie.upsert.mockResolvedValue(mockUpsertedMovie);
			mockPrismaService.trackedMovie.create.mockResolvedValue(mockTrackedMovie);

			const result = await service.indexTrackedMovie(
				"at://did:plc:abc123/app.opnshelf.movie/movie-123-1234567890",
				"cid123",
				"movie-123-1234567890",
				"did:plc:abc123",
				"123",
				"2024-01-15T10:00:00Z",
			);

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("/movie/123?api_key=test-api-key"),
			);
			expect(mockPrismaService.movie.upsert).toHaveBeenCalled();
			expect(mockPrismaService.trackedMovie.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					uri: "at://did:plc:abc123/app.opnshelf.movie/movie-123-1234567890",
					rkey: "movie-123-1234567890",
					cid: "cid123",
					userDid: "did:plc:abc123",
					movieId: "123",
					status: "watched",
				}),
				include: { movie: true },
			});
			expect(result).toEqual(mockTrackedMovie);
		});

		it("should throw error when TMDB API fails during indexing", async () => {
			mockFetch.mockResolvedValue({
				ok: false,
				status: 404,
			});

			await expect(
				service.indexTrackedMovie(
					"at://did:plc:abc123/app.opnshelf.movie/movie-123-1234567890",
					"cid123",
					"movie-123-1234567890",
					"did:plc:abc123",
					"123",
					"2024-01-15T10:00:00Z",
				),
			).rejects.toThrow("Movie not found");
		});
	});

	describe("removeAllTrackedMovies", () => {
		it("should delete all tracked movie records for user and movie", async () => {
			mockPrismaService.trackedMovie.deleteMany.mockResolvedValue({
				count: 2,
			} as any);

			await service.removeAllTrackedMovies("did:plc:abc123", "123");

			expect(mockPrismaService.trackedMovie.deleteMany).toHaveBeenCalledWith({
				where: {
					userDid: "did:plc:abc123",
					movieId: "123",
				},
			});
		});

		it("should handle when no records exist to delete", async () => {
			mockPrismaService.trackedMovie.deleteMany.mockResolvedValue({
				count: 0,
			} as any);

			await expect(
				service.removeAllTrackedMovies("did:plc:abc123", "999"),
			).resolves.not.toThrow();
		});
	});

	describe("removeLatestTrackedMovie", () => {
		beforeEach(() => {
			mockPrismaService.trackedMovie.findFirst = jest.fn();
			mockPrismaService.trackedMovie.delete = jest.fn();
		});

		it("should delete the latest tracked movie record", async () => {
			const latestWatch = {
				id: "tracked-1",
				rkey: "movie-123-1234567890",
				movieId: "123",
			};

			mockPrismaService.trackedMovie.findFirst.mockResolvedValue(latestWatch);
			mockPrismaService.trackedMovie.delete.mockResolvedValue(latestWatch);

			await service.removeLatestTrackedMovie("did:plc:abc123", "123");

			expect(mockPrismaService.trackedMovie.findFirst).toHaveBeenCalledWith({
				where: {
					userDid: "did:plc:abc123",
					movieId: "123",
				},
				orderBy: {
					watchedDate: "desc",
				},
			});
			expect(mockPrismaService.trackedMovie.delete).toHaveBeenCalledWith({
				where: {
					id: "tracked-1",
				},
			});
		});

		it("should handle when no records exist to delete", async () => {
			mockPrismaService.trackedMovie.findFirst.mockResolvedValue(null);

			await expect(
				service.removeLatestTrackedMovie("did:plc:abc123", "999"),
			).resolves.not.toThrow();

			expect(mockPrismaService.trackedMovie.delete).not.toHaveBeenCalled();
		});
	});

	describe("getUserMovies", () => {
		it("should return movies grouped by movieId with watch counts", async () => {
			const mockTrackedMovies = [
				{
					id: "tracked-1",
					movieId: "123",
					watchedDate: new Date("2024-01-15"),
					movie: { title: "Movie 1" },
				},
				{
					id: "tracked-2",
					movieId: "123",
					watchedDate: new Date("2024-01-10"),
					movie: { title: "Movie 1" },
				},
				{
					id: "tracked-3",
					movieId: "456",
					watchedDate: new Date("2024-01-12"),
					movie: { title: "Movie 2" },
				},
			];

			mockPrismaService.trackedMovie.findMany.mockResolvedValue(
				mockTrackedMovies,
			);

			const result = await service.getUserMovies("did:plc:abc123");

			expect(mockPrismaService.trackedMovie.findMany).toHaveBeenCalledWith({
				where: { userDid: "did:plc:abc123" },
				include: { movie: true },
				orderBy: { watchedDate: "desc" },
			});
			expect(result).toHaveLength(2);
			expect(result[0].movieId).toBe("123");
			expect(result[0].watchCount).toBe(2);
			expect(result[1].movieId).toBe("456");
			expect(result[1].watchCount).toBe(1);
		});
	});
});
