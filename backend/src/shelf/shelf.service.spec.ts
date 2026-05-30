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
		user: {
			findUnique: jest.fn(),
		},
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

	afterEach(() => {
		jest.useRealTimers();
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

	it("should return a 30-day activity summary with zero-filled days and matching totals", async () => {
		jest.useFakeTimers().setSystemTime(new Date("2024-03-10T12:00:00.000Z"));
		mockPrismaService.user.findUnique.mockResolvedValue({
			timezone: "America/New_York",
		});
		mockPrismaService.$queryRaw.mockResolvedValue([
			{ dayKey: "2024-02-10", count: 1 },
			{ dayKey: "2024-03-08", count: 2 },
			{ dayKey: "2024-03-09", count: 3 },
			{ dayKey: "2024-03-10", count: 4 },
		]);

		const result = await service.getUserActivitySummary("did:plc:test");

		expect(result.dailyActivity).toHaveLength(30);
		expect(result.dailyActivity[0]).toEqual({
			date: "2024-02-10",
			count: 1,
		});
		expect(result.dailyActivity[1]).toEqual({
			date: "2024-02-11",
			count: 0,
		});
		expect(result.dailyActivity.at(-1)).toEqual({
			date: "2024-03-10",
			count: 4,
		});
		expect(result.watchedLast30Days).toBe(10);
		expect(result.watchedLast7Days).toBe(9);
	});

	it("should use the saved timezone when building the 30-day window", async () => {
		jest.useFakeTimers().setSystemTime(new Date("2024-03-10T01:30:00.000Z"));
		mockPrismaService.user.findUnique.mockResolvedValue({
			timezone: "America/Los_Angeles",
		});
		mockPrismaService.$queryRaw.mockResolvedValue([]);

		await service.getUserActivitySummary("did:plc:test");

		const sql = mockPrismaService.$queryRaw.mock.calls.at(-1)?.[0];
		const queryText = Array.isArray(sql?.strings)
			? sql.strings.join(" ")
			: String(sql);

		// Activity counts logged watches only: watchedDate-based, status =
		// 'watched', no createdAt fallback (see the Watch term in CONTEXT.md).
		expect(queryText).toContain('(tm."watchedDate" AT TIME ZONE');
		expect(queryText).toContain('(te."watchedDate" AT TIME ZONE');
		expect(queryText).toContain("\"status\" = 'watched'");
		expect(queryText).not.toContain("COALESCE");
		expect(queryText).toContain("AT TIME ZONE");
		expect(queryText).toContain("BETWEEN CAST(");
		expect(mockPrismaService.$queryRaw).toHaveBeenCalledWith(
			expect.objectContaining({
				values: [
					"America/Los_Angeles",
					"did:plc:test",
					"America/Los_Angeles",
					"did:plc:test",
					"2024-02-09",
					"2024-03-09",
				],
			}),
		);
	});
});
