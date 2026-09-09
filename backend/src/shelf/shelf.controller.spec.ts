import { Test, type TestingModule } from "@nestjs/testing";
import { ShelfController } from "./shelf.controller";
import { ShelfService } from "./shelf.service";

describe("ShelfController", () => {
	let controller: ShelfController;

	const mockShelfService = {
		getUserShelf: vi.fn(),
		getUserActivitySummary: vi.fn(),
	};

	beforeEach(async () => {
		vi.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			controllers: [ShelfController],
			providers: [{ provide: ShelfService, useValue: mockShelfService }],
		}).compile();

		controller = module.get<ShelfController>(ShelfController);
	});

	// The controller's real work is shaping each raw shelf row into a DTO:
	// discriminating movie vs episode and converting Dates to ISO strings.
	it("maps movie and episode rows to DTOs with ISO dates", async () => {
		mockShelfService.getUserShelf.mockResolvedValue({
			items: [
				{
					type: "movie",
					data: {
						id: "tm-1",
						movieId: "movie-1",
						title: "Movie One",
						watchedDate: new Date("2024-01-10T00:00:00.000Z"),
						watchCount: 3,
						createdAt: new Date("2024-01-11T00:00:00.000Z"),
					},
				},
				{
					type: "episode",
					data: {
						id: "te-1",
						showId: "show-1",
						showTitle: "Show One",
						seasonNumber: 2,
						episodeNumber: 5,
						watchedDate: null,
						watchCount: 2,
						createdAt: new Date("2024-02-01T00:00:00.000Z"),
					},
				},
			],
			total: 10,
			page: 2,
			pageSize: 24,
			totalPages: 5,
			hasPreviousPage: true,
			hasNextPage: true,
		});

		const result = await controller.getUserShelf("did:plc:test", {
			page: 2,
			pageSize: 24,
			sortOrder: "asc",
		});

		expect(mockShelfService.getUserShelf).toHaveBeenCalledWith(
			"did:plc:test",
			2,
			24,
			undefined,
			undefined,
			"asc",
		);
		expect(result.items[0]).toMatchObject({
			id: "tm-1",
			type: "movie",
			movieId: "movie-1",
			watchedDate: "2024-01-10T00:00:00.000Z",
			watchCount: 3,
			createdAt: "2024-01-11T00:00:00.000Z",
		});
		expect(result.items[1]).toMatchObject({
			id: "te-1",
			type: "episode",
			showId: "show-1",
			seasonNumber: 2,
			episodeNumber: 5,
			watchedDate: undefined,
			watchCount: 2,
			createdAt: "2024-02-01T00:00:00.000Z",
		});
		// Regression guard for the cursor -> page migration.
		expect(result).not.toHaveProperty("nextCursor");
	});
});
