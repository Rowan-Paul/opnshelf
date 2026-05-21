import { Test, type TestingModule } from "@nestjs/testing";

jest.mock("../prisma/prisma.service", () => ({
	PrismaService: jest.fn(),
}));

const mockPutRecord = jest.fn();
const mockDeleteRecord = jest.fn();
const mockListRecords = jest.fn();
jest.mock("@atproto/api", () => ({
	Agent: jest.fn().mockImplementation(() => ({
		com: {
			atproto: {
				repo: {
					putRecord: mockPutRecord,
					deleteRecord: mockDeleteRecord,
					listRecords: mockListRecords,
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

jest.mock("../lexicons/xyz/opnshelf/list", () => ({
	main: {
		build: jest.fn((data: Record<string, unknown>) => ({
			$type: "xyz.opnshelf.list",
			...data,
		})),
		parse: jest.fn((data: Record<string, unknown>) => data),
	},
	$nsid: "xyz.opnshelf.list",
}));

jest.mock("../lexicons/xyz/opnshelf/list/item", () => ({
	main: {
		build: jest.fn((data: Record<string, unknown>) => ({
			$type: "xyz.opnshelf.list.item",
			...data,
		})),
	},
	$nsid: "xyz.opnshelf.list.item",
}));

import { MoviesService } from "../movies/movies.service";
import { PrismaService } from "../prisma/prisma.service";
import { ShowsService } from "../shows/shows.service";
import { ListsService } from "./lists.service";

describe("ListsService", () => {
	let service: ListsService;

	const mockPrismaService = {
		list: {
			findMany: jest.fn(),
			findFirst: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn(),
			upsert: jest.fn(),
		},
		listItem: {
			findMany: jest.fn(),
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
		mockListRecords.mockReset();

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

	describe("provisionDefaultLists", () => {
		it("indexes repo-backed default lists before creating missing defaults", async () => {
			mockPrismaService.list.findMany
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([
					{
						id: "list-watchlist",
						rkey: "watchlist-rkey",
						uri: "at://did:plc:abc123/xyz.opnshelf.list/watchlist-rkey",
						cid: "cid-watchlist",
						userDid: "did:plc:abc123",
						name: "Watchlist",
						description: "Items you want to watch",
						slug: "watchlist",
						isDefault: true,
						createdAt: new Date("2024-01-01"),
						updatedAt: new Date("2024-01-01"),
					},
					{
						id: "list-favorites",
						rkey: "favorites-rkey",
						uri: "at://did:plc:abc123/xyz.opnshelf.list/favorites-rkey",
						cid: "cid-favorites",
						userDid: "did:plc:abc123",
						name: "Favorites",
						description: "Your favorite items",
						slug: "favorites",
						isDefault: true,
						createdAt: new Date("2024-01-02"),
						updatedAt: new Date("2024-01-02"),
					},
				]);
			mockListRecords.mockResolvedValue({
				data: {
					records: [
						{
							uri: "at://did:plc:abc123/xyz.opnshelf.list/favorites-rkey",
							cid: "cid-favorites",
							value: {
								name: "Favorites",
								description: "Your favorite items",
								slug: "favorites",
								isDefault: true,
								createdAt: "2024-01-02T00:00:00.000Z",
							},
						},
					],
				},
			});
			mockPrismaService.list.upsert.mockResolvedValue({
				id: "list-favorites",
				rkey: "favorites-rkey",
				uri: "at://did:plc:abc123/xyz.opnshelf.list/favorites-rkey",
				cid: "cid-favorites",
				userDid: "did:plc:abc123",
				name: "Favorites",
				description: "Your favorite items",
				slug: "favorites",
				isDefault: true,
				createdAt: new Date("2024-01-02"),
				updatedAt: new Date("2024-01-02"),
			});
			mockPutRecord.mockResolvedValue({
				data: {
					uri: "at://did:plc:abc123/xyz.opnshelf.list/watchlist-rkey",
					cid: "cid-watchlist",
				},
			});
			mockPrismaService.list.create.mockResolvedValue({
				id: "list-watchlist",
				rkey: "watchlist-rkey",
				uri: "at://did:plc:abc123/xyz.opnshelf.list/watchlist-rkey",
				cid: "cid-watchlist",
				userDid: "did:plc:abc123",
				name: "Watchlist",
				description: "Items you want to watch",
				slug: "watchlist",
				isDefault: true,
				createdAt: new Date("2024-01-01"),
				updatedAt: new Date("2024-01-01"),
			});

			const result = await service.provisionDefaultLists("did:plc:abc123", {
				did: "did:plc:abc123",
			});

			expect(mockListRecords).toHaveBeenCalledWith({
				repo: "did:plc:abc123",
				collection: "xyz.opnshelf.list",
				limit: 100,
				cursor: undefined,
			});
			expect(mockPrismaService.list.upsert).toHaveBeenCalledWith({
				where: { rkey: "favorites-rkey" },
				create: {
					rkey: "favorites-rkey",
					uri: "at://did:plc:abc123/xyz.opnshelf.list/favorites-rkey",
					cid: "cid-favorites",
					userDid: "did:plc:abc123",
					name: "Favorites",
					description: "Your favorite items",
					slug: "favorites",
					isDefault: true,
				},
				update: {
					uri: "at://did:plc:abc123/xyz.opnshelf.list/favorites-rkey",
					cid: "cid-favorites",
					name: "Favorites",
					description: "Your favorite items",
					slug: "favorites",
					isDefault: true,
				},
			});
			expect(mockPutRecord).toHaveBeenCalledTimes(1);
			expect(mockPutRecord).toHaveBeenCalledWith(
				expect.objectContaining({
					collection: "xyz.opnshelf.list",
					record: expect.objectContaining({
						slug: "watchlist",
					}),
				}),
			);
			expect(result.map((list) => list.slug)).toEqual([
				"watchlist",
				"favorites",
			]);
		});

		it("does not create duplicates when both default lists already exist locally", async () => {
			mockPrismaService.list.findMany.mockResolvedValue([
				{
					id: "list-watchlist",
					rkey: "watchlist-rkey",
					uri: "at://did:plc:abc123/xyz.opnshelf.list/watchlist-rkey",
					cid: "cid-watchlist",
					userDid: "did:plc:abc123",
					name: "Watchlist",
					description: "Items you want to watch",
					slug: "watchlist",
					isDefault: true,
					createdAt: new Date("2024-01-01"),
					updatedAt: new Date("2024-01-01"),
				},
				{
					id: "list-favorites",
					rkey: "favorites-rkey",
					uri: "at://did:plc:abc123/xyz.opnshelf.list/favorites-rkey",
					cid: "cid-favorites",
					userDid: "did:plc:abc123",
					name: "Favorites",
					description: "Your favorite items",
					slug: "favorites",
					isDefault: true,
					createdAt: new Date("2024-01-02"),
					updatedAt: new Date("2024-01-02"),
				},
			]);

			const result = await service.provisionDefaultLists("did:plc:abc123", {
				did: "did:plc:abc123",
			});

			expect(mockListRecords).not.toHaveBeenCalled();
			expect(mockPutRecord).not.toHaveBeenCalled();
			expect(result.map((list) => list.slug)).toEqual([
				"watchlist",
				"favorites",
			]);
		});
	});

	describe("getUserLists", () => {
		it("should return lists with item counts", async () => {
			mockPrismaService.list.findMany.mockResolvedValue([
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

			expect(result[0].itemCount).toBe(5);
			expect(mockPrismaService.list.findMany).toHaveBeenCalledWith({
				where: { userDid: "did:plc:abc123" },
				orderBy: [{ isDefault: "desc" }, { name: "asc" }],
				include: { _count: { select: { items: true } } },
			});
		});

		it("should expose public list summaries via the same ordering", async () => {
			mockPrismaService.list.findMany.mockResolvedValue([
				{
					id: "list-1",
					rkey: "favorites",
					name: "Favorites",
					description: "Best of the best",
					slug: "favorites",
					isDefault: true,
					_count: { items: 2 },
					createdAt: new Date("2024-01-01"),
					updatedAt: new Date("2024-01-02"),
				},
			]);

			await expect(
				service.getPublicUserLists("did:plc:public123"),
			).resolves.toMatchObject([
				{
					slug: "favorites",
					itemCount: 2,
				},
			]);
		});

		it("should expose public list details for a user's slug", async () => {
			mockPrismaService.list.findFirst.mockResolvedValue({
				id: "list-1",
				rkey: "favorites",
				uri: "at://did:plc:public123/xyz.opnshelf.list/favorites",
				userDid: "did:plc:public123",
				name: "Favorites",
				description: "Best of the best",
				slug: "favorites",
				isDefault: true,
				createdAt: new Date("2024-01-01"),
				updatedAt: new Date("2024-01-02"),
				_count: { items: 0 },
			});

			await expect(
				service.getPublicList("did:plc:public123", "favorites"),
			).resolves.toMatchObject({
				slug: "favorites",
				userDid: "did:plc:public123",
			});
			expect(mockPrismaService.list.findFirst).toHaveBeenCalledWith({
				where: { userDid: "did:plc:public123", slug: "favorites" },
				include: {
					_count: {
						select: { items: true },
					},
				},
			});
		});
	});

	describe("getListsForItem", () => {
		it("should return list membership for a movie", async () => {
			mockPrismaService.list.findMany.mockResolvedValue([
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

	describe("getList", () => {
		it("should return all items when pagination is not requested", async () => {
			mockPrismaService.list.findFirst.mockResolvedValue({
				id: "list-1",
				rkey: "favorites",
				uri: "at://did:plc:abc123/xyz.opnshelf.list/favorites",
				userDid: "did:plc:abc123",
				name: "Favorites",
				description: "Best of the best",
				slug: "favorites",
				isDefault: true,
				createdAt: new Date("2024-01-01"),
				updatedAt: new Date("2024-01-02"),
				_count: { items: 2 },
			});
			mockPrismaService.listItem.findMany.mockResolvedValue([
				{
					id: "item-1",
					rkey: "item-1",
					mediaType: "movie",
					mediaId: "123",
					notes: null,
					position: 0,
					createdAt: new Date("2024-01-03"),
					movie: {
						movieId: "123",
						title: "Movie One",
						posterPath: "/one.jpg",
						backdropPath: null,
						releaseYear: 2024,
						releaseDate: new Date("2024-01-01"),
						overview: null,
						colors: null,
					},
					show: null,
				},
				{
					id: "item-2",
					rkey: "item-2",
					mediaType: "movie",
					mediaId: "456",
					notes: null,
					position: 1,
					createdAt: new Date("2024-01-02"),
					movie: {
						movieId: "456",
						title: "Movie Two",
						posterPath: "/two.jpg",
						backdropPath: null,
						releaseYear: 2023,
						releaseDate: new Date("2023-01-01"),
						overview: null,
						colors: null,
					},
					show: null,
				},
			]);

			const result = await service.getList("did:plc:abc123", "favorites");

			expect(result).toMatchObject({
				slug: "favorites",
				total: 2,
				page: 1,
				pageSize: 2,
				totalPages: 1,
				hasPreviousPage: false,
				hasNextPage: false,
			});
			expect(result?.items).toHaveLength(2);
			expect(mockPrismaService.listItem.findMany).toHaveBeenCalledWith({
				where: { listId: "list-1" },
				orderBy: { createdAt: "desc" },
				include: {
					movie: true,
					show: true,
				},
			});
		});

		it("should clamp paginated requests to the last available page", async () => {
			mockPrismaService.list.findFirst.mockResolvedValue({
				id: "list-1",
				rkey: "watchlist",
				uri: "at://did:plc:abc123/xyz.opnshelf.list/watchlist",
				userDid: "did:plc:abc123",
				name: "Watchlist",
				description: "Things to watch",
				slug: "watchlist",
				isDefault: true,
				createdAt: new Date("2024-01-01"),
				updatedAt: new Date("2024-01-02"),
				_count: { items: 5 },
			});
			mockPrismaService.listItem.findMany.mockResolvedValue([
				{
					id: "item-5",
					rkey: "item-5",
					mediaType: "movie",
					mediaId: "999",
					notes: null,
					position: 4,
					createdAt: new Date("2024-01-01"),
					movie: {
						movieId: "999",
						title: "Last Movie",
						posterPath: "/last.jpg",
						backdropPath: null,
						releaseYear: 2022,
						releaseDate: new Date("2022-01-01"),
						overview: null,
						colors: null,
					},
					show: null,
				},
			]);

			const result = await service.getList("did:plc:abc123", "watchlist", 9, 2);

			expect(result).toMatchObject({
				total: 5,
				page: 3,
				pageSize: 2,
				totalPages: 3,
				hasPreviousPage: true,
				hasNextPage: false,
			});
			expect(mockPrismaService.listItem.findMany).toHaveBeenCalledWith({
				where: { listId: "list-1" },
				orderBy: { createdAt: "desc" },
				include: {
					movie: true,
					show: true,
				},
				skip: 4,
				take: 2,
			});
		});
	});

	describe("addToList", () => {
		it("should add a movie to a list", async () => {
			mockPrismaService.list.findFirst.mockResolvedValue({
				id: "list-1",
				rkey: "watchlist-abc123",
			});
			mockPrismaService.listItem.findUnique.mockResolvedValue(null);
			mockMoviesService.getMovieDetails.mockResolvedValue({ id: 123 });
			mockMoviesService.upsertMovie.mockResolvedValue({ movieId: "123" });
			mockPrismaService.listItem.count.mockResolvedValue(0);
			mockPutRecord.mockResolvedValue({
				data: {
					uri: "at://did:plc:abc123/xyz.opnshelf.list.item/testtid123",
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
			mockPrismaService.list.findFirst.mockResolvedValue({
				id: "list-1",
				rkey: "favorites-abc123",
			});
			mockPrismaService.listItem.findUnique.mockResolvedValue(null);
			mockShowsService.getShowDetails.mockResolvedValue({ id: 456 });
			mockShowsService.upsertShow.mockResolvedValue({ showId: "456" });
			mockPrismaService.listItem.count.mockResolvedValue(1);
			mockPutRecord.mockResolvedValue({
				data: {
					uri: "at://did:plc:abc123/xyz.opnshelf.list.item/testtid123",
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
			mockPrismaService.list.findFirst.mockResolvedValue({
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
				collection: "xyz.opnshelf.list.item",
				rkey: "item-abc",
			});
			expect(mockPrismaService.listItem.delete).toHaveBeenCalledWith({
				where: { id: "item-1" },
			});
		});
	});

	describe("indexListItemRecord", () => {
		it("should index a movie list item record", async () => {
			mockPrismaService.list.findFirst.mockResolvedValue({ id: "list-1" });
			mockMoviesService.getMovieByTMDBId.mockResolvedValue({ movieId: "123" });

			await service.indexListItemRecord(
				"at://did:plc:abc123/xyz.opnshelf.list.item/testtid123",
				"cid123",
				"testtid123",
				"did:plc:abc123",
				{
					$type: "xyz.opnshelf.list.item",
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
			mockPrismaService.list.findFirst.mockResolvedValue({ id: "list-1" });
			mockShowsService.getShowByTMDBId.mockResolvedValue({ showId: "456" });

			await service.indexListItemRecord(
				"at://did:plc:abc123/xyz.opnshelf.list.item/testtid123",
				"cid123",
				"testtid123",
				"did:plc:abc123",
				{
					$type: "xyz.opnshelf.list.item",
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
