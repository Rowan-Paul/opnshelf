import { Test, type TestingModule } from "@nestjs/testing";

jest.mock("../prisma/prisma.service", () => ({
	PrismaService: jest.fn(),
}));

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

jest.mock("@atproto/common", () => ({
	TID: {
		nextStr: jest.fn(() => "testtid123"),
	},
}));

jest.mock("../lexicons/app/opnshelf/list", () => ({
	main: {
		build: jest.fn((data: Record<string, unknown>) => ({
			$type: "app.opnshelf.list",
			...data,
		})),
	},
	$nsid: "app.opnshelf.list",
}));

jest.mock("../lexicons/app/opnshelf/listItem", () => ({
	main: {
		build: jest.fn((data: Record<string, unknown>) => ({
			$type: "app.opnshelf.listItem",
			...data,
		})),
	},
	$nsid: "app.opnshelf.listItem",
}));

import { MoviesService } from "../movies/movies.service";
import { PrismaService } from "../prisma/prisma.service";
import { ShowsService } from "../shows/shows.service";
import { ListsService } from "./lists.service";

describe("ListsService", () => {
	let service: ListsService;

	const mockPrismaService = {
		movieList: {
			findMany: jest.fn(),
			findFirst: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn(),
			upsert: jest.fn(),
		},
		listItem: {
			findUnique: jest.fn(),
			create: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn(),
			upsert: jest.fn(),
			count: jest.fn(),
		},
	};

	const mockMoviesService = {
		getMovieDetails: jest.fn(),
		upsertMovie: jest.fn(),
		getMovieByTMDBId: jest.fn(),
	};

	const mockShowsService = {
		getShowDetails: jest.fn(),
		upsertShow: jest.fn(),
		getShowByTMDBId: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();
		mockPutRecord.mockReset();
		mockDeleteRecord.mockReset();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ListsService,
				{ provide: PrismaService, useValue: mockPrismaService },
				{ provide: MoviesService, useValue: mockMoviesService },
				{ provide: ShowsService, useValue: mockShowsService },
			],
		}).compile();

		service = module.get<ListsService>(ListsService);
	});

	describe("getUserLists", () => {
		it("should return lists with item counts", async () => {
			mockPrismaService.movieList.findMany.mockResolvedValue([
				{
					id: "list-1",
					rkey: "watchlist-abc123",
					name: "Watchlist",
					description: "Movies to watch",
					slug: "watchlist-abc123",
					isDefault: true,
					_count: { items: 5 },
					createdAt: new Date("2024-01-01"),
					updatedAt: new Date("2024-01-02"),
				},
			]);

			const result = await service.getUserLists("did:plc:abc123");

			expect(result[0].movieCount).toBe(5);
			expect(mockPrismaService.movieList.findMany).toHaveBeenCalledWith({
				where: { userDid: "did:plc:abc123" },
				orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
				include: { _count: { select: { items: true } } },
			});
		});
	});

	describe("getListsForItem", () => {
		it("should return list membership for a movie", async () => {
			mockPrismaService.movieList.findMany.mockResolvedValue([
				{
					id: "list-1",
					name: "Watchlist",
					slug: "watchlist",
					isDefault: true,
					items: [{ id: "item-1" }],
				},
				{
					id: "list-2",
					name: "Favorites",
					slug: "favorites",
					isDefault: true,
					items: [],
				},
			]);

			const result = await service.getListsForItem(
				"did:plc:abc123",
				"movie",
				"123",
			);

			expect(result).toHaveLength(2);
			expect(result[0].isInList).toBe(true);
			expect(result[1].isInList).toBe(false);
		});
	});

	describe("addToList", () => {
		it("should add a movie to a list", async () => {
			mockPrismaService.movieList.findFirst.mockResolvedValue({
				id: "list-1",
				rkey: "watchlist-abc123",
			});
			mockPrismaService.listItem.findUnique.mockResolvedValue(null);
			mockMoviesService.getMovieDetails.mockResolvedValue({ id: 123 });
			mockMoviesService.upsertMovie.mockResolvedValue({ movieId: "123" });
			mockPrismaService.listItem.count.mockResolvedValue(0);
			mockPutRecord.mockResolvedValue({
				data: {
					uri: "at://did:plc:abc123/app.opnshelf.listItem/testtid123",
					cid: "cid123",
				},
			});
			mockPrismaService.listItem.create.mockResolvedValue({
				id: "item-1",
				rkey: "testtid123",
				mediaType: "movie",
				mediaId: "123",
				notes: "Want to watch",
				position: 0,
				createdAt: new Date("2024-01-01"),
				movie: {
					movieId: "123",
					title: "Test Movie",
					posterPath: "/poster.jpg",
					backdropPath: null,
					releaseYear: 2024,
					releaseDate: new Date("2024-01-01"),
					overview: null,
					colors: null,
				},
				show: null,
			});

			const result = await service.addToList(
				"did:plc:abc123",
				{ did: "did:plc:abc123" },
				"watchlist",
				{ mediaType: "movie", mediaId: "123", notes: "Want to watch" },
			);

			expect(result.mediaType).toBe("movie");
			expect(result.mediaId).toBe("123");
			expect(mockMoviesService.getMovieDetails).toHaveBeenCalledWith("123");
			expect(mockPrismaService.listItem.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						mediaType: "movie",
						mediaId: "123",
						movieId: "123",
						showId: null,
					}),
				}),
			);
		});

		it("should add a show to a list", async () => {
			mockPrismaService.movieList.findFirst.mockResolvedValue({
				id: "list-1",
				rkey: "favorites-abc123",
			});
			mockPrismaService.listItem.findUnique.mockResolvedValue(null);
			mockShowsService.getShowDetails.mockResolvedValue({ id: 456 });
			mockShowsService.upsertShow.mockResolvedValue({ showId: "456" });
			mockPrismaService.listItem.count.mockResolvedValue(1);
			mockPutRecord.mockResolvedValue({
				data: {
					uri: "at://did:plc:abc123/app.opnshelf.listItem/testtid123",
					cid: "cid123",
				},
			});
			mockPrismaService.listItem.create.mockResolvedValue({
				id: "item-2",
				rkey: "testtid123",
				mediaType: "show",
				mediaId: "456",
				notes: null,
				position: 1,
				createdAt: new Date("2024-01-01"),
				movie: null,
				show: {
					showId: "456",
					title: "Test Show",
					posterPath: "/poster.jpg",
					backdropPath: null,
					firstAirYear: 2024,
					firstAirDate: new Date("2024-01-01"),
					overview: null,
					colors: null,
				},
			});

			const result = await service.addToList(
				"did:plc:abc123",
				{ did: "did:plc:abc123" },
				"favorites",
				{ mediaType: "show", mediaId: "456" },
			);

			expect(result.mediaType).toBe("show");
			expect(result.mediaId).toBe("456");
			expect(mockShowsService.getShowDetails).toHaveBeenCalledWith("456");
			expect(mockPrismaService.listItem.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						mediaType: "show",
						mediaId: "456",
						movieId: null,
						showId: "456",
					}),
				}),
			);
		});
	});

	describe("removeFromList", () => {
		it("should remove a media item from a list", async () => {
			mockPrismaService.movieList.findFirst.mockResolvedValue({
				id: "list-1",
				rkey: "watchlist-abc123",
			});
			mockPrismaService.listItem.findUnique.mockResolvedValue({
				id: "item-1",
				rkey: "item-abc",
				mediaType: "movie",
				mediaId: "123",
			});

			await service.removeFromList(
				"did:plc:abc123",
				{ did: "did:plc:abc123" },
				"watchlist",
				"movie",
				"123",
			);

			expect(mockDeleteRecord).toHaveBeenCalledWith({
				repo: "did:plc:abc123",
				collection: "app.opnshelf.listItem",
				rkey: "item-abc",
			});
			expect(mockPrismaService.listItem.delete).toHaveBeenCalledWith({
				where: { id: "item-1" },
			});
		});
	});

	describe("indexListItemRecord", () => {
		it("should index a movie list item record", async () => {
			mockPrismaService.movieList.findFirst.mockResolvedValue({ id: "list-1" });
			mockMoviesService.getMovieByTMDBId.mockResolvedValue({ movieId: "123" });

			await service.indexListItemRecord(
				"at://did:plc:abc123/app.opnshelf.listItem/testtid123",
				"cid123",
				"testtid123",
				"did:plc:abc123",
				{
					$type: "app.opnshelf.listItem",
					listRkey: "watchlist-abc123",
					mediaType: "movie",
					mediaId: "123",
					notes: "Want to watch",
					createdAt: "2024-01-01T00:00:00.000Z",
				},
			);

			expect(mockPrismaService.listItem.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					create: expect.objectContaining({
						mediaType: "movie",
						mediaId: "123",
						movieId: "123",
						showId: null,
					}),
				}),
			);
		});

		it("should index a show list item record", async () => {
			mockPrismaService.movieList.findFirst.mockResolvedValue({ id: "list-1" });
			mockShowsService.getShowByTMDBId.mockResolvedValue({ showId: "456" });

			await service.indexListItemRecord(
				"at://did:plc:abc123/app.opnshelf.listItem/testtid123",
				"cid123",
				"testtid123",
				"did:plc:abc123",
				{
					$type: "app.opnshelf.listItem",
					listRkey: "favorites-abc123",
					mediaType: "show",
					mediaId: "456",
					createdAt: "2024-01-01T00:00:00.000Z",
				},
			);

			expect(mockPrismaService.listItem.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					create: expect.objectContaining({
						mediaType: "show",
						mediaId: "456",
						movieId: null,
						showId: "456",
					}),
				}),
			);
		});
	});

	describe("deleteListItemRecord", () => {
		it("should delete a list item record by rkey", async () => {
			mockPrismaService.listItem.deleteMany.mockResolvedValue({
				count: 1,
			});

			await service.deleteListItemRecord("testtid123");

			expect(mockPrismaService.listItem.deleteMany).toHaveBeenCalledWith({
				where: { rkey: "testtid123" },
			});
		});
	});
});
