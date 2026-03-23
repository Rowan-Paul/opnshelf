import { ConfigService } from "@nestjs/config";
import type { AuthService } from "../auth/auth.service";
import type { MoviesService } from "../movies/movies.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { ShowsService } from "../shows/shows.service";
import { ImportHistoryService } from "./import-history.service";

describe("ImportHistoryService", () => {
	let service: ImportHistoryService;

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
		traktImportJob: {
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
		prisma.traktImportJob.findFirst = jest.fn().mockResolvedValue(null);
		prisma.traktImportJob.create = jest.fn().mockResolvedValue({
			id: "job-1",
			traktUsername: "alice",
			status: "queued",
			currentPage: 1,
			totalPages: null,
			sourceCount: 0,
			normalizedCount: 0,
			importedCount: 0,
			skippedCount: 0,
			failedCount: 0,
			nextRunAt: new Date("2026-03-23T18:00:00.000Z"),
			lastError: null,
			profileUsername: "alice",
			profileSlug: "alice",
			profileName: "Alice Example",
			profileAvatarUrl: "https://example.com/avatar.jpg",
			startedAt: null,
			completedAt: null,
			createdAt: new Date("2026-03-23T18:00:00.000Z"),
			updatedAt: new Date("2026-03-23T18:00:00.000Z"),
		});

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
		expect(prisma.traktImportJob.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					userDid: "did:plc:abc",
					traktUsername: "alice",
					profileUsername: "alice",
				}),
			}),
		);
	});

	it("reuses an existing active Trakt import job", async () => {
		prisma.traktImportJob.findFirst = jest.fn().mockResolvedValue({
			id: "job-1",
			traktUsername: "alice",
			status: "running",
			currentPage: 2,
			totalPages: 5,
			sourceCount: 100,
			normalizedCount: 80,
			importedCount: 75,
			skippedCount: 5,
			failedCount: 0,
			nextRunAt: new Date("2026-03-23T18:00:00.000Z"),
			lastError: null,
			profileUsername: "alice",
			profileSlug: "alice",
			profileName: "Alice Example",
			profileAvatarUrl: "https://example.com/avatar.jpg",
			startedAt: new Date("2026-03-23T18:00:00.000Z"),
			completedAt: null,
			createdAt: new Date("2026-03-23T18:00:00.000Z"),
			updatedAt: new Date("2026-03-23T18:01:00.000Z"),
		});

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
		expect(prisma.traktImportJob.create).not.toHaveBeenCalled();
	});

	it("moves a job to waiting_retry when Trakt returns 429", async () => {
		const job = {
			id: "job-1",
			userDid: "did:plc:abc",
			traktUsername: "alice",
			status: "queued",
			currentPage: 1,
			totalPages: null,
			sourceCount: 0,
			normalizedCount: 0,
			importedCount: 0,
			skippedCount: 0,
			failedCount: 0,
			nextRunAt: new Date("2026-03-23T18:00:00.000Z"),
			lastError: null,
			profileUsername: "alice",
			profileSlug: "alice",
			profileName: "Alice Example",
			profileAvatarUrl: null,
			startedAt: null,
			completedAt: null,
			createdAt: new Date("2026-03-23T18:00:00.000Z"),
			updatedAt: new Date("2026-03-23T18:00:00.000Z"),
		};
		prisma.traktImportJob.findFirst = jest.fn().mockResolvedValue(job);
		prisma.traktImportJob.findUnique = jest.fn().mockResolvedValue(job);
		prisma.traktImportJob.update = jest.fn().mockResolvedValue(job);
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

		expect(prisma.traktImportJob.update).toHaveBeenLastCalledWith(
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
		const job = {
			id: "job-1",
			userDid: "did:plc:abc",
			traktUsername: "alice",
			status: "queued",
			currentPage: 1,
			totalPages: null,
			sourceCount: 0,
			normalizedCount: 0,
			importedCount: 0,
			skippedCount: 0,
			failedCount: 0,
			nextRunAt: new Date("2026-03-23T18:00:00.000Z"),
			lastError: null,
			profileUsername: "alice",
			profileSlug: "alice",
			profileName: "Alice Example",
			profileAvatarUrl: null,
			startedAt: null,
			completedAt: null,
			createdAt: new Date("2026-03-23T18:00:00.000Z"),
			updatedAt: new Date("2026-03-23T18:00:00.000Z"),
		};
		prisma.traktImportJob.findFirst = jest.fn().mockResolvedValue(job);
		prisma.traktImportJob.findUnique = jest.fn().mockResolvedValue(job);
		prisma.traktImportJob.update = jest.fn().mockResolvedValue(job);
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
		expect(prisma.traktImportJob.update).toHaveBeenLastCalledWith(
			expect.objectContaining({
				where: { id: "job-1" },
				data: expect.objectContaining({
					status: "completed",
					importedCount: 1,
					normalizedCount: 1,
					sourceCount: 1,
				}),
			}),
		);
	});
});
