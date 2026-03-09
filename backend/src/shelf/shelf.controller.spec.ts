import { PATH_METADATA } from "@nestjs/common/constants";
import { Test, type TestingModule } from "@nestjs/testing";
import { ShelfController } from "./shelf.controller";
import { ShelfService } from "./shelf.service";

describe("ShelfController", () => {
	let controller: ShelfController;

	const mockShelfService = {
		getUserShelf: jest.fn(),
		getUserActivitySummary: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			controllers: [ShelfController],
			providers: [{ provide: ShelfService, useValue: mockShelfService }],
		}).compile();

		controller = module.get<ShelfController>(ShelfController);
	});

	it("should expose the paginated users shelf route", () => {
		expect(Reflect.getMetadata(PATH_METADATA, ShelfController)).toBe(
			"users/:userDid/shelf",
		);
		expect(
			Reflect.getMetadata(
				PATH_METADATA,
				ShelfController.prototype.getUserShelf,
			),
		).toBe("/");
	});

	it("should return page-based shelf metadata", async () => {
		mockShelfService.getUserShelf.mockResolvedValue({
			items: [
				{
					id: "tracked-movie-1",
					type: "movie",
					watchedDate: new Date("2024-01-10T00:00:00.000Z"),
					createdAt: new Date("2024-01-10T00:00:00.000Z"),
					data: {
						id: "tracked-movie-1",
						movieId: "movie-1",
						title: "Movie One",
						watchedDate: new Date("2024-01-10T00:00:00.000Z"),
						createdAt: new Date("2024-01-10T00:00:00.000Z"),
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
		});

		expect(mockShelfService.getUserShelf).toHaveBeenCalledWith(
			"did:plc:test",
			2,
			24,
		);
		expect(result).toMatchObject({
			total: 10,
			page: 2,
			pageSize: 24,
			totalPages: 5,
			hasPreviousPage: true,
			hasNextPage: true,
		});
		expect(result).not.toHaveProperty("nextCursor");
	});

	it("should expose the activity summary route", () => {
		expect(
			Reflect.getMetadata(
				PATH_METADATA,
				ShelfController.prototype.getUserActivitySummary,
			),
		).toBe("activity-summary");
	});

	it("should return the activity summary DTO", async () => {
		mockShelfService.getUserActivitySummary.mockResolvedValue({
			watchedLast7Days: 4,
			watchedLast30Days: 12,
			dailyActivity: [
				{ date: "2024-03-08", count: 1 },
				{ date: "2024-03-09", count: 3 },
			],
		});

		const result = await controller.getUserActivitySummary("did:plc:test");

		expect(mockShelfService.getUserActivitySummary).toHaveBeenCalledWith(
			"did:plc:test",
		);
		expect(result).toEqual({
			watchedLast7Days: 4,
			watchedLast30Days: 12,
			dailyActivity: [
				{ date: "2024-03-08", count: 1 },
				{ date: "2024-03-09", count: 3 },
			],
		});
	});
});
