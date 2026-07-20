import { Test, type TestingModule } from "@nestjs/testing";
import { Logger } from "@nestjs/common";

vi.mock("../prisma/prisma.service", () => ({
	PrismaService: vi.fn(),
}));

const mockPutRecord = vi.fn();
const mockDeleteRecord = vi.fn();
vi.mock("@atproto/api", () => ({
	Agent: vi.fn().mockImplementation(() => ({
		com: {
			atproto: {
				repo: { putRecord: mockPutRecord, deleteRecord: mockDeleteRecord },
			},
		},
	})),
}));

vi.mock("@atproto/common", () => ({
	TID: { nextStr: vi.fn(() => "testtid123") },
}));

vi.mock("../lexicons/xyz/opnshelf/library/item", () => ({
	main: {
		build: vi.fn((data: Record<string, unknown>) => ({
			$type: "xyz.opnshelf.library.item",
			...data,
		})),
	},
	$nsid: "xyz.opnshelf.library.item",
}));

import { MoviesService } from "../movies/movies.service";
import { PrismaService } from "../prisma/prisma.service";
import { ShowsService } from "../shows/shows.service";
import { TmdbNotFoundError, TmdbServiceError } from "../tmdb/tmdb-http";
import { LibraryService } from "./library.service";

const session = { did: "did:plc:abc123" };
const movieRow = {
	movieId: "603",
	title: "The Matrix",
	posterPath: null,
	backdropPath: null,
	releaseYear: 1999,
	releaseDate: null,
	overview: null,
	colors: null,
};

function libraryRow(format: string) {
	return {
		id: `item-${format}`,
		rkey: `rkey-${format}`,
		uri: `at://did/xyz.opnshelf.library.item/rkey-${format}`,
		cid: "cid",
		mediaType: "movie" as const,
		mediaId: "603",
		format,
		seasonNumber: 0,
		episodeNumber: 0,
		boxSet: null,
		notes: null,
		createdAt: new Date("2024-01-01"),
		movie: movieRow,
		show: null,
	};
}

