import { ConfigService } from "@nestjs/config";
import type { AuthService } from "../auth/auth.service";
import type { MoviesService } from "../movies/movies.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { ShowsService } from "../shows/shows.service";
import { ImportHistoryService } from "./import-history.service";

describe("ImportHistoryService", () => {
	let service: ImportHistoryService;

	function buildTraktImportJob(overrides: Record<string, unknown> = {}) {
		const {
			traktUsername = "alice",
			currentPage = 1,
			totalPages = null,
			sourceCount = 0,
			normalizedCount = 0,
			importedCount = 0,
			skippedCount = 0,
			failedCount = 0,
			profileUsername = "alice",
			profileSlug = "alice",
			profileName = "Alice Example",
			profileAvatarUrl = "https://example.com/avatar.jpg",
			...rest
		} = overrides;
		return {
			id: "job-1",
			type: "trakt_import",
			userDid: "did:plc:abc",
			status: "queued",
			data: {
				traktUsername,
				currentPage,
				totalPages,
				sourceCount,
				normalizedCount,
				importedCount,
				skippedCount,
				failedCount,
				profileUsername,
				profileSlug,
				profileName,
				profileAvatarUrl,
			},
			nextRunAt: new Date("2026-03-23T18:00:00.000Z"),
			lastError: null,
			startedAt: null,
			completedAt: null,
			createdAt: new Date("2026-03-23T18:00:00.000Z"),
			updatedAt: new Date("2026-03-23T18:00:00.000Z"),
			...rest,
		};
	}

	const prisma = {
		trackedMovie: {
			findFirst: jest.fn(),
		},
		trackedEpisode: {
			findFirst: jest.fn(),
		},
		authSession: {
			findUnique: jest.fn(),
		},
		backgroundJob: {
			findFirst: jest.fn(),
			findUnique: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
		},
	} as unknown as PrismaService;

	const moviesService = {
		markWatched: jest.fn(),
		indexTrackedMovie: jest.fn(),
	} as unknown as MoviesService;

	const showsService = {
		markEpisodeWatched: jest.fn(),
		indexTrackedEpisode: jest.fn(),
	} as unknown as ShowsService;

	const configService = {
		get: jest.fn((key: string) => {
			if (key === "TRAKT_API_KEY") return "trakt-key";
			return undefined;
		}),
	} as unknown as ConfigService;

	const authService = {
		restore: jest.fn(),
	} as unknown as AuthService;

	beforeEach(() => {
		jest.clearAllMocks();
		service = new ImportHistoryService(
			prisma,
			moviesService,
			showsService,
			configService,
			authService,
		);
		global.fetch = jest.fn() as unknown as typeof fetch;
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("starts a new background Trakt import with preview data", async () => {
		prisma.backgroundJob.findFirst = jest.fn().mockResolvedValue(null);
		prisma.backgroundJob.create = jest
			.fn()
			.mockResolvedValue(buildTraktImportJob());

		(global.fetch as jest.Mock)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						username: "alice",
						name: "Alice Example",
						private: false,
						vip: false,
						ids: { slug: "alice" },
						images: { avatar: { full: "https://example.com/avatar.jpg" } },
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify([
						{
							type: "movie",
							action: "watch",
							watched_at: "2026-03-22T12:00:00.000Z",
							movie: {
								title: "Arrival",
								year: 2016,
								ids: { tmdb: 329865 },
							},
						},
					]),
					{
						status: 200,
						headers: {
							"x-pagination-page-count": "3",
						},
					},
				),
			);

		await expect(
			service.startTraktImport("did:plc:abc", "alice"),
		).resolves.toMatchObject({
			profile: {
				username: "alice",
				name: "Alice Example",
			},
			sourcePreviewCount: 1,
			job: {
				id: "job-1",
				status: "queued",
			},
		});
		expect(prisma.backgroundJob.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					type: "trakt_import",
					userDid: "did:plc:abc",
					data: expect.objectContaining({
						traktUsername: "alice",
						profileUsername: "alice",
					}),
				}),
			}),
		);
	});

	it("reuses an existing active Trakt import job", async () => {
		prisma.backgroundJob.findFirst = jest.fn().mockResolvedValue(
			buildTraktImportJob({
				status: "running",
				currentPage: 2,
				totalPages: 5,
				sourceCount: 100,
				normalizedCount: 80,
				importedCount: 75,
				skippedCount: 5,
				startedAt: new Date("2026-03-23T18:00:00.000Z"),
				updatedAt: new Date("2026-03-23T18:01:00.000Z"),
			}),
		);

		(global.fetch as jest.Mock)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						username: "alice",
						name: "Alice Example",
						private: false,
						vip: false,
						ids: { slug: "alice" },
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

		await expect(
			service.startTraktImport("did:plc:abc", "different-user"),
		).resolves.toMatchObject({
			job: {
				id: "job-1",
				status: "running",
			},
		});
		expect(prisma.backgroundJob.create).not.toHaveBeenCalled();
	});

	it("moves a job to waiting_retry when Trakt returns 429", async () => {
		const job = buildTraktImportJob({ profileAvatarUrl: null });
		prisma.backgroundJob.findFirst = jest.fn().mockResolvedValue(job);
		prisma.backgroundJob.findUnique = jest.fn().mockResolvedValue(job);
		prisma.backgroundJob.update = jest.fn().mockResolvedValue(job);
		(authService.restore as jest.Mock).mockResolvedValue({
			did: "did:plc:abc",
		});

		(global.fetch as jest.Mock).mockResolvedValue(
			new Response(JSON.stringify({}), {
				status: 429,
				headers: {
					"retry-after": "42",
				},
			}),
		);

		await service.processNextTraktImportJob();

		expect(prisma.backgroundJob.update).toHaveBeenLastCalledWith(
			expect.objectContaining({
				where: { id: "job-1" },
				data: expect.objectContaining({
					status: "waiting_retry",
					lastError: expect.stringContaining("42 seconds"),
				}),
			}),
		);
	});

	it("processes a Trakt job page and marks the job completed", async () => {
		const job = buildTraktImportJob({ profileAvatarUrl: null });
		prisma.backgroundJob.findFirst = jest.fn().mockResolvedValue(job);
		prisma.backgroundJob.findUnique = jest.fn().mockResolvedValue(job);
		prisma.backgroundJob.update = jest.fn().mockResolvedValue(job);
		(authService.restore as jest.Mock).mockResolvedValue({
			did: "did:plc:abc",
		});
		prisma.trackedMovie.findFirst = jest.fn().mockResolvedValue(null);
		(moviesService.markWatched as jest.Mock).mockResolvedValue({
			uri: "at://did:plc:abc/xyz.opnshelf.movie/1",
			cid: "cid-1",
			rkey: "1",
		});
		(moviesService.indexTrackedMovie as jest.Mock).mockResolvedValue(undefined);

		(global.fetch as jest.Mock).mockResolvedValue(
			new Response(
				JSON.stringify([
					{
						type: "movie",
						action: "watch",
						watched_at: "2026-03-22T12:00:00.000Z",
						movie: {
							title: "Arrival",
							year: 2016,
							ids: { tmdb: 329865 },
						},
					},
				]),
				{
					status: 200,
					headers: {
						"x-pagination-page-count": "1",
					},
				},
			),
		);

		await service.processNextTraktImportJob();

		expect(moviesService.markWatched).toHaveBeenCalledWith(
			"did:plc:abc",
			{ did: "did:plc:abc" },
			"329865",
			"2026-03-22T12:00:00.000Z",
		);
		expect(prisma.backgroundJob.update).toHaveBeenLastCalledWith(
			expect.objectContaining({
				where: { id: "job-1" },
				data: expect.objectContaining({
					status: "completed",
					data: expect.objectContaining({
						importedCount: 1,
						normalizedCount: 1,
						sourceCount: 1,
					}),
					lastError: null,
				}),
			}),
		);
	});

	it("keeps a Trakt job running when Trakt reports more pages after a short page", async () => {
		const job = buildTraktImportJob({ profileAvatarUrl: null });
		prisma.backgroundJob.findFirst = jest.fn().mockResolvedValue(job);
		prisma.backgroundJob.findUnique = jest.fn().mockResolvedValue(job);
		prisma.backgroundJob.update = jest.fn().mockResolvedValue(job);
		(authService.restore as jest.Mock).mockResolvedValue({
			did: "did:plc:abc",
		});
		prisma.trackedMovie.findFirst = jest.fn().mockResolvedValue(null);
		(moviesService.markWatched as jest.Mock).mockResolvedValue({
			uri: "at://did:plc:abc/xyz.opnshelf.movie/1",
			cid: "cid-1",
			rkey: "1",
		});
		(moviesService.indexTrackedMovie as jest.Mock).mockResolvedValue(undefined);

		const payload = Array.from({ length: 99 }, (_, index) => ({
			type: "movie",
			action: "watch",
			watched_at: new Date(Date.UTC(2026, 2, 22, 12, 0, index)).toISOString(),
			movie: {
				title: `Movie ${index + 1}`,
				year: 2016,
				ids: { tmdb: 329865 + index },
			},
		}));

		(global.fetch as jest.Mock).mockResolvedValue(
			new Response(JSON.stringify(payload), {
				status: 200,
				headers: {
					"x-pagination-page-count": "61",
				},
			}),
		);

		await service.processNextTraktImportJob();

		expect(prisma.backgroundJob.update).toHaveBeenLastCalledWith(
			expect.objectContaining({
				where: { id: "job-1" },
				data: expect.objectContaining({
					status: "running",
					data: expect.objectContaining({
						currentPage: 2,
						totalPages: 61,
						importedCount: 99,
						normalizedCount: 99,
						sourceCount: 99,
					}),
					completedAt: null,
				}),
			}),
		);
	});

	it("prefers the newest active job over recent terminal jobs", async () => {
		prisma.backgroundJob.findFirst = jest.fn().mockResolvedValue(
			buildTraktImportJob({
				status: "running",
				currentPage: 3,
				totalPages: 4,
				importedCount: 42,
				updatedAt: new Date("2026-03-23T21:07:10.000Z"),
			}),
		);

		await expect(
			service.getCurrentTraktImport("did:plc:abc"),
		).resolves.toMatchObject({
			id: "job-1",
			status: "running",
			importedCount: 42,
		});

		expect(prisma.backgroundJob.findFirst).toHaveBeenCalledTimes(1);
		expect(prisma.backgroundJob.findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					userDid: "did:plc:abc",
					status: { in: ["queued", "running", "waiting_retry"] },
				}),
				orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
			}),
		);
	});

	it("returns the newest recent terminal job using terminal-aware ordering", async () => {
		prisma.backgroundJob.findFirst = jest
			.fn()
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(
				buildTraktImportJob({
					status: "completed",
					importedCount: 199,
					completedAt: new Date("2026-03-23T21:07:40.324Z"),
					updatedAt: new Date("2026-03-23T21:07:40.324Z"),
				}),
			);

		await expect(
			service.getCurrentTraktImport("did:plc:abc"),
		).resolves.toMatchObject({
			id: "job-1",
			status: "completed",
			importedCount: 199,
		});

		expect(prisma.backgroundJob.findFirst).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				where: expect.objectContaining({
					userDid: "did:plc:abc",
					status: { in: ["completed", "failed"] },
					updatedAt: expect.objectContaining({
						gte: expect.any(Date),
					}),
				}),
				orderBy: [
					{ completedAt: "desc" },
					{ updatedAt: "desc" },
					{ createdAt: "desc" },
				],
			}),
		);
	});

	it("keeps completed jobs completed when they include item-level failures", async () => {
		prisma.backgroundJob.findFirst = jest
			.fn()
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(
				buildTraktImportJob({
					status: "completed",
					importedCount: 150,
					failedCount: 3,
					lastError: null,
					completedAt: new Date("2026-03-23T21:07:40.324Z"),
					updatedAt: new Date("2026-03-23T21:07:40.324Z"),
				}),
			);

		await expect(service.getCurrentTraktImport("did:plc:abc")).resolves.toEqual(
			expect.objectContaining({
				id: "job-1",
				status: "completed",
				importedCount: 150,
				failedCount: 3,
				lastError: undefined,
			}),
		);
	});

	it("treats duplicate tracked movie races as skipped without exposing prisma errors", async () => {
		prisma.trackedMovie.findFirst = jest.fn().mockResolvedValue(null);
		(moviesService.markWatched as jest.Mock).mockResolvedValue({
			uri: "at://did:plc:abc/xyz.opnshelf.movie/1",
			cid: "cid-1",
			rkey: "1",
		});
		(moviesService.indexTrackedMovie as jest.Mock).mockRejectedValue(
			new Error("Unique constraint failed on the fields: (`rkey`)"),
		);

		const warnSpy = jest.spyOn(
			(service as unknown as { logger: { warn: (message: string) => void } })
				.logger,
			"warn",
		);

		const result = await service.importNormalizedItems(
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
		prisma.trackedEpisode.findFirst = jest.fn().mockResolvedValue(null);
		(showsService.markEpisodeWatched as jest.Mock).mockResolvedValue({
			uri: "at://did:plc:abc/xyz.opnshelf.episode/1",
			cid: "cid-1",
			rkey: "1",
		});
		(showsService.indexTrackedEpisode as jest.Mock).mockRejectedValue(
			new Error("Unique constraint failed on the fields: (`rkey`)"),
		);

		const result = await service.importNormalizedItems(
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
		prisma.trackedMovie.findFirst = jest.fn().mockResolvedValue(null);
		(moviesService.markWatched as jest.Mock).mockResolvedValue({
			uri: "at://did:plc:abc/xyz.opnshelf.movie/1",
			cid: "cid-1",
			rkey: "1",
		});
		(moviesService.indexTrackedMovie as jest.Mock).mockRejectedValue(
			new Error("database exploded in production"),
		);

		const result = await service.importNormalizedItems(
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
		prisma.trackedMovie.findFirst = jest.fn().mockResolvedValue(null);
		(moviesService.markWatched as jest.Mock).mockResolvedValue({
			uri: "at://did:plc:abc/xyz.opnshelf.movie/1",
			cid: "cid-1",
			rkey: "1",
		});
		(moviesService.indexTrackedMovie as jest.Mock).mockRejectedValue(
			new Error("TMDB movie details request failed"),
		);

		const result = await service.importNormalizedItems(
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
