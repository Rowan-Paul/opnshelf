import type { Mock } from "vitest";
import { Agent } from "@atproto/api";
import type { AuthService } from "../../auth/auth.service";
import type { MoviesService } from "../../movies/movies.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { ShowsService } from "../../shows/shows.service";
import { WatchImportWriter } from "./watch-import-writer.service";

vi.mock("@atproto/api");

describe("WatchImportWriter", () => {
	let writer: WatchImportWriter;

	const prisma = {
		trackedMovie: {
			findFirst: vi.fn(),
		},
		trackedEpisode: {
			findFirst: vi.fn(),
		},
	} as unknown as PrismaService;

	const moviesService = {
		buildMovieWatchRecord: vi.fn(),
		indexTrackedMovie: vi.fn(),
	} as unknown as MoviesService;

	const showsService = {
		buildEpisodeWatchRecord: vi.fn(),
		indexTrackedEpisode: vi.fn(),
	} as unknown as ShowsService;

	const authService = {
		restore: vi.fn(),
	} as unknown as AuthService;

	beforeEach(() => {
		vi.clearAllMocks();
		writer = new WatchImportWriter(
			prisma,
			moviesService,
			showsService,
			authService,
		);

		(moviesService.buildMovieWatchRecord as Mock).mockReturnValue({
			rkey: "rkey-movie-1",
			record: {},
			collection: "xyz.opnshelf.movie",
		});
		(showsService.buildEpisodeWatchRecord as Mock).mockReturnValue({
			rkey: "rkey-episode-1",
			record: {},
			collection: "xyz.opnshelf.episode",
		});
		(Agent as unknown as Mock).mockImplementation(() => ({
			com: {
				atproto: {
					repo: {
						applyWrites: vi.fn().mockResolvedValue({ data: {} }),
					},
				},
			},
		}));
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("treats duplicate tracked movie races as skipped without exposing prisma errors", async () => {
		prisma.trackedMovie.findFirst = vi.fn().mockResolvedValue(null);
		(moviesService.indexTrackedMovie as Mock).mockRejectedValue(
			new Error("Unique constraint failed on the fields: (`rkey`)"),
		);

		const warnSpy = vi.spyOn(
			(writer as unknown as { logger: { warn: (message: string) => void } })
				.logger,
			"warn",
		);

		const result = await writer.importNormalizedItems(
			"did:plc:abc",
			{ did: "did:plc:abc" },
			[
				{
					type: "movie",
					movieTmdbId: 329865,
					watchedAt: "2026-03-22T12:00:00.000Z",
					action: "watch",
				},
			],
		);

		expect(result).toEqual({
			imported: 0,
			skipped: 1,
			failed: 0,
			errors: [],
		});
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("Unique constraint failed on the fields"),
		);
	});

	it("treats duplicate tracked episode races as skipped without exposing prisma errors", async () => {
		prisma.trackedEpisode.findFirst = vi.fn().mockResolvedValue(null);
		(showsService.indexTrackedEpisode as Mock).mockRejectedValue(
			new Error("Unique constraint failed on the fields: (`rkey`)"),
		);

		const result = await writer.importNormalizedItems(
			"did:plc:abc",
			{ did: "did:plc:abc" },
			[
				{
					type: "episode",
					showTmdbId: 1399,
					seasonNumber: 1,
					episodeNumber: 1,
					watchedAt: "2026-03-22T12:00:00.000Z",
					action: "watch",
				},
			],
		);

		expect(result).toEqual({
			imported: 0,
			skipped: 1,
			failed: 0,
			errors: [],
		});
	});

	it("returns sanitized unknown write failures", async () => {
		prisma.trackedMovie.findFirst = vi.fn().mockResolvedValue(null);
		(moviesService.indexTrackedMovie as Mock).mockRejectedValue(
			new Error("database exploded in production"),
		);

		const result = await writer.importNormalizedItems(
			"did:plc:abc",
			{ did: "did:plc:abc" },
			[
				{
					type: "movie",
					movieTmdbId: 329865,
					watchedAt: "2026-03-22T12:00:00.000Z",
					action: "watch",
				},
			],
		);

		expect(result).toEqual({
			imported: 0,
			skipped: 0,
			failed: 1,
			errors: [
				{
					index: 1,
					code: "write_failed",
					reason: "unknown",
					message: "We couldn't import this item.",
				},
			],
		});
		expect(JSON.stringify(result.errors)).not.toContain("database exploded");
	});

	it("returns sanitized metadata failures", async () => {
		prisma.trackedMovie.findFirst = vi.fn().mockResolvedValue(null);
		(moviesService.indexTrackedMovie as Mock).mockRejectedValue(
			new Error("TMDB movie details request failed"),
		);

		const result = await writer.importNormalizedItems(
			"did:plc:abc",
			{ did: "did:plc:abc" },
			[
				{
					type: "movie",
					movieTmdbId: 329865,
					watchedAt: "2026-03-22T12:00:00.000Z",
					action: "watch",
				},
			],
		);

		expect(result.errors).toEqual([
			{
				index: 1,
				code: "write_failed",
				reason: "metadata_unavailable",
				message: "We couldn't fetch details for this title right now.",
			},
		]);
	});
});
