import { Test, type TestingModule } from "@nestjs/testing";

vi.mock("../prisma/prisma.service", () => ({
	PrismaService: vi.fn(),
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
			findUnique: vi.fn(),
		},
		trackedMovie: {
			count: vi.fn(),
		},
		trackedEpisode: {
			count: vi.fn(),
		},
		$queryRaw: vi.fn(),
		movie: {
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		show: {
			findUnique: vi.fn(),
			update: vi.fn(),
		},
	};

	const mockColorExtractionService = {
		extractColorsFromPoster: vi.fn(),
	};

	beforeEach(async () => {
		vi.clearAllMocks();

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
		vi.useRealTimers();
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
				watchCount: 3n,
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
				watchCount: 2n,
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
		vi.spyOn(
			service as unknown as ShelfServiceInternals,
			"ensureMovieHasColors",
		).mockResolvedValue({ primary: "#111111" });
		vi.spyOn(
			service as unknown as ShelfServiceInternals,
			"ensureShowHasColors",
		).mockResolvedValue({ primary: "#222222" });

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
				watchCount: 3,
			},
		});
		expect(result.items[1]).toMatchObject({
			type: "episode",
			watchedDate: null,
			data: {
				showId: "show-1",
				seasonNumber: 2,
				episodeNumber: 4,
				watchCount: 2,
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

	it.each(["asc", "desc"] as const)(
		"should use deterministic %s ordering and the page window in the raw query",
		async (sortOrder) => {
			mockPrismaService.trackedMovie.count.mockResolvedValue(4);
			mockPrismaService.trackedEpisode.count.mockResolvedValue(2);
			mockPrismaService.$queryRaw.mockResolvedValue([]);

			await service.getUserShelf(
				"did:plc:test",
				2,
				3,
				undefined,
				undefined,
				sortOrder,
			);

			const sql = mockPrismaService.$queryRaw.mock.calls[0]?.[0];
			const queryText = Array.isArray(sql?.strings)
				? sql.strings.join(" ")
				: String(sql);

			expect(queryText).toContain('tm."watchedDate" IS NULL AS "isUndated"');
			expect(queryText).toContain('te."watchedDate" IS NULL AS "isUndated"');
			expect(queryText).not.toContain("COALESCE");
			expect(queryText).toContain("ORDER BY");
			expect(queryText).toContain('shelf."isUndated" ASC');
			expect(queryText).toContain(
				`shelf."sortDate" ${sortOrder.toUpperCase()} NULLS LAST`,
			);
			expect(queryText).toContain("OFFSET");
			expect(queryText).toContain("LIMIT");
			expect(sql.values.at(-2)).toBe(3);
			expect(sql.values.at(-1)).toBe(3);
		},
	);

	it("should return a 30-day activity summary with zero-filled days and matching totals", async () => {
		vi.useFakeTimers().setSystemTime(new Date("2024-03-10T12:00:00.000Z"));
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

	describe("getSyncStatus", () => {
		const did = "did:plc:test";
		const NOW = new Date("2024-03-10T12:00:00.000Z");

		beforeEach(() => {
			vi.useFakeTimers().setSystemTime(NOW);
			mockPrismaService.trackedMovie.count.mockResolvedValue(3);
			mockPrismaService.trackedEpisode.count.mockResolvedValue(7);
		});

		it("is not syncing when no backfill window was ever opened", async () => {
			mockPrismaService.user.findUnique.mockResolvedValue({
				backfillStartedAt: null,
				lastIngestAt: null,
			});

			const result = await service.getSyncStatus(did);

			expect(result.isSyncing).toBe(false);
			expect(result.trackedMovieCount).toBe(3);
			expect(result.trackedEpisodeCount).toBe(7);
		});

		it("syncs during the initial grace period while waiting for the first record", async () => {
			mockPrismaService.user.findUnique.mockResolvedValue({
				backfillStartedAt: new Date(NOW.getTime() - 5_000),
				lastIngestAt: null,
			});

			const result = await service.getSyncStatus(did);

			expect(result.isSyncing).toBe(true);
		});

		it("stops syncing once the initial grace period elapses with no records", async () => {
			mockPrismaService.user.findUnique.mockResolvedValue({
				backfillStartedAt: new Date(NOW.getTime() - 25_000),
				lastIngestAt: null,
			});

			const result = await service.getSyncStatus(did);

			expect(result.isSyncing).toBe(false);
		});

		it("keeps syncing while records are still arriving (within the quiet gap)", async () => {
			mockPrismaService.user.findUnique.mockResolvedValue({
				backfillStartedAt: new Date(NOW.getTime() - 30_000),
				lastIngestAt: new Date(NOW.getTime() - 2_000),
			});

			const result = await service.getSyncStatus(did);

			expect(result.isSyncing).toBe(true);
		});

		it("stops syncing once the stream goes quiet (past the quiet gap)", async () => {
			mockPrismaService.user.findUnique.mockResolvedValue({
				backfillStartedAt: new Date(NOW.getTime() - 60_000),
				lastIngestAt: new Date(NOW.getTime() - 10_000),
			});

			const result = await service.getSyncStatus(did);

			expect(result.isSyncing).toBe(false);
		});

		it("never reports syncing past the max window, even if records keep trickling", async () => {
			mockPrismaService.user.findUnique.mockResolvedValue({
				backfillStartedAt: new Date(NOW.getTime() - 130_000),
				lastIngestAt: new Date(NOW.getTime() - 1_000),
			});

			const result = await service.getSyncStatus(did);

			expect(result.isSyncing).toBe(false);
		});

		it("treats a returning user with only old records as not syncing", async () => {
			// Re-login stamps backfillStartedAt=now but the last record is ancient,
			// so the user shouldn't see a syncing indicator.
			mockPrismaService.user.findUnique.mockResolvedValue({
				backfillStartedAt: NOW,
				lastIngestAt: new Date(NOW.getTime() - 86_400_000),
			});

			const result = await service.getSyncStatus(did);

			expect(result.isSyncing).toBe(false);
		});
	});

	it("should use the saved timezone when building the 30-day window", async () => {
		vi.useFakeTimers().setSystemTime(new Date("2024-03-10T01:30:00.000Z"));
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
		// Prisma persists DateTime as a timezone-less PostgreSQL TIMESTAMP whose
		// wall-clock value is UTC. Attach UTC before projecting into the owner's
		// timezone; otherwise a just-after-midnight watch is shifted backwards.
		expect(queryText).toContain(
			"(tm.\"watchedDate\" AT TIME ZONE 'UTC' AT TIME ZONE",
		);
		expect(queryText).toContain(
			"(te.\"watchedDate\" AT TIME ZONE 'UTC' AT TIME ZONE",
		);
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
