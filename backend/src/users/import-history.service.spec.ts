import type { Mock } from "vitest";
import { Agent } from "@atproto/api";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "../generated/client";
import type { AuthService } from "../auth/auth.service";
import type { MoviesService } from "../movies/movies.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { ShowsService } from "../shows/shows.service";
import { ImportHistoryService } from "./import-history.service";
import { TraktImportJobStore } from "./import/trakt-import-job.store";
import { TraktImportWorker } from "./import/trakt-import-worker.service";
import { WatchImportWriter } from "./import/watch-import-writer.service";
import { TraktApiClient } from "./trakt-api.client";

vi.mock("@atproto/api");

describe("ImportHistoryService", () => {
	let service: ImportHistoryService;
	let traktApi: TraktApiClient;
	let jobStore: TraktImportJobStore;
	let writer: WatchImportWriter;
	let worker: TraktImportWorker;

	function deferred<T>() {
		let resolve!: (value: T) => void;
		let reject!: (reason?: unknown) => void;
		const promise = new Promise<T>((resolvePromise, rejectPromise) => {
			resolve = resolvePromise;
			reject = rejectPromise;
		});
		return { promise, resolve, reject };
	}

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
			findFirst: vi.fn(),
		},
		trackedEpisode: {
			findFirst: vi.fn(),
		},
		authSession: {
			findUnique: vi.fn(),
		},
		backgroundJob: {
			findFirst: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			updateMany: vi.fn(),
		},
		traktImportItem: {
			upsert: vi.fn(),
			update: vi.fn(),
			updateMany: vi.fn(),
			findFirst: vi.fn(),
			findMany: vi.fn(),
			count: vi.fn(),
		},
		traktImportMatch: {
			upsert: vi.fn(),
		},
	} as unknown as PrismaService;

	const moviesService = {
		buildMovieWatchRecord: vi.fn(),
		markWatched: vi.fn(),
		indexTrackedMovie: vi.fn(),
	} as unknown as MoviesService;

	const showsService = {
		buildEpisodeWatchRecord: vi.fn(),
		markEpisodeWatched: vi.fn(),
		indexTrackedEpisode: vi.fn(),
	} as unknown as ShowsService;

	const configService = {
		get: vi.fn((key: string) => {
			if (key === "TRAKT_API_KEY") return "trakt-key";
			return undefined;
		}),
	} as unknown as ConfigService;

	const authService = {
		restore: vi.fn(),
	} as unknown as AuthService;

	beforeEach(() => {
		vi.clearAllMocks();
		traktApi = new TraktApiClient(configService);
		jobStore = new TraktImportJobStore(prisma);
		writer = new WatchImportWriter(
			prisma,
			moviesService,
			showsService,
			authService,
		);
		worker = new TraktImportWorker(prisma, traktApi, jobStore, writer);
		service = new ImportHistoryService(
			prisma,
			moviesService,
			showsService,
			traktApi,
			jobStore,
			writer,
			worker,
		);
		global.fetch = vi.fn() as unknown as typeof fetch;
		prisma.traktImportItem.upsert = vi.fn().mockResolvedValue({});
		prisma.traktImportItem.update = vi.fn().mockResolvedValue({});
		prisma.traktImportItem.updateMany = vi.fn().mockResolvedValue({ count: 0 });
		prisma.traktImportItem.findFirst = vi.fn().mockResolvedValue(null);
		prisma.traktImportItem.findMany = vi.fn().mockResolvedValue([]);
		prisma.traktImportItem.count = vi.fn().mockResolvedValue(0);
		prisma.traktImportMatch.upsert = vi.fn().mockResolvedValue({});
		prisma.backgroundJob.updateMany = vi.fn().mockResolvedValue({ count: 1 });

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

	it("starts a new background Trakt import with preview data", async () => {
		prisma.backgroundJob.findFirst = vi.fn().mockResolvedValue(null);
		prisma.backgroundJob.create = vi
			.fn()
			.mockResolvedValue(buildTraktImportJob());

		(global.fetch as Mock)
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

	it("reuses the fixed import job without refreshing its Trakt snapshot", async () => {
		prisma.backgroundJob.findFirst = vi.fn().mockResolvedValue(
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

		(global.fetch as Mock)
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
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it("returns one authoritative job when concurrent starts race", async () => {
		const winner = buildTraktImportJob({
			id: "job-winner",
			traktUsername: "alice",
			profileUsername: "alice",
			profileSlug: "alice",
			profileName: "Alice Winner",
			profileAvatarUrl: "https://example.com/alice.jpg",
		});
		const winnerVisible = deferred<void>();
		let lookupCount = 0;
		prisma.backgroundJob.findFirst = vi.fn().mockImplementation(async () => {
			lookupCount += 1;
			if (lookupCount <= 2) return null;
			await winnerVisible.promise;
			return winner;
		});

		vi.spyOn(traktApi, "fetchPreview").mockImplementation(async (username) => ({
			profile: {
				username,
				slug: username,
				name: username === "alice" ? "Alice Winner" : "Bob Loser",
				avatarUrl: `https://example.com/${username}.jpg`,
				isPrivate: false,
				isVip: false,
			},
			previewItems: [],
			sourcePreviewCount: 1,
		}));

		let createCount = 0;
		let successfulCreateCount = 0;
		prisma.backgroundJob.create = vi.fn().mockImplementation(async () => {
			createCount += 1;
			if (createCount === 1) {
				successfulCreateCount += 1;
				winnerVisible.resolve();
				return winner;
			}
			throw new Prisma.PrismaClientKnownRequestError("duplicate Trakt import", {
				code: "P2002",
				clientVersion: "test",
			});
		});

		const [first, second] = await Promise.all([
			service.startTraktImport("did:plc:abc", "alice"),
			service.startTraktImport("did:plc:abc", "bob"),
		]);

		expect(first.job.id).toBe("job-winner");
		expect(second.job.id).toBe("job-winner");
		expect(first.profile).toMatchObject({
			username: "alice",
			name: "Alice Winner",
		});
		expect(second.profile).toMatchObject({
			username: "alice",
			name: "Alice Winner",
		});
		expect(second.profile.username).not.toBe("bob");
		expect(prisma.backgroundJob.create).toHaveBeenCalledTimes(2);
		expect(
			(prisma.backgroundJob.create as Mock).mock.calls[1][0],
		).toMatchObject({
			data: {
				userDid: "did:plc:abc",
				data: {
					traktUsername: "bob",
					profileUsername: "bob",
					profileName: "Bob Loser",
				},
			},
		});
		expect(successfulCreateCount).toBe(1);
	});

	it("propagates an unrelated create failure", async () => {
		const failure = new Error("database unavailable");
		prisma.backgroundJob.findFirst = vi.fn().mockResolvedValue(null);
		vi.spyOn(traktApi, "fetchPreview").mockResolvedValue({
			profile: {
				username: "alice",
				slug: "alice",
				name: "Alice",
				avatarUrl: undefined,
				isPrivate: false,
				isVip: false,
			},
			previewItems: [],
			sourcePreviewCount: 0,
		});
		prisma.backgroundJob.create = vi.fn().mockRejectedValue(failure);

		await expect(service.startTraktImport("did:plc:abc", "alice")).rejects.toBe(
			failure,
		);
	});

	it("rethrows the unique error when no winning job is visible", async () => {
		const uniqueFailure = new Prisma.PrismaClientKnownRequestError(
			"duplicate Trakt import",
			{ code: "P2002", clientVersion: "test" },
		);
		prisma.backgroundJob.findFirst = vi.fn().mockResolvedValue(null);
		vi.spyOn(traktApi, "fetchPreview").mockResolvedValue({
			profile: {
				username: "alice",
				slug: "alice",
				name: "Alice",
				avatarUrl: undefined,
				isPrivate: false,
				isVip: false,
			},
			previewItems: [],
			sourcePreviewCount: 0,
		});
		prisma.backgroundJob.create = vi.fn().mockRejectedValue(uniqueFailure);

		await expect(service.startTraktImport("did:plc:abc", "alice")).rejects.toBe(
			uniqueFailure,
		);
		expect(prisma.backgroundJob.findFirst).toHaveBeenCalledTimes(2);
	});

	it.each([
		["pause", "queued", "running", "paused"],
		["resume", "paused", "failed", "queued"],
	] as const)(
		"retries a conflicting %s control with the newest version predicate",
		async (action, firstStatus, secondStatus, expectedStatus) => {
			const firstAt = new Date("2026-03-23T18:00:00.000Z");
			const secondAt = new Date("2026-03-23T18:00:01.000Z");
			const first = buildTraktImportJob({
				status: firstStatus,
				updatedAt: firstAt,
			});
			const second = buildTraktImportJob({
				status: secondStatus,
				updatedAt: secondAt,
			});
			prisma.backgroundJob.findFirst = vi.fn().mockResolvedValue(first);
			prisma.backgroundJob.findUnique = vi
				.fn()
				.mockResolvedValueOnce(first)
				.mockResolvedValueOnce(second);
			prisma.backgroundJob.updateMany = vi
				.fn()
				.mockResolvedValueOnce({ count: 0 })
				.mockResolvedValueOnce({ count: 1 });

			if (action === "pause") {
				await service.pauseTraktImport("did:plc:abc");
			} else {
				await service.resumeTraktImport("did:plc:abc");
			}

			expect(prisma.backgroundJob.updateMany).toHaveBeenCalledTimes(2);
			expect(
				(prisma.backgroundJob.updateMany as Mock).mock.calls[0][0],
			).toMatchObject({
				where: { id: "job-1", updatedAt: firstAt, status: firstStatus },
			});
			expect(
				(prisma.backgroundJob.updateMany as Mock).mock.calls[1][0],
			).toMatchObject({
				where: { id: "job-1", updatedAt: secondAt, status: secondStatus },
				data: { status: expectedStatus },
			});
		},
	);

	it("returns the newest durable import job", async () => {
		prisma.backgroundJob.findFirst = vi.fn().mockResolvedValue(
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
				}),
				orderBy: [{ createdAt: "desc" }],
			}),
		);
	});

	it("returns a terminal job without a retention cutoff", async () => {
		prisma.backgroundJob.findFirst = vi.fn().mockResolvedValue(
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

		expect(prisma.backgroundJob.findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					userDid: "did:plc:abc",
				}),
				orderBy: [{ createdAt: "desc" }],
			}),
		);
	});

	it("keeps completed jobs completed when they include item-level failures", async () => {
		prisma.backgroundJob.findFirst = vi.fn().mockResolvedValue(
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

	it("delegates worker ticks to the Trakt import worker and job store", async () => {
		const reap = vi.spyOn(jobStore, "reapStaleRunningJobs").mockResolvedValue();
		const process = vi
			.spyOn(worker, "processNextTraktImportJob")
			.mockResolvedValue();

		await service.reapStaleRunningJobs();
		await service.processNextTraktImportJob();

		expect(reap).toHaveBeenCalledOnce();
		expect(process).toHaveBeenCalledOnce();
	});

	it("delegates importNormalizedItems to the Watch writer unchanged", async () => {
		const result = { imported: 1, skipped: 0, failed: 0, errors: [] };
		const write = vi
			.spyOn(writer, "importNormalizedItems")
			.mockResolvedValue(result);
		const items = [
			{
				type: "movie" as const,
				movieTmdbId: 329865,
				watchedAt: "2026-03-22T12:00:00.000Z",
				action: "watch" as const,
			},
		];
		const onRateLimit = vi.fn();

		await expect(
			service.importNormalizedItems(
				"did:plc:abc",
				{ did: "did:plc:abc" },
				items,
				{ onRateLimit },
			),
		).resolves.toBe(result);
		expect(write).toHaveBeenCalledWith(
			"did:plc:abc",
			{ did: "did:plc:abc" },
			items,
			{ onRateLimit },
		);
	});
});
