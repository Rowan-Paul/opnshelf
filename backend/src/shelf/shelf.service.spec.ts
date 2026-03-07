import { Test, type TestingModule } from "@nestjs/testing";

jest.mock("../prisma/prisma.service", () => ({
	PrismaService: jest.fn(),
}));

import { PrismaService } from "../prisma/prisma.service";
import { ColorExtractionService } from "../movies/color-extraction.service";
import { ShelfService } from "./shelf.service";

type ShelfServiceInternals = {
	ensureMovieHasColors: (
		movieId: string,
	) => Promise<{ primary?: string } | null>;
	ensureShowHasColors: (showId: string) => Promise<{ primary?: string } | null>;
};

describe("ShelfService", () => {
	let service: ShelfService;

	const mockPrismaService = {
		trackedMovie: {
			count: jest.fn(),
		},
		trackedEpisode: {
			count: jest.fn(),
		},
		$queryRaw: jest.fn(),
		movie: {
			findUnique: jest.fn(),
			update: jest.fn(),
		},
		show: {
			findUnique: jest.fn(),
			update: jest.fn(),
		},
	};

	const mockColorExtractionService = {
		extractColorsFromPoster: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ShelfService,
				{ provide: PrismaService, useValue: mockPrismaService },
				{
					provide: ColorExtractionService,
					useValue: mockColorExtractionService,
				},
			],
		}).compile();

		service = module.get<ShelfService>(ShelfService);
	});

	it("should return mixed shelf items with page metadata", async () => {
		mockPrismaService.trackedMovie.count.mockResolvedValue(1);
		mockPrismaService.trackedEpisode.count.mockResolvedValue(1);
		mockPrismaService.$queryRaw.mockResolvedValue([
			{
				trackedId: "tracked-movie-1",
				type: "movie",
				watchedDate: new Date("2024-01-10T00:00:00.000Z"),
				createdAt: new Date("2024-01-10T00:00:00.000Z"),
				movieId: "movie-1",
				showId: null,
				title: "Movie One",
				posterPath: "/movie-one.jpg",
				backdropPath: null,
				releaseYear: 2024,
				releaseDate: new Date("2024-01-01T00:00:00.000Z"),
				seasonNumber: null,
				episodeNumber: null,
				firstAirYear: null,
				firstAirDate: null,
				overview: "Movie overview",
			},
			{
				trackedId: "tracked-episode-1",
				type: "episode",
				watchedDate: null,
				createdAt: new Date("2024-01-09T00:00:00.000Z"),
				movieId: null,
				showId: "show-1",
				title: "Show One",
				posterPath: "/show-one.jpg",
				backdropPath: null,
				releaseYear: null,
				releaseDate: null,
				seasonNumber: 2,
				episodeNumber: 4,
				firstAirYear: 2023,
				firstAirDate: new Date("2023-04-01T00:00:00.000Z"),
				overview: "Episode overview",
			},
		]);
		jest
			.spyOn(
				service as unknown as ShelfServiceInternals,
				"ensureMovieHasColors",
			)
			.mockResolvedValue({ primary: "#111111" });
		jest
			.spyOn(service as unknown as ShelfServiceInternals, "ensureShowHasColors")
			.mockResolvedValue({ primary: "#222222" });

		const result = await service.getUserShelf("did:plc:test", 1, 20);

		expect(result).toMatchObject({
			total: 2,
			page: 1,
			pageSize: 20,
			totalPages: 1,
			hasPreviousPage: false,
			hasNextPage: false,
		});
		expect(result.items).toHaveLength(2);
		expect(result.items[0]).toMatchObject({
			type: "movie",
			data: {
				movieId: "movie-1",
				title: "Movie One",
			},
		});
		expect(result.items[1]).toMatchObject({
			type: "episode",
			watchedDate: null,
			data: {
				showId: "show-1",
				seasonNumber: 2,
				episodeNumber: 4,
			},
		});
	});

	it("should clamp out-of-range page requests to the last page", async () => {
		mockPrismaService.trackedMovie.count.mockResolvedValue(25);
		mockPrismaService.trackedEpisode.count.mockResolvedValue(0);
		mockPrismaService.$queryRaw.mockResolvedValue([]);

		const result = await service.getUserShelf("did:plc:test", 99, 10);

		expect(result).toMatchObject({
			total: 25,
			page: 3,
			pageSize: 10,
			totalPages: 3,
			hasPreviousPage: true,
			hasNextPage: false,
		});
	});

	it("should use the merged order clause and page window in the raw query", async () => {
		mockPrismaService.trackedMovie.count.mockResolvedValue(4);
		mockPrismaService.trackedEpisode.count.mockResolvedValue(2);
		mockPrismaService.$queryRaw.mockResolvedValue([]);

		await service.getUserShelf("did:plc:test", 2, 3);

		const sql = mockPrismaService.$queryRaw.mock.calls[0]?.[0];
		const queryText = Array.isArray(sql?.strings)
			? sql.strings.join(" ")
			: String(sql);

		expect(queryText).toContain('COALESCE(tm."watchedDate", tm."createdAt")');
		expect(queryText).toContain('COALESCE(te."watchedDate", te."createdAt")');
		expect(queryText).toContain("ORDER BY");
		expect(queryText).toContain("OFFSET");
		expect(queryText).toContain("LIMIT");
		expect(sql.values.at(-2)).toBe(3);
		expect(sql.values.at(-1)).toBe(3);
	});
});
