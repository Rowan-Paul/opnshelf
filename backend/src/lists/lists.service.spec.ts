import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";

// Mock PrismaService before importing ListsService
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

// Mock @atproto/common TID
jest.mock("@atproto/common", () => ({
	TID: {
		nextStr: jest.fn(() => "testtid123"),
	},
}));

// Mock lexicon modules
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

import { PrismaService } from "../prisma/prisma.service";
import { MoviesService } from "../movies/movies.service";
import { ListsService } from "./lists.service";

// Mock global fetch for TMDB API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

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
		movieListItem: {
			findUnique: jest.fn(),
			create: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn(),
			upsert: jest.fn(),
			count: jest.fn(),
		},
		movie: {
			findUnique: jest.fn(),
			upsert: jest.fn(),
			update: jest.fn(),
		},
	};

	const mockMoviesService = {
		getMovieDetails: jest.fn(),
		upsertMovie: jest.fn(),
		getMovieByTMDBId: jest.fn(),
	};

	const mockConfigService = {
		get: jest.fn((key: string) => {
			if (key === "TMDB_API_KEY") return "test-api-key";
			return undefined;
		}),
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
				{ provide: ConfigService, useValue: mockConfigService },
			],
		}).compile();

		service = module.get<ListsService>(ListsService);
	});

	describe("getUserLists", () => {
		it("should return lists with movie counts", async () => {
			const mockLists = [
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
				{
					id: "list-2",
					rkey: "customlist-def456",
					name: "My Favorites",
					description: null,
					slug: "my-favorites-def456",
					isDefault: false,
					_count: { items: 3 },
					createdAt: new Date("2024-01-03"),
					updatedAt: new Date("2024-01-04"),
				},
			];
			mockPrismaService.movieList.findMany.mockResolvedValue(mockLists);

			const result = await service.getUserLists("did:plc:abc123");

			expect(result).toHaveLength(2);
			expect(result[0].name).toBe("Watchlist");
			expect(result[0].movieCount).toBe(5);
			expect(result[1].name).toBe("My Favorites");
			expect(result[1].movieCount).toBe(3);
			expect(mockPrismaService.movieList.findMany).toHaveBeenCalledWith({
				where: { userDid: "did:plc:abc123" },
				orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
				include: { _count: { select: { items: true } } },
			});
		});

		it("should return empty array when user has no lists", async () => {
			mockPrismaService.movieList.findMany.mockResolvedValue([]);

			const result = await service.getUserLists("did:plc:newuser");

			expect(result).toEqual([]);
		});
	});

	describe("getList", () => {
		it("should return list with movies", async () => {
			const mockList = {
				id: "list-1",
				rkey: "watchlist-abc123",
				uri: "at://did:plc:abc123/app.opnshelf.list/watchlist-abc123",
				userDid: "did:plc:abc123",
				name: "Watchlist",
				description: "Movies to watch",
				slug: "watchlist-abc123",
				isDefault: true,
				createdAt: new Date("2024-01-01"),
				updatedAt: new Date("2024-01-02"),
				items: [
					{
						id: "item-1",
						rkey: "item-abc",
						movieId: "123",
						notes: "Want to watch",
						position: 0,
						createdAt: new Date("2024-01-03"),
						movie: {
							movieId: "123",
							title: "Test Movie",
							posterPath: "/poster.jpg",
							backdropPath: "/backdrop.jpg",
							releaseYear: 2024,
							releaseDate: new Date("2024-01-01"),
							overview: "A test movie",
							colors: { primary: "#ff0000" },
						},
					},
				],
			};
			mockPrismaService.movieList.findFirst.mockResolvedValue(mockList);

			const result = await service.getList(
				"did:plc:abc123",
				"watchlist-abc123",
			);

			expect(result).not.toBeNull();
			expect(result?.name).toBe("Watchlist");
			expect(result?.items).toHaveLength(1);
			expect(result?.items?.[0].movieId).toBe("123");
		});

		it("should return null when list not found", async () => {
			mockPrismaService.movieList.findFirst.mockResolvedValue(null);

			const result = await service.getList("did:plc:abc123", "nonexistent");

			expect(result).toBeNull();
		});
	});

	describe("getListsForMovie", () => {
		it("should return lists with membership status", async () => {
			const mockLists = [
				{
					id: "list-1",
					name: "Watchlist",
					slug: "watchlist-abc123",
					isDefault: true,
					items: [{ id: "item-1" }],
				},
				{
					id: "list-2",
					name: "Favorites",
					slug: "favorites-abc123",
					isDefault: true,
					items: [],
				},
			];
			mockPrismaService.movieList.findMany.mockResolvedValue(mockLists);

			const result = await service.getListsForMovie("did:plc:abc123", "123");

			expect(result).toHaveLength(2);
			expect(result[0].isInList).toBe(true);
			expect(result[1].isInList).toBe(false);
		});
	});

	describe("ensureDefaultLists", () => {
		it("should create default lists when they don't exist", async () => {
			mockPrismaService.movieList.findMany
				.mockResolvedValueOnce([]) // First call to check existing
				.mockResolvedValueOnce([
					// Second call after creation
					{
						id: "list-1",
						rkey: "watchlist-abc123",
						uri: "at://did:plc:abc123/app.opnshelf.list/watchlist-abc123",
						userDid: "did:plc:abc123",
						name: "Watchlist",
						description: "Movies you want to watch",
						slug: "watchlist",
						isDefault: true,
						createdAt: new Date(),
						updatedAt: new Date(),
					},
					{
						id: "list-2",
						rkey: "favorites-abc123",
						uri: "at://did:plc:abc123/app.opnshelf.list/favorites-abc123",
						userDid: "did:plc:abc123",
						name: "Favorites",
						description: "Your favorite movies",
						slug: "favorites",
						isDefault: true,
						createdAt: new Date(),
						updatedAt: new Date(),
					},
				]);

			mockPutRecord.mockResolvedValue({
				data: {
					uri: "at://did:plc:abc123/app.opnshelf.list/testtid123",
					cid: "cid123",
				},
			});

			mockPrismaService.movieList.create.mockResolvedValue({
				id: "list-1",
				rkey: "testtid123",
				uri: "at://did:plc:abc123/app.opnshelf.list/testtid123",
				cid: "cid123",
				userDid: "did:plc:abc123",
				name: "Watchlist",
				description: "Movies you want to watch",
				slug: "watchlist",
				isDefault: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			const mockSession = { did: "did:plc:abc123" };
			const result = await service.ensureDefaultLists(
				"did:plc:abc123",
				mockSession,
			);

			expect(result).toHaveLength(2);
		});

		it("should not create lists when they already exist", async () => {
			const existingLists = [
				{
					id: "list-1",
					rkey: "watchlist-abc123",
					uri: "at://did:plc:abc123/app.opnshelf.list/watchlist-abc123",
					userDid: "did:plc:abc123",
					name: "Watchlist",
					slug: "watchlist",
					isDefault: true,
					createdAt: new Date(),
					updatedAt: new Date(),
				},
				{
					id: "list-2",
					rkey: "favorites-abc123",
					uri: "at://did:plc:abc123/app.opnshelf.list/favorites-abc123",
					userDid: "did:plc:abc123",
					name: "Favorites",
					slug: "favorites",
					isDefault: true,
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			];
			mockPrismaService.movieList.findMany.mockResolvedValue(existingLists);

			const mockSession = { did: "did:plc:abc123" };
			const result = await service.ensureDefaultLists(
				"did:plc:abc123",
				mockSession,
			);

			expect(result).toHaveLength(2);
			expect(mockPutRecord).not.toHaveBeenCalled();
			expect(mockPrismaService.movieList.create).not.toHaveBeenCalled();
		});
	});

	describe("createList", () => {
		it("should create a new custom list", async () => {
			const mockPutRecordResponse = {
				data: {
					uri: "at://did:plc:abc123/app.opnshelf.list/testtid123",
					cid: "cid123",
				},
			};
			mockPutRecord.mockResolvedValue(mockPutRecordResponse);

			mockPrismaService.movieList.create.mockResolvedValue({
				id: "list-1",
				rkey: "testtid123",
				uri: "at://did:plc:abc123/app.opnshelf.list/testtid123",
				cid: "cid123",
				userDid: "did:plc:abc123",
				name: "My List",
				description: "A custom list",
				slug: "my-list-abc123",
				isDefault: false,
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			const mockSession = { did: "did:plc:abc123" };
			const result = await service.createList("did:plc:abc123", mockSession, {
				name: "My List",
				description: "A custom list",
			});

			expect(result.name).toBe("My List");
			expect(result.isDefault).toBe(false);
			expect(mockPutRecord).toHaveBeenCalledWith(
				expect.objectContaining({
					repo: "did:plc:abc123",
					collection: "app.opnshelf.list",
					validate: false,
				}),
			);
		});
	});

	describe("updateList", () => {
		it("should update an existing list", async () => {
			const existingList = {
				id: "list-1",
				rkey: "list-abc123",
				uri: "at://did:plc:abc123/app.opnshelf.list/list-abc123",
				userDid: "did:plc:abc123",
				name: "Old Name",
				description: "Old description",
				slug: "old-name-abc123",
				isDefault: false,
				createdAt: new Date("2024-01-01"),
				updatedAt: new Date("2024-01-01"),
			};
			mockPrismaService.movieList.findFirst.mockResolvedValue(existingList);

			mockPutRecord.mockResolvedValue({});

			mockPrismaService.movieList.update.mockResolvedValue({
				...existingList,
				name: "New Name",
				description: "New description",
				slug: "new-name-abc123",
				updatedAt: new Date(),
			});

			const mockSession = { did: "did:plc:abc123" };
			const result = await service.updateList(
				"did:plc:abc123",
				mockSession,
				"old-name-abc123",
				{ name: "New Name", description: "New description" },
			);

			expect(result.name).toBe("New Name");
			expect(result.description).toBe("New description");
		});

		it("should throw NotFoundException when list not found", async () => {
			mockPrismaService.movieList.findFirst.mockResolvedValue(null);

			const mockSession = { did: "did:plc:abc123" };
			await expect(
				service.updateList("did:plc:abc123", mockSession, "nonexistent", {
					name: "New Name",
				}),
			).rejects.toThrow("List not found");
		});
	});

	describe("deleteList", () => {
		it("should delete a custom list", async () => {
			const existingList = {
				id: "list-1",
				rkey: "list-abc123",
				isDefault: false,
			};
			mockPrismaService.movieList.findFirst.mockResolvedValue(existingList);

			mockDeleteRecord.mockResolvedValue({});
			mockPrismaService.movieList.delete.mockResolvedValue(existingList);

			const mockSession = { did: "did:plc:abc123" };
			await service.deleteList("did:plc:abc123", mockSession, "my-list");

			expect(mockDeleteRecord).toHaveBeenCalledWith({
				repo: "did:plc:abc123",
				collection: "app.opnshelf.list",
				rkey: "list-abc123",
			});
		});

		it("should throw error when trying to delete default list", async () => {
			const existingList = {
				id: "list-1",
				rkey: "watchlist-abc123",
				isDefault: true,
			};
			mockPrismaService.movieList.findFirst.mockResolvedValue(existingList);

			const mockSession = { did: "did:plc:abc123" };
			await expect(
				service.deleteList("did:plc:abc123", mockSession, "watchlist"),
			).rejects.toThrow("Cannot delete default lists");
		});
	});

	describe("addToList", () => {
		it("should add a movie to a list", async () => {
			const existingList = {
				id: "list-1",
				rkey: "watchlist-abc123",
			};
			mockPrismaService.movieList.findFirst.mockResolvedValue(existingList);

			mockPrismaService.movieListItem.findUnique.mockResolvedValue(null);

			mockFetch.mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						id: 123,
						title: "Test Movie",
						poster_path: "/poster.jpg",
						release_date: "2024-01-01",
					}),
			});

			mockMoviesService.upsertMovie.mockResolvedValue({ movieId: "123" });

			mockPrismaService.movieListItem.count.mockResolvedValue(0);

			mockPutRecord.mockResolvedValue({
				data: {
					uri: "at://did:plc:abc123/app.opnshelf.listItem/testtid123",
					cid: "cid123",
				},
			});

			mockPrismaService.movieListItem.create.mockResolvedValue({
				id: "item-1",
				rkey: "testtid123",
				uri: "at://did:plc:abc123/app.opnshelf.listItem/testtid123",
				cid: "cid123",
				listId: "list-1",
				movieId: "123",
				notes: "Want to watch",
				position: 0,
				createdAt: new Date(),
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
			});

			const mockSession = { did: "did:plc:abc123" };
			const result = await service.addToList(
				"did:plc:abc123",
				mockSession,
				"watchlist",
				{ movieId: "123", notes: "Want to watch" },
			);

			expect(result.movieId).toBe("123");
			expect(mockPutRecord).toHaveBeenCalledWith(
				expect.objectContaining({
					repo: "did:plc:abc123",
					collection: "app.opnshelf.listItem",
				}),
			);
		});

		it("should return existing item if movie already in list", async () => {
			const existingList = {
				id: "list-1",
				rkey: "watchlist-abc123",
			};
			mockPrismaService.movieList.findFirst.mockResolvedValue(existingList);

			const existingItem = {
				id: "item-1",
				rkey: "existing-item",
				movieId: "123",
				notes: "Already in list",
				position: 0,
				createdAt: new Date(),
				movie: {
					movieId: "123",
					title: "Test Movie",
					posterPath: "/poster.jpg",
				},
			};
			mockPrismaService.movieListItem.findUnique.mockResolvedValue(
				existingItem,
			);

			const mockSession = { did: "did:plc:abc123" };
			const result = await service.addToList(
				"did:plc:abc123",
				mockSession,
				"watchlist",
				{ movieId: "123" },
			);

			expect(result.id).toBe("item-1");
			expect(mockPutRecord).not.toHaveBeenCalled();
		});
	});

	describe("removeFromList", () => {
		it("should remove a movie from a list", async () => {
			const existingList = {
				id: "list-1",
				rkey: "watchlist-abc123",
			};
			mockPrismaService.movieList.findFirst.mockResolvedValue(existingList);

			const existingItem = {
				id: "item-1",
				rkey: "item-abc",
				movieId: "123",
			};
			mockPrismaService.movieListItem.findUnique.mockResolvedValue(
				existingItem,
			);

			mockDeleteRecord.mockResolvedValue({});
			mockPrismaService.movieListItem.delete.mockResolvedValue(existingItem);

			const mockSession = { did: "did:plc:abc123" };
			await service.removeFromList(
				"did:plc:abc123",
				mockSession,
				"watchlist",
				"123",
			);

			expect(mockDeleteRecord).toHaveBeenCalledWith({
				repo: "did:plc:abc123",
				collection: "app.opnshelf.listItem",
				rkey: "item-abc",
			});
		});

		it("should do nothing if movie not in list", async () => {
			const existingList = {
				id: "list-1",
				rkey: "watchlist-abc123",
			};
			mockPrismaService.movieList.findFirst.mockResolvedValue(existingList);

			mockPrismaService.movieListItem.findUnique.mockResolvedValue(null);

			const mockSession = { did: "did:plc:abc123" };
			await service.removeFromList(
				"did:plc:abc123",
				mockSession,
				"watchlist",
				"999",
			);

			expect(mockDeleteRecord).not.toHaveBeenCalled();
		});
	});

	describe("indexListRecord", () => {
		it("should index a list record", async () => {
			mockPrismaService.movieList.upsert.mockResolvedValue({});

			await service.indexListRecord(
				"at://did:plc:abc123/app.opnshelf.list/testtid123",
				"cid123",
				"testtid123",
				"did:plc:abc123",
				{
					$type: "app.opnshelf.list",
					name: "My List",
					description: "A test list",
					slug: "my-list",
					isDefault: false,
					createdAt: "2024-01-01T00:00:00.000Z",
				},
			);

			expect(mockPrismaService.movieList.upsert).toHaveBeenCalledWith({
				where: { rkey: "testtid123" },
				create: expect.objectContaining({
					rkey: "testtid123",
					uri: "at://did:plc:abc123/app.opnshelf.list/testtid123",
					cid: "cid123",
					userDid: "did:plc:abc123",
					name: "My List",
					description: "A test list",
					slug: "my-list",
					isDefault: false,
				}),
				update: expect.objectContaining({
					cid: "cid123",
					name: "My List",
				}),
			});
		});
	});

	describe("deleteListRecord", () => {
		it("should delete a list record by rkey", async () => {
			mockPrismaService.movieList.deleteMany.mockResolvedValue({ count: 1 });

			await service.deleteListRecord("testtid123");

			expect(mockPrismaService.movieList.deleteMany).toHaveBeenCalledWith({
				where: { rkey: "testtid123" },
			});
		});
	});

	describe("indexListItemRecord", () => {
		it("should index a list item record", async () => {
			mockPrismaService.movieList.findFirst.mockResolvedValue({
				id: "list-1",
				rkey: "watchlist-abc123",
			});

			mockMoviesService.getMovieByTMDBId.mockResolvedValue({ movieId: "123" });

			mockPrismaService.movieListItem.upsert.mockResolvedValue({});

			await service.indexListItemRecord(
				"at://did:plc:abc123/app.opnshelf.listItem/testtid123",
				"cid123",
				"testtid123",
				"did:plc:abc123",
				{
					$type: "app.opnshelf.listItem",
					listRkey: "watchlist-abc123",
					movieId: "123",
					notes: "Want to watch",
					createdAt: "2024-01-01T00:00:00.000Z",
				},
			);

			expect(mockPrismaService.movieListItem.upsert).toHaveBeenCalledWith({
				where: { rkey: "testtid123" },
				create: expect.objectContaining({
					rkey: "testtid123",
					movieId: "123",
					notes: "Want to watch",
				}),
				update: expect.objectContaining({
					notes: "Want to watch",
				}),
			});
		});

		it("should skip if list not found", async () => {
			mockPrismaService.movieList.findFirst.mockResolvedValue(null);

			await service.indexListItemRecord(
				"at://did:plc:abc123/app.opnshelf.listItem/testtid123",
				"cid123",
				"testtid123",
				"did:plc:abc123",
				{
					$type: "app.opnshelf.listItem",
					listRkey: "nonexistent",
					movieId: "123",
					createdAt: "2024-01-01T00:00:00.000Z",
				},
			);

			expect(mockPrismaService.movieListItem.upsert).not.toHaveBeenCalled();
		});

		it("should create movie if not in database", async () => {
			mockPrismaService.movieList.findFirst.mockResolvedValue({
				id: "list-1",
				rkey: "watchlist-abc123",
			});

			mockMoviesService.getMovieByTMDBId.mockResolvedValue(null);

			mockFetch.mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						id: 123,
						title: "Test Movie",
					}),
			});

			mockMoviesService.upsertMovie.mockResolvedValue({ movieId: "123" });

			mockPrismaService.movieListItem.upsert.mockResolvedValue({});

			await service.indexListItemRecord(
				"at://did:plc:abc123/app.opnshelf.listItem/testtid123",
				"cid123",
				"testtid123",
				"did:plc:abc123",
				{
					$type: "app.opnshelf.listItem",
					listRkey: "watchlist-abc123",
					movieId: "123",
					createdAt: "2024-01-01T00:00:00.000Z",
				},
			);

			expect(mockMoviesService.upsertMovie).toHaveBeenCalled();
		});
	});

	describe("deleteListItemRecord", () => {
		it("should delete a list item record by rkey", async () => {
			mockPrismaService.movieListItem.deleteMany.mockResolvedValue({
				count: 1,
			});

			await service.deleteListItemRecord("testtid123");

			expect(mockPrismaService.movieListItem.deleteMany).toHaveBeenCalledWith({
				where: { rkey: "testtid123" },
			});
		});
	});
});
