import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";

vi.mock("../prisma/prisma.service", () => ({
	PrismaService: vi.fn(),
}));

import { ColorExtractionService } from "../movies/color-extraction.service";
import { PrismaService } from "../prisma/prisma.service";
import { ShowCatalogueService } from "./show-catalogue.service";
import { ShowsTmdbService } from "./shows-tmdb.service";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ShowCatalogueService", () => {
	let service: ShowCatalogueService;

	const mockPrismaService = {
		show: {
			findUnique: vi.fn(),
			upsert: vi.fn(),
			update: vi.fn(),
		},
		season: {
			findFirst: vi.fn(),
			findMany: vi.fn(),
			upsert: vi.fn(),
		},
		episode: {
			findFirst: vi.fn(),
			findMany: vi.fn(),
			upsert: vi.fn(),
			count: vi.fn(),
		},
	};

	const mockConfigService = {
		get: vi.fn((key: string) => {
			if (key === "TMDB_API_KEY") return "test-api-key";
			return undefined;
		}),
	};

	const mockColorExtractionService = {
		extractColorsFromPoster: vi.fn(),
	};

	beforeEach(async () => {
		vi.clearAllMocks();
		mockFetch.mockReset();
		mockPrismaService.season.findMany.mockResolvedValue([]);
		mockPrismaService.episode.findMany.mockResolvedValue([]);

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ShowCatalogueService,
				ShowsTmdbService,
				{ provide: PrismaService, useValue: mockPrismaService },
				{ provide: ConfigService, useValue: mockConfigService },
				{
					provide: ColorExtractionService,
					useValue: mockColorExtractionService,
				},
			],
		}).compile();

		service = module.get<ShowCatalogueService>(ShowCatalogueService);
	});

	describe("syncShowMetadata", () => {
		it("should upsert the show before upserting seasons", async () => {
			mockPrismaService.season.findFirst.mockResolvedValue(null);
			mockColorExtractionService.extractColorsFromPoster.mockResolvedValue(
				null,
			);
			mockPrismaService.show.upsert.mockResolvedValue({
				showId: "123",
				title: "Test Show",
			});
			mockPrismaService.season.upsert.mockResolvedValue({
				id: "season-1",
			});
			mockPrismaService.episode.upsert.mockResolvedValue({
				id: "episode-1",
			});

			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: () =>
						Promise.resolve({
							id: 123,
							name: "Test Show",
							overview: "A test show",
							first_air_date: "2024-01-01",
							seasons: [
								{
									id: 10,
									season_number: 1,
									name: "Season 1",
									poster_path: "/season.jpg",
									air_date: "2024-01-01",
									episode_count: 1,
								},
							],
						}),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ results: [] }),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () =>
						Promise.resolve({
							id: 10,
							name: "Season 1",
							season_number: 1,
							episodes: [
								{
									id: 100,
									name: "Episode 1",
									episode_number: 1,
									still_path: "/episode.jpg",
									air_date: "2024-01-02",
									overview: "Episode overview",
								},
							],
						}),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ results: [] }),
				});

			await service.syncShowMetadata("123");

			expect(mockPrismaService.show.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { showId: "123" },
				}),
			);
			expect(mockPrismaService.season.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					create: expect.objectContaining({
						showId: "123",
						seasonNumber: 1,
					}),
				}),
			);
			expect(
				mockPrismaService.show.upsert.mock.invocationCallOrder[0],
			).toBeLessThan(
				mockPrismaService.season.upsert.mock.invocationCallOrder[0],
			);
		});
	});

	describe("getEpisodeContextLocal", () => {
		it("should move to the next aired episode across seasons", async () => {
			mockPrismaService.episode.count.mockResolvedValue(0);

			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ number_of_seasons: 3 }),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ results: [] }),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () =>
						Promise.resolve({
							episodes: [{ episode_number: 10, season_number: 1 }],
						}),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ results: [] }),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ episodes: [] }),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ results: [] }),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () =>
						Promise.resolve({
							episodes: [
								{
									episode_number: 1,
									season_number: 3,
									air_date: "2024-01-02",
								},
							],
						}),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ results: [] }),
				});

			const result = await service.getEpisodeContextLocal("123", 1, 10);

			expect(result).toEqual({
				previous: null,
				next: { seasonNumber: 3, episodeNumber: 1 },
			});
		});
	});
});