describe("LibraryService", () => {
	let service: LibraryService;

	const mockPrisma = {
		libraryItem: {
			findMany: vi.fn(),
			findFirst: vi.fn(),
			create: vi.fn(),
			delete: vi.fn(),
			deleteMany: vi.fn(),
			upsert: vi.fn(),
		},
		episode: { findMany: vi.fn() },
	};
	const mockMovies = {
		getMovieDetails: vi.fn(),
		upsertMovie: vi.fn(),
		getMovieByTMDBId: vi.fn(),
	};
	const mockShows = {
		getShowDetails: vi.fn(),
		upsertShow: vi.fn(),
		getShowByTMDBId: vi.fn(),
	};

	beforeEach(async () => {
		vi.clearAllMocks();
		mockPutRecord.mockReset().mockResolvedValue({
			data: { uri: "at://did/xyz.opnshelf.library.item/testtid123", cid: "c" },
		});
		mockDeleteRecord.mockReset();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				LibraryService,
				{ provide: PrismaService, useValue: mockPrisma },
				{ provide: MoviesService, useValue: mockMovies },
				{ provide: ShowsService, useValue: mockShows },
			],
		}).compile();

		service = module.get<LibraryService>(LibraryService);
	});

	it("is idempotent: adding an already-owned format writes no record", async () => {
		mockPrisma.libraryItem.findFirst.mockResolvedValue(libraryRow("bluray"));

		const result = await service.addToLibrary(session.did, session, {
			mediaType: "movie",
			mediaId: "603",
			format: "bluray",
		});

		expect(result.format).toBe("bluray");
		expect(mockPutRecord).not.toHaveBeenCalled();
		expect(mockPrisma.libraryItem.create).not.toHaveBeenCalled();
	});

	it("treats a different format as a distinct copy (writes a new row)", async () => {
		// No existing bluray4k copy, even though a bluray copy exists.
		mockPrisma.libraryItem.findFirst.mockResolvedValue(null);
		mockMovies.getMovieDetails.mockResolvedValue(movieRow);
		mockPrisma.libraryItem.create.mockResolvedValue(libraryRow("bluray4k"));

		await service.addToLibrary(session.did, session, {
			mediaType: "movie",
			mediaId: "603",
			format: "bluray4k",
			boxSet: "Matrix Collection",
		});

		expect(mockPutRecord).toHaveBeenCalledTimes(1);
		const record = mockPutRecord.mock.calls[0][0].record;
		expect(record.format).toBe("bluray4k");
		expect(record.boxSet).toBe("Matrix Collection");
		const created = mockPrisma.libraryItem.create.mock.calls[0][0].data;
		expect(created.format).toBe("bluray4k");
		expect(created.movieId).toBe("603");
	});

	it("removes only the targeted format", async () => {
		mockPrisma.libraryItem.findFirst.mockResolvedValue(libraryRow("dvd"));

		await service.removeFromLibrary(
			session.did,
			session,
			"movie",
			"603",
			"dvd",
		);

		// Scoped the lookup by format, and deleted exactly that row.
		expect(mockPrisma.libraryItem.findFirst.mock.calls[0][0].where.format).toBe(
			"dvd",
		);
		expect(mockDeleteRecord).toHaveBeenCalledTimes(1);
		expect(mockPrisma.libraryItem.delete).toHaveBeenCalledWith({
			where: { id: "item-dvd" },
		});
	});

	it.each(["movie", "show"] as const)(
		"rethrows transient TMDB failures while indexing a %s",
		async (mediaType) => {
			const isMovie = mediaType === "movie";
			const details = isMovie
				? mockMovies.getMovieDetails
				: mockShows.getShowDetails;
			const upsert = isMovie ? mockMovies.upsertMovie : mockShows.upsertShow;
			const existing = isMovie
				? mockMovies.getMovieByTMDBId
				: mockShows.getShowByTMDBId;
			const outage = new TmdbServiceError("TMDB unavailable");
			existing.mockResolvedValue(null);
			details.mockRejectedValue(outage);

			await expect(
				service.indexLibraryItemRecord(
					"at://did:plc:abc123/xyz.opnshelf.library.item/item-1",
					"cid-1",
					"item-1",
					"did:plc:abc123",
					{
						$type: "xyz.opnshelf.library.item",
						mediaType,
						mediaId: "123",
						format: "digital",
						createdAt: "2024-01-01T00:00:00.000Z",
					},
				),
			).rejects.toBe(outage);

			expect(upsert).not.toHaveBeenCalled();
			expect(mockPrisma.libraryItem.upsert).not.toHaveBeenCalled();
		},
	);

	it.each(["movie", "show"] as const)(
		"drops a permanently missing TMDB %s while indexing",
		async (mediaType) => {
			const isMovie = mediaType === "movie";
			const details = isMovie
				? mockMovies.getMovieDetails
				: mockShows.getShowDetails;
			const upsert = isMovie ? mockMovies.upsertMovie : mockShows.upsertShow;
			const existing = isMovie
				? mockMovies.getMovieByTMDBId
				: mockShows.getShowByTMDBId;
			const errorSpy = vi.spyOn(Logger.prototype, "error");
			existing.mockResolvedValue(null);
			details.mockRejectedValue(new TmdbNotFoundError("Not found", 404));

			await expect(
				service.indexLibraryItemRecord(
					"at://did:plc:abc123/xyz.opnshelf.library.item/item-1",
					"cid-1",
					"item-1",
					"did:plc:abc123",
					{
						$type: "xyz.opnshelf.library.item",
						mediaType,
						mediaId: "123",
						format: "digital",
						createdAt: "2024-01-01T00:00:00.000Z",
					},
				),
			).resolves.toBeUndefined();

			expect(errorSpy).toHaveBeenCalledWith(
				expect.stringContaining("skipping library item"),
				expect.any(TmdbNotFoundError),
			);
			expect(upsert).not.toHaveBeenCalled();
			expect(mockPrisma.libraryItem.upsert).not.toHaveBeenCalled();
			errorSpy.mockRestore();
		},
	);
});
