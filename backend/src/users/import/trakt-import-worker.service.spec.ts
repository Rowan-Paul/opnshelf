import type { Mock } from "vitest";
import { Agent } from "@atproto/api";
import { ConfigService } from "@nestjs/config";
import { deterministicMovieWatchRkey } from "../../common/watch-rkey";
import type { AuthService } from "../../auth/auth.service";
import type { MoviesService } from "../../movies/movies.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { ShowsService } from "../../shows/shows.service";
import { TraktApiClient } from "../trakt-api.client";
import { TraktImportJobStore } from "./trakt-import-job.store";
import { TraktImportWorker } from "./trakt-import-worker.service";
import { WatchImportWriter } from "./watch-import-writer.service";

vi.mock("@atproto/api");

describe("TraktImportWorker", () => {
	let worker: TraktImportWorker;
	let traktApi: TraktApiClient;

	function deferred<T>() {
		let resolve!: (value: T) => void;
		let reject!: (reason?: unknown) => void;
		const promise = new Promise<T>((resolvePromise, rejectPromise) => {
			resolve = resolvePromise;
			reject = rejectPromise;
		});
		return { promise, resolve, reject };
	}

	function traktMoviePage(pageCount = 1) {
		return new Response(
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
				headers: { "x-pagination-page-count": String(pageCount) },
			},
		);
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
		const jobStore = new TraktImportJobStore(prisma);
		const writer = new WatchImportWriter(
			prisma,
			moviesService,
			showsService,
			authService,
		);
		worker = new TraktImportWorker(prisma, traktApi, jobStore, writer);
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

	it("moves a job to waiting_retry when Trakt returns 429", async () => {
		const job = buildTraktImportJob({ profileAvatarUrl: null });
		prisma.backgroundJob.findFirst = vi.fn().mockResolvedValue(job);
		prisma.backgroundJob.findUnique = vi.fn().mockResolvedValue(job);
		prisma.backgroundJob.update = vi.fn().mockResolvedValue(job);
		(authService.restore as Mock).mockResolvedValue({
			did: "did:plc:abc",
		});

		(global.fetch as Mock).mockResolvedValue(
			new Response(JSON.stringify({}), {
				status: 429,
				headers: {
					"retry-after": "42",
				},
			}),
		);

		await worker.processNextTraktImportJob();

		expect(prisma.backgroundJob.updateMany).toHaveBeenLastCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ id: "job-1" }),
				data: expect.objectContaining({
					status: "waiting_retry",
					// 60s backoff is humanized to "1 minute", not "60 seconds".
					lastError: expect.stringContaining("1 minute"),
					data: expect.objectContaining({
						rateLimitRetries: 1,
					}),
				}),
			}),
		);
	});

	it("waits out the PDS ratelimit-reset window instead of a fixed 60s", async () => {
		const job = buildTraktImportJob({ profileAvatarUrl: null });
		prisma.backgroundJob.findFirst = vi.fn().mockResolvedValue(job);
		prisma.backgroundJob.findUnique = vi.fn().mockResolvedValue(job);
		prisma.backgroundJob.update = vi.fn().mockResolvedValue(job);
		(authService.restore as Mock).mockResolvedValue({ did: "did:plc:abc" });
		prisma.trackedMovie.findFirst = vi.fn().mockResolvedValue(null);

		// The PDS repo-write budget is exhausted and refills ~30 min out. atproto
		// signals this via ratelimit-reset (an absolute epoch), NOT Retry-After.
		const resetEpoch = Math.floor(Date.now() / 1000) + 1800;
		(Agent as unknown as Mock).mockImplementation(() => ({
			com: {
				atproto: {
					repo: {
						applyWrites: vi.fn().mockRejectedValue(
							Object.assign(new Error("Rate Limit Exceeded"), {
								status: 429,
								headers: { "ratelimit-reset": String(resetEpoch) },
							}),
						),
					},
				},
			},
		}));

		(global.fetch as Mock).mockResolvedValue(
			new Response(
				JSON.stringify([
					{
						type: "movie",
						action: "watch",
						watched_at: "2026-03-22T12:00:00.000Z",
						movie: { title: "Arrival", year: 2016, ids: { tmdb: 329865 } },
					},
				]),
				{ status: 200, headers: { "x-pagination-page-count": "1" } },
			),
		);

		await worker.processNextTraktImportJob();

		const retryCall = (prisma.backgroundJob.updateMany as Mock).mock.calls.find(
			([arg]) => arg?.data?.status === "waiting_retry",
		);
		if (!retryCall) throw new Error("expected a waiting_retry update");
		const nextRunAt = retryCall[0].data.nextRunAt as Date;
		const delaySeconds = (nextRunAt.getTime() - Date.now()) / 1000;
		// ~30 min: honors the reset header, not the old 60s fallback or 300s cap.
		expect(delaySeconds).toBeGreaterThan(1700);
		expect(delaySeconds).toBeLessThanOrEqual(60 * 60);
		// And the user-facing message is humanized, not raw seconds.
		expect(retryCall[0].data.lastError).toMatch(/minute/);
		expect(retryCall[0].data.lastError).not.toMatch(/seconds/);
	});

	it("processes a Trakt job page and marks the job completed", async () => {
		const job = buildTraktImportJob({ profileAvatarUrl: null });
		prisma.backgroundJob.findFirst = vi.fn().mockResolvedValue(job);
		prisma.backgroundJob.findUnique = vi.fn().mockResolvedValue(job);
		prisma.backgroundJob.update = vi.fn().mockResolvedValue(job);
		(authService.restore as Mock).mockResolvedValue({
			did: "did:plc:abc",
		});
		prisma.trackedMovie.findFirst = vi.fn().mockResolvedValue(null);
		(moviesService.indexTrackedMovie as Mock).mockResolvedValue(undefined);

		(global.fetch as Mock).mockResolvedValue(
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

		await worker.processNextTraktImportJob();

		// The import passes a deterministic rkey so a re-run is an idempotent
		// overwrite rather than a duplicate Watch.
		expect(moviesService.buildMovieWatchRecord).toHaveBeenCalledWith(
			"329865",
			"2026-03-22T12:00:00.000Z",
			deterministicMovieWatchRkey("329865", "2026-03-22T12:00:00.000Z"),
		);
		expect(prisma.backgroundJob.updateMany).toHaveBeenLastCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ id: "job-1" }),
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

	it("retains a valid Trakt title without a TMDB id as unmatched", async () => {
		const job = buildTraktImportJob({ profileAvatarUrl: null });
		prisma.backgroundJob.findFirst = vi.fn().mockResolvedValue(job);
		prisma.backgroundJob.findUnique = vi.fn().mockResolvedValue(job);
		prisma.backgroundJob.update = vi.fn().mockResolvedValue(job);
		(authService.restore as Mock).mockResolvedValue({ did: "did:plc:abc" });

		(global.fetch as Mock).mockResolvedValue(
			new Response(
				JSON.stringify([
					{
						type: "movie",
						action: "watch",
						watched_at: "2026-03-22T12:00:00.000Z",
						movie: {
							title: "The Lord of the Rings: Extended Edition",
							year: 2001,
							ids: { trakt: 123, slug: "lotr-extended" },
						},
					},
				]),
				{ status: 200, headers: { "x-pagination-page-count": "1" } },
			),
		);

		await worker.processNextTraktImportJob();

		expect(prisma.traktImportItem.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				create: expect.objectContaining({
					outcome: "unmatched",
					traktMediaKey: "movie:123",
					title: "The Lord of the Rings: Extended Edition",
				}),
			}),
		);
		expect(moviesService.buildMovieWatchRecord).not.toHaveBeenCalled();
		expect(prisma.backgroundJob.updateMany).toHaveBeenLastCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					status: "completed",
					data: expect.objectContaining({
						unmatchedCount: 1,
						failedCount: 0,
					}),
				}),
			}),
		);
	});

	it("keeps a Trakt job running when Trakt reports more pages after a short page", async () => {
		const job = buildTraktImportJob({ profileAvatarUrl: null });
		prisma.backgroundJob.findFirst = vi.fn().mockResolvedValue(job);
		prisma.backgroundJob.findUnique = vi.fn().mockResolvedValue(job);
		prisma.backgroundJob.update = vi.fn().mockResolvedValue(job);
		(authService.restore as Mock).mockResolvedValue({
			did: "did:plc:abc",
		});
		prisma.trackedMovie.findFirst = vi.fn().mockResolvedValue(null);
		(moviesService.indexTrackedMovie as Mock).mockResolvedValue(undefined);

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

		(global.fetch as Mock).mockResolvedValue(
			new Response(JSON.stringify(payload), {
				status: 200,
				headers: {
					"x-pagination-page-count": "61",
				},
			}),
		);

		await worker.processNextTraktImportJob();

		expect(prisma.backgroundJob.updateMany).toHaveBeenLastCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ id: "job-1" }),
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

	it("pauses the import to leave PDS write headroom when the budget runs low", async () => {
		// Multi-page job so the run isn't "complete" after page 1 — only then does
		// the pacing decision apply.
		const job = buildTraktImportJob({ profileAvatarUrl: null });
		prisma.backgroundJob.findFirst = vi.fn().mockResolvedValue(job);
		prisma.backgroundJob.findUnique = vi.fn().mockResolvedValue(job);
		prisma.backgroundJob.update = vi.fn().mockResolvedValue(job);
		(authService.restore as Mock).mockResolvedValue({ did: "did:plc:abc" });
		prisma.trackedMovie.findFirst = vi.fn().mockResolvedValue(null);
		(moviesService.indexTrackedMovie as Mock).mockResolvedValue(undefined);

		// applyWrites SUCCEEDS but the response says the write budget is nearly
		// gone (500 < the 1000-point reserve) and refills ~30 min out. The import
		// must stop and wait so the user's own writes aren't starved.
		const resetEpoch = Math.floor(Date.now() / 1000) + 1800;
		(Agent as unknown as Mock).mockImplementation(() => ({
			com: {
				atproto: {
					repo: {
						applyWrites: vi.fn().mockResolvedValue({
							data: {},
							headers: {
								"ratelimit-remaining": "500",
								"ratelimit-reset": String(resetEpoch),
							},
						}),
					},
				},
			},
		}));

		(global.fetch as Mock).mockResolvedValue(
			new Response(
				JSON.stringify([
					{
						type: "movie",
						action: "watch",
						watched_at: "2026-03-22T12:00:00.000Z",
						movie: { title: "Arrival", year: 2016, ids: { tmdb: 329865 } },
					},
				]),
				{ status: 200, headers: { "x-pagination-page-count": "61" } },
			),
		);

		await worker.processNextTraktImportJob();

		const pauseCall = (prisma.backgroundJob.updateMany as Mock).mock.calls.find(
			([arg]) => arg?.data?.status === "waiting_retry",
		);
		if (!pauseCall) throw new Error("expected a waiting_retry pause update");
		const nextRunAt = pauseCall[0].data.nextRunAt as Date;
		const delaySeconds = (nextRunAt.getTime() - Date.now()) / 1000;
		// Waits out the window (~30 min), not the 800ms inter-page delay.
		expect(delaySeconds).toBeGreaterThan(1700);
		expect(pauseCall[0].data.lastError).toMatch(/PDS write limit/);
		// The page's writes still counted — pacing delays the NEXT page, no rework.
		expect(pauseCall[0].data.data.importedCount).toBe(1);
	});

	it("keeps importing at full speed while PDS write budget is healthy", async () => {
		const job = buildTraktImportJob({ profileAvatarUrl: null });
		prisma.backgroundJob.findFirst = vi.fn().mockResolvedValue(job);
		prisma.backgroundJob.findUnique = vi.fn().mockResolvedValue(job);
		prisma.backgroundJob.update = vi.fn().mockResolvedValue(job);
		(authService.restore as Mock).mockResolvedValue({ did: "did:plc:abc" });
		prisma.trackedMovie.findFirst = vi.fn().mockResolvedValue(null);
		(moviesService.indexTrackedMovie as Mock).mockResolvedValue(undefined);

		// Plenty of budget left (4000 ≥ 1000 reserve) → no pause.
		(Agent as unknown as Mock).mockImplementation(() => ({
			com: {
				atproto: {
					repo: {
						applyWrites: vi.fn().mockResolvedValue({
							data: {},
							headers: { "ratelimit-remaining": "4000" },
						}),
					},
				},
			},
		}));

		(global.fetch as Mock).mockResolvedValue(
			new Response(
				JSON.stringify([
					{
						type: "movie",
						action: "watch",
						watched_at: "2026-03-22T12:00:00.000Z",
						movie: { title: "Arrival", year: 2016, ids: { tmdb: 329865 } },
					},
				]),
				{ status: 200, headers: { "x-pagination-page-count": "61" } },
			),
		);

		await worker.processNextTraktImportJob();

		const lastCall = (prisma.backgroundJob.updateMany as Mock).mock.calls.at(
			-1,
		);
		expect(lastCall?.[0].data.status).toBe("running");
		expect(lastCall?.[0].data.lastError).toBeNull();
		const nextRunAt = lastCall?.[0].data.nextRunAt as Date;
		// Schedules the next page promptly (the 800ms inter-page delay), not a wait.
		expect((nextRunAt.getTime() - Date.now()) / 1000).toBeLessThan(60);
	});

	it("does not claim a job paused after it was selected", async () => {
		const job = buildTraktImportJob();
		const paused = buildTraktImportJob({
			status: "paused",
			updatedAt: new Date("2026-03-23T18:00:01.000Z"),
		});
		const restoreStarted = deferred<void>();
		const finishRestore = deferred<{ did: string }>();
		prisma.backgroundJob.findFirst = vi.fn().mockResolvedValue(job);
		prisma.backgroundJob.findUnique = vi
			.fn()
			.mockResolvedValueOnce(job)
			.mockResolvedValueOnce(paused);
		prisma.backgroundJob.updateMany = vi.fn().mockResolvedValue({ count: 0 });
		(authService.restore as Mock).mockImplementation(() => {
			restoreStarted.resolve();
			return finishRestore.promise;
		});

		const processing = worker.processNextTraktImportJob();
		await restoreStarted.promise;
		finishRestore.resolve({ did: "did:plc:abc" });
		await processing;

		expect(prisma.backgroundJob.updateMany).toHaveBeenCalledOnce();
		expect(prisma.backgroundJob.findUnique).toHaveBeenCalledTimes(2);
		expect(prisma.backgroundJob.findUnique).toHaveBeenLastCalledWith({
			where: { id: "job-1" },
		});
		expect(prisma.backgroundJob.updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					id: "job-1",
					updatedAt: new Date("2026-03-23T18:00:00.000Z"),
					status: { in: ["queued", "running", "waiting_retry"] },
					nextRunAt: { lte: expect.any(Date) },
				},
			}),
		);
		expect(global.fetch).not.toHaveBeenCalled();
		expect(prisma.traktImportItem.upsert).not.toHaveBeenCalled();
	});

	it("persists page progress without making a concurrent pause runnable", async () => {
		const job = buildTraktImportJob({ profileAvatarUrl: null });
		const pausedAt = new Date("2026-03-23T18:00:05.000Z");
		const pausedNextRunAt = new Date("2026-03-23T18:00:04.000Z");
		let latest = job;
		const fetchStarted = deferred<void>();
		const page = deferred<Response>();
		prisma.backgroundJob.findFirst = vi.fn().mockResolvedValue(job);
		prisma.backgroundJob.findUnique = vi.fn().mockImplementation(() => latest);
		(authService.restore as Mock).mockResolvedValue({ did: "did:plc:abc" });
		prisma.trackedMovie.findFirst = vi.fn().mockResolvedValue(null);
		(global.fetch as Mock).mockImplementation(() => {
			fetchStarted.resolve();
			return page.promise;
		});

		const processing = worker.processNextTraktImportJob();
		await fetchStarted.promise;
		latest = buildTraktImportJob({
			status: "paused",
			updatedAt: pausedAt,
			nextRunAt: pausedNextRunAt,
		});
		page.resolve(traktMoviePage());
		await processing;

		const finalWrite = (prisma.backgroundJob.updateMany as Mock).mock.calls.at(
			-1,
		)?.[0];
		expect(finalWrite.where).toEqual({ id: "job-1", updatedAt: pausedAt });
		expect(finalWrite.data).toMatchObject({
			status: "paused",
			nextRunAt: pausedNextRunAt,
			data: { importedCount: 1, normalizedCount: 1, sourceCount: 1 },
		});
	});

	it.each([
		["acknowledgedAt", "2026-03-23T18:00:03.000Z"],
		["reminderSnoozedUntil", "2026-03-30T18:00:03.000Z"],
	] as const)(
		"keeps newest %s while persisting page progress",
		async (controlField, controlValue) => {
			const job = buildTraktImportJob({ profileAvatarUrl: null });
			const controlledAt = new Date("2026-03-23T18:00:03.000Z");
			let latest = job;
			const fetchStarted = deferred<void>();
			const page = deferred<Response>();
			prisma.backgroundJob.findFirst = vi.fn().mockResolvedValue(job);
			prisma.backgroundJob.findUnique = vi
				.fn()
				.mockImplementation(() => latest);
			(authService.restore as Mock).mockResolvedValue({ did: "did:plc:abc" });
			prisma.trackedMovie.findFirst = vi.fn().mockResolvedValue(null);
			(global.fetch as Mock).mockImplementation(() => {
				fetchStarted.resolve();
				return page.promise;
			});

			const processing = worker.processNextTraktImportJob();
			await fetchStarted.promise;
			latest = buildTraktImportJob({
				status: "running",
				updatedAt: controlledAt,
				data: { ...job.data, [controlField]: controlValue },
			});
			page.resolve(traktMoviePage());
			await processing;

			const finalWrite = (
				prisma.backgroundJob.updateMany as Mock
			).mock.calls.at(-1)?.[0];
			expect(finalWrite.where).toEqual({
				id: "job-1",
				updatedAt: controlledAt,
			});
			expect(finalWrite.data.data).toMatchObject({
				importedCount: 1,
				normalizedCount: 1,
				sourceCount: 1,
				[controlField]: controlValue,
			});
		},
	);

	it("does not replace a concurrent pause with a Trakt retry", async () => {
		const job = buildTraktImportJob();
		const pausedAt = new Date("2026-03-23T18:00:06.000Z");
		const pausedNextRunAt = new Date("2026-03-23T18:00:05.000Z");
		let latest = job;
		const fetchStarted = deferred<void>();
		const page = deferred<Response>();
		prisma.backgroundJob.findFirst = vi.fn().mockResolvedValue(job);
		prisma.backgroundJob.findUnique = vi.fn().mockImplementation(() => latest);
		(authService.restore as Mock).mockResolvedValue({ did: "did:plc:abc" });
		(global.fetch as Mock).mockImplementation(() => {
			fetchStarted.resolve();
			return page.promise;
		});

		const processing = worker.processNextTraktImportJob();
		await fetchStarted.promise;
		latest = buildTraktImportJob({
			status: "paused",
			updatedAt: pausedAt,
			nextRunAt: pausedNextRunAt,
		});
		page.resolve(
			new Response(JSON.stringify({}), {
				status: 429,
				headers: { "retry-after": "42" },
			}),
		);
		await processing;

		const finalWrite = (prisma.backgroundJob.updateMany as Mock).mock.calls.at(
			-1,
		)?.[0];
		expect(finalWrite.where).toEqual({ id: "job-1", updatedAt: pausedAt });
		expect(finalWrite.data).toMatchObject({
			status: "paused",
			nextRunAt: pausedNextRunAt,
			lastError: null,
			data: { rateLimitRetries: 1 },
		});
	});

	it("records a failed job after three final-state CAS conflicts", async () => {
		const job = buildTraktImportJob({ profileAvatarUrl: null });
		prisma.backgroundJob.findFirst = vi.fn().mockResolvedValue(job);
		prisma.backgroundJob.findUnique = vi.fn().mockResolvedValue(job);
		prisma.backgroundJob.updateMany = vi
			.fn()
			.mockResolvedValueOnce({ count: 1 })
			.mockResolvedValueOnce({ count: 0 })
			.mockResolvedValueOnce({ count: 0 })
			.mockResolvedValueOnce({ count: 0 })
			.mockResolvedValueOnce({ count: 1 });
		(authService.restore as Mock).mockResolvedValue({ did: "did:plc:abc" });
		prisma.trackedMovie.findFirst = vi.fn().mockResolvedValue(null);
		(global.fetch as Mock).mockResolvedValue(traktMoviePage());

		await worker.processNextTraktImportJob();

		expect(prisma.backgroundJob.updateMany).toHaveBeenCalledTimes(5);
		expect(prisma.backgroundJob.updateMany).toHaveBeenLastCalledWith(
			expect.objectContaining({
				where: {
					id: "job-1",
					updatedAt: new Date("2026-03-23T18:00:00.000Z"),
				},
				data: expect.objectContaining({
					status: "failed",
					lastError: expect.stringContaining("after 3 concurrent updates"),
					completedAt: expect.any(Date),
				}),
			}),
		);
	});
});
