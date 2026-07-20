import { Test, type TestingModule } from "@nestjs/testing";
import { Logger } from "@nestjs/common";

vi.mock("../prisma/prisma.service", () => ({
	PrismaService: vi.fn(),
}));

const mockPutRecord = vi.fn();
const mockDeleteRecord = vi.fn();
const mockListRecords = vi.fn();
vi.mock("@atproto/api", () => ({
	Agent: vi.fn().mockImplementation(() => ({
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

vi.mock("@atproto/common", () => ({
	TID: {
		nextStr: vi.fn(() => "testtid123"),
	},
}));

vi.mock("../lexicons/xyz/opnshelf/list", () => ({
	main: {
		build: vi.fn((data: Record<string, unknown>) => ({
			$type: "xyz.opnshelf.list",
			...data,
		})),
		parse: vi.fn((data: Record<string, unknown>) => data),
	},
	$nsid: "xyz.opnshelf.list",
}));

vi.mock("../lexicons/xyz/opnshelf/list/item", () => ({
	main: {
		build: vi.fn((data: Record<string, unknown>) => ({
			$type: "xyz.opnshelf.list.item",
			...data,
		})),
	},
	$nsid: "xyz.opnshelf.list.item",
}));

import { MoviesService } from "../movies/movies.service";
import { PrismaService } from "../prisma/prisma.service";
import { ShowsService } from "../shows/shows.service";
import { TmdbNotFoundError, TmdbServiceError } from "../tmdb/tmdb-http";
import { ListsService } from "./lists.service";

describe("ListsService", () => {
	let service: ListsService;

	const mockPrismaService = {
		list: {
			findMany: vi.fn(),
			findFirst: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
			deleteMany: vi.fn(),
			upsert: vi.fn(),
		},
		listItem: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
			deleteMany: vi.fn(),
			upsert: vi.fn(),
			count: vi.fn(),
		},
		trackedMovie: {
			findMany: vi.fn(),
		},
		trackedEpisode: {
			findMany: vi.fn(),
		},
		episode: {
			findMany: vi.fn(),
		},
		// $transaction receives an array of prepared prisma promises; resolve them.
		$transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
	};

	const mockMoviesService = {
		getMovieDetails: vi.fn(),
		upsertMovie: vi.fn(),
		getMovieByTMDBId: vi.fn(),
	};

	const mockShowsService = {
		getShowDetails: vi.fn(),
		upsertShow: vi.fn(),
		getShowByTMDBId: vi.fn(),
	};

	beforeEach(async () => {
		vi.clearAllMocks();
		mockPutRecord.mockReset();
		mockDeleteRecord.mockReset();
		mockListRecords.mockReset();

		// Default: viewer has watched nothing and there are no episode names to
		// resolve. Individual tests override where needed.
		mockPrismaService.trackedMovie.findMany.mockResolvedValue([]);
		mockPrismaService.trackedEpisode.findMany.mockResolvedValue([]);
		mockPrismaService.episode.findMany.mockResolvedValue([]);
		mockPrismaService.$transaction.mockImplementation((ops: unknown[]) =>
			Promise.all(ops),
		);

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
				where: {
					userDid_rkey: {
						userDid: "did:plc:abc123",
						rkey: "favorites-rkey",
					},
				},
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
				service.getPublicList("did:plc:public123", "favorites", null),
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

			const result = await service.getList("did:plc:abc123", "favorites", null);

			expect(result).toMatchObject({
				slug: "favorites",
				total: 2,
				watchedCount: 0,
				page: 1,
				pageSize: 2,
				totalPages: 1,
				hasPreviousPage: false,
				hasNextPage: false,
			});
			expect(result?.items).toHaveLength(2);
			expect(result?.items[0].watched).toBe(false);
			// Default sort is now `position` (insertion/manual order) with a
			// deterministic createdAt tiebreak.
			expect(mockPrismaService.listItem.findMany).toHaveBeenCalledWith({
				where: { listId: "list-1" },
				orderBy: [{ position: "asc" }, { createdAt: "asc" }],
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

			const result = await service.getList(
				"did:plc:abc123",
				"watchlist",
				null,
				9,
				2,
			);

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
				orderBy: [{ position: "asc" }, { createdAt: "asc" }],
				include: {
					movie: true,
					show: true,
				},
				skip: 4,
				take: 2,
			});
		});

		it("uses createdAt desc for the `added` sort", async () => {
			mockPrismaService.list.findFirst.mockResolvedValue({
				id: "list-1",
				rkey: "favorites",
				uri: "at://did:plc:abc123/xyz.opnshelf.list/favorites",
				userDid: "did:plc:abc123",
				name: "Favorites",
				description: null,
				slug: "favorites",
				isDefault: true,
				createdAt: new Date("2024-01-01"),
				updatedAt: new Date("2024-01-02"),
				_count: { items: 1 },
			});
			mockPrismaService.listItem.findMany.mockResolvedValue([
				{
					id: "item-1",
					rkey: "item-1",
					mediaType: "movie",
					mediaId: "123",
					seasonNumber: 0,
					episodeNumber: 0,
					notes: null,
					position: 0,
					createdAt: new Date("2024-01-03"),
					movie: {
						movieId: "123",
						title: "Movie",
						posterPath: null,
						backdropPath: null,
						releaseYear: 2024,
						releaseDate: null,
						overview: null,
						colors: null,
					},
					show: null,
				},
			]);

			await service.getList(
				"did:plc:abc123",
				"favorites",
				null,
				1,
				20,
				"added",
			);

			expect(mockPrismaService.listItem.findMany).toHaveBeenCalledWith({
				where: { listId: "list-1" },
				orderBy: [{ createdAt: "desc" }],
				include: { movie: true, show: true },
				skip: 0,
				take: 20,
			});
		});

		it("sorts by title in memory across mixed movie/show items", async () => {
			mockPrismaService.list.findFirst.mockResolvedValue({
				id: "list-1",
				rkey: "mixed",
				uri: "at://did:plc:abc123/xyz.opnshelf.list/mixed",
				userDid: "did:plc:abc123",
				name: "Mixed",
				description: null,
				slug: "mixed",
				isDefault: false,
				createdAt: new Date("2024-01-01"),
				updatedAt: new Date("2024-01-02"),
				_count: { items: 3 },
			});
			// Returned in arbitrary DB order; the service must sort A-Z by title.
			mockPrismaService.listItem.findMany.mockResolvedValue([
				{
					id: "item-b",
					rkey: "item-b",
					mediaType: "show",
					mediaId: "20",
					seasonNumber: 0,
					episodeNumber: 0,
					notes: null,
					position: 2,
					createdAt: new Date("2024-01-03"),
					movie: null,
					show: {
						showId: "20",
						title: "Better Call Saul",
						posterPath: null,
						backdropPath: null,
						firstAirYear: 2015,
						firstAirDate: null,
						overview: null,
						colors: null,
					},
				},
				{
					id: "item-a",
					rkey: "item-a",
					mediaType: "movie",
					mediaId: "10",
					seasonNumber: 0,
					episodeNumber: 0,
					notes: null,
					position: 0,
					createdAt: new Date("2024-01-01"),
					movie: {
						movieId: "10",
						title: "Amelie",
						posterPath: null,
						backdropPath: null,
						releaseYear: 2001,
						releaseDate: null,
						overview: null,
						colors: null,
					},
					show: null,
				},
				{
					id: "item-c",
					rkey: "item-c",
					mediaType: "movie",
					mediaId: "30",
					seasonNumber: 0,
					episodeNumber: 0,
					notes: null,
					position: 1,
					createdAt: new Date("2024-01-02"),
					movie: {
						movieId: "30",
						title: "Casablanca",
						posterPath: null,
						backdropPath: null,
						releaseYear: 1942,
						releaseDate: null,
						overview: null,
						colors: null,
					},
					show: null,
				},
			]);

			const result = await service.getList(
				"did:plc:abc123",
				"mixed",
				null,
				undefined,
				undefined,
				"title",
			);

			expect(result?.items.map((i) => i.media.title)).toEqual([
				"Amelie",
				"Better Call Saul",
				"Casablanca",
			]);
			// title/year sort fetches the whole list (no orderBy/skip/take).
			expect(mockPrismaService.listItem.findMany).toHaveBeenCalledWith({
				where: { listId: "list-1" },
				include: { movie: true, show: true },
			});
		});

		it("sorts by year ascending with nulls last", async () => {
			mockPrismaService.list.findFirst.mockResolvedValue({
				id: "list-1",
				rkey: "mixed",
				uri: "at://did:plc:abc123/xyz.opnshelf.list/mixed",
				userDid: "did:plc:abc123",
				name: "Mixed",
				description: null,
				slug: "mixed",
				isDefault: false,
				createdAt: new Date("2024-01-01"),
				updatedAt: new Date("2024-01-02"),
				_count: { items: 3 },
			});
			mockPrismaService.listItem.findMany.mockResolvedValue([
				{
					id: "item-noyear",
					rkey: "item-noyear",
					mediaType: "movie",
					mediaId: "10",
					seasonNumber: 0,
					episodeNumber: 0,
					notes: null,
					position: 0,
					createdAt: new Date("2024-01-01"),
					movie: {
						movieId: "10",
						title: "Undated",
						posterPath: null,
						backdropPath: null,
						releaseYear: null,
						releaseDate: null,
						overview: null,
						colors: null,
					},
					show: null,
				},
				{
					id: "item-2015",
					rkey: "item-2015",
					mediaType: "show",
					mediaId: "20",
					seasonNumber: 0,
					episodeNumber: 0,
					notes: null,
					position: 1,
					createdAt: new Date("2024-01-02"),
					movie: null,
					show: {
						showId: "20",
						title: "Newer Show",
						posterPath: null,
						backdropPath: null,
						firstAirYear: 2015,
						firstAirDate: null,
						overview: null,
						colors: null,
					},
				},
				{
					id: "item-1990",
					rkey: "item-1990",
					mediaType: "movie",
					mediaId: "30",
					seasonNumber: 0,
					episodeNumber: 0,
					notes: null,
					position: 2,
					createdAt: new Date("2024-01-03"),
					movie: {
						movieId: "30",
						title: "Older Movie",
						posterPath: null,
						backdropPath: null,
						releaseYear: 1990,
						releaseDate: null,
						overview: null,
						colors: null,
					},
					show: null,
				},
			]);

			const result = await service.getList(
				"did:plc:abc123",
				"mixed",
				null,
				undefined,
				undefined,
				"year",
			);

			expect(result?.items.map((i) => i.media.releaseYear)).toEqual([
				1990,
				2015,
				undefined,
			]);
		});

		it("marks items watched relative to the viewer and counts them list-wide", async () => {
			mockPrismaService.list.findFirst.mockResolvedValue({
				id: "list-1",
				rkey: "watchlist",
				uri: "at://did:plc:abc123/xyz.opnshelf.list/watchlist",
				userDid: "did:plc:abc123",
				name: "Watchlist",
				description: null,
				slug: "watchlist",
				isDefault: true,
				createdAt: new Date("2024-01-01"),
				updatedAt: new Date("2024-01-02"),
				_count: { items: 2 },
			});
			// buildWatchState scope fetch (select) + page fetch (include) both hit
			// listItem.findMany; return the same rows for either shape.
			const rows = [
				{
					id: "item-movie",
					rkey: "item-movie",
					mediaType: "movie",
					mediaId: "123",
					seasonNumber: 0,
					episodeNumber: 0,
					notes: null,
					position: 0,
					createdAt: new Date("2024-01-01"),
					movie: {
						movieId: "123",
						title: "Watched Movie",
						posterPath: null,
						backdropPath: null,
						releaseYear: 2024,
						releaseDate: null,
						overview: null,
						colors: null,
					},
					show: null,
				},
				{
					id: "item-show",
					rkey: "item-show",
					mediaType: "show",
					mediaId: "456",
					seasonNumber: 0,
					episodeNumber: 0,
					notes: null,
					position: 1,
					createdAt: new Date("2024-01-02"),
					movie: null,
					show: {
						showId: "456",
						title: "Unwatched Show",
						posterPath: null,
						backdropPath: null,
						firstAirYear: 2020,
						firstAirDate: null,
						overview: null,
						colors: null,
					},
				},
			];
			mockPrismaService.listItem.findMany.mockResolvedValue(rows);
			mockPrismaService.trackedMovie.findMany.mockResolvedValue([
				{ movieId: "123" },
			]);
			mockPrismaService.trackedEpisode.findMany.mockResolvedValue([]);

			const result = await service.getList(
				"did:plc:abc123",
				"watchlist",
				"did:plc:abc123",
			);

			expect(result?.watchedCount).toBe(1);
			const byId = new Map(result?.items.map((i) => [i.id, i.watched]));
			expect(byId.get("item-movie")).toBe(true);
			expect(byId.get("item-show")).toBe(false);
			expect(mockPrismaService.trackedMovie.findMany).toHaveBeenCalledWith({
				where: {
					userDid: "did:plc:abc123",
					status: "watched",
					movieId: { in: ["123"] },
				},
				select: { movieId: true },
			});
		});
	});

	describe("reorderListItems", () => {
		it("reassigns positions 0..n-1 in a transaction", async () => {
			mockPrismaService.list.findFirst.mockResolvedValue({ id: "list-1" });
			mockPrismaService.listItem.findMany.mockResolvedValue([
				{ id: "a" },
				{ id: "b" },
				{ id: "c" },
			]);
			mockPrismaService.listItem.update.mockImplementation(
				(args: unknown) => args,
			);

			await service.reorderListItems("did:plc:abc123", "watchlist", [
				"c",
				"a",
				"b",
			]);

			expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
			expect(mockPrismaService.listItem.update).toHaveBeenNthCalledWith(1, {
				where: { id: "c" },
				data: { position: 0 },
			});
			expect(mockPrismaService.listItem.update).toHaveBeenNthCalledWith(2, {
				where: { id: "a" },
				data: { position: 1 },
			});
			expect(mockPrismaService.listItem.update).toHaveBeenNthCalledWith(3, {
				where: { id: "b" },
				data: { position: 2 },
			});
		});

		it("throws NotFound when the list does not exist", async () => {
			mockPrismaService.list.findFirst.mockResolvedValue(null);

			await expect(
				service.reorderListItems("did:plc:abc123", "missing", ["a"]),
			).rejects.toThrow("List not found");
		});

		it("rejects when ids do not cover every list item", async () => {
			mockPrismaService.list.findFirst.mockResolvedValue({ id: "list-1" });
			mockPrismaService.listItem.findMany.mockResolvedValue([
				{ id: "a" },
				{ id: "b" },
			]);

			await expect(
				service.reorderListItems("did:plc:abc123", "watchlist", ["a"]),
			).rejects.toThrow("every item");
			expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
		});

		it("rejects ids that do not belong to the list", async () => {
			mockPrismaService.list.findFirst.mockResolvedValue({ id: "list-1" });
			mockPrismaService.listItem.findMany.mockResolvedValue([
				{ id: "a" },
				{ id: "b" },
			]);

			await expect(
				service.reorderListItems("did:plc:abc123", "watchlist", ["a", "z"]),
			).rejects.toThrow("does not belong");
			expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
		});

		it("rejects duplicate ids", async () => {
			mockPrismaService.list.findFirst.mockResolvedValue({ id: "list-1" });
			mockPrismaService.listItem.findMany.mockResolvedValue([
				{ id: "a" },
				{ id: "b" },
			]);

			await expect(
				service.reorderListItems("did:plc:abc123", "watchlist", ["a", "a"]),
			).rejects.toThrow("Duplicate");
			expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
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
					where: {
						userDid_rkey: {
							userDid: "did:plc:abc123",
							rkey: "testtid123",
						},
					},
					create: expect.objectContaining({
						userDid: "did:plc:abc123",
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

		it.each(["movie", "show"] as const)(
			"rethrows transient TMDB failures while indexing a %s",
			async (mediaType) => {
				const isMovie = mediaType === "movie";
				const details = isMovie
					? mockMoviesService.getMovieDetails
					: mockShowsService.getShowDetails;
				const upsert = isMovie
					? mockMoviesService.upsertMovie
					: mockShowsService.upsertShow;
				const existing = isMovie
					? mockMoviesService.getMovieByTMDBId
					: mockShowsService.getShowByTMDBId;
				const outage = new TmdbServiceError("TMDB unavailable");
				mockPrismaService.list.findFirst.mockResolvedValue({ id: "list-1" });
				existing.mockResolvedValue(null);
				details.mockRejectedValue(outage);

				await expect(
					service.indexListItemRecord(
						"at://did:plc:abc123/xyz.opnshelf.list.item/item-1",
						"cid-1",
						"item-1",
						"did:plc:abc123",
						{
							$type: "xyz.opnshelf.list.item",
							listRkey: "watchlist",
							mediaType,
							mediaId: "123",
							createdAt: "2024-01-01T00:00:00.000Z",
						},
					),
				).rejects.toBe(outage);

				expect(upsert).not.toHaveBeenCalled();
				expect(mockPrismaService.listItem.upsert).not.toHaveBeenCalled();
			},
		);

		it.each(["movie", "show"] as const)(
			"drops a permanently missing TMDB %s while indexing",
			async (mediaType) => {
				const isMovie = mediaType === "movie";
				const details = isMovie
					? mockMoviesService.getMovieDetails
					: mockShowsService.getShowDetails;
				const upsert = isMovie
					? mockMoviesService.upsertMovie
					: mockShowsService.upsertShow;
				const existing = isMovie
					? mockMoviesService.getMovieByTMDBId
					: mockShowsService.getShowByTMDBId;
				const errorSpy = vi.spyOn(Logger.prototype, "error");
				mockPrismaService.list.findFirst.mockResolvedValue({ id: "list-1" });
				existing.mockResolvedValue(null);
				details.mockRejectedValue(new TmdbNotFoundError("Not found", 404));

				await expect(
					service.indexListItemRecord(
						"at://did:plc:abc123/xyz.opnshelf.list.item/item-1",
						"cid-1",
						"item-1",
						"did:plc:abc123",
						{
							$type: "xyz.opnshelf.list.item",
							listRkey: "watchlist",
							mediaType,
							mediaId: "123",
							createdAt: "2024-01-01T00:00:00.000Z",
						},
					),
				).resolves.toBeUndefined();

				expect(errorSpy).toHaveBeenCalledWith(
					expect.stringContaining("skipping item"),
					expect.any(TmdbNotFoundError),
				);
				expect(upsert).not.toHaveBeenCalled();
				expect(mockPrismaService.listItem.upsert).not.toHaveBeenCalled();
				errorSpy.mockRestore();
			},
		);
	});

	describe("deleteListItemRecord", () => {
		it("should delete a list item record by rkey", async () => {
			mockPrismaService.listItem.deleteMany.mockResolvedValue({
				count: 1,
			});

			await service.deleteListItemRecord("did:plc:test", "testtid123");

			expect(mockPrismaService.listItem.deleteMany).toHaveBeenCalledWith({
				where: { userDid: "did:plc:test", rkey: "testtid123" },
			});
		});
	});
});
