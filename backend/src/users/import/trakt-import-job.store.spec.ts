import type { Mock } from "vitest";
import { NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../prisma/prisma.service";
import {
	TraktImportJobStore,
	TraktJobCasError,
} from "./trakt-import-job.store";

describe("TraktImportJobStore", () => {
	let store: TraktImportJobStore;

	function buildTraktImportJob(overrides: Record<string, unknown> = {}) {
		return {
			id: "job-1",
			type: "trakt_import",
			userDid: "did:plc:abc",
			status: "queued",
			data: {
				traktUsername: "alice",
				currentPage: 1,
				totalPages: null,
				sourceCount: 0,
				normalizedCount: 0,
				importedCount: 0,
				skippedCount: 0,
				failedCount: 0,
			},
			nextRunAt: new Date("2026-03-23T18:00:00.000Z"),
			lastError: null,
			startedAt: null,
			completedAt: null,
			createdAt: new Date("2026-03-23T18:00:00.000Z"),
			updatedAt: new Date("2026-03-23T18:00:00.000Z"),
			...overrides,
		};
	}

	const prisma = {
		backgroundJob: {
			findFirst: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			updateMany: vi.fn(),
		},
	} as unknown as PrismaService;

	beforeEach(() => {
		vi.clearAllMocks();
		store = new TraktImportJobStore(prisma);
		prisma.backgroundJob.updateMany = vi.fn().mockResolvedValue({ count: 1 });
	});

	it.each([
		["pause", "queued", "running", "paused"],
		["resume", "paused", "failed", "queued"],
	] as const)(
		"retries a conflicting %s control with the newest version predicate",
		async (action, firstStatus, secondStatus, expectedStatus) => {
			const firstAt = new Date("2026-03-23T18:00:00.000Z");
			const secondAt = new Date("2026-03-23T18:00:01.000Z");
			prisma.backgroundJob.findUnique = vi
				.fn()
				.mockResolvedValueOnce(
					buildTraktImportJob({ status: firstStatus, updatedAt: firstAt }),
				)
				.mockResolvedValueOnce(
					buildTraktImportJob({ status: secondStatus, updatedAt: secondAt }),
				);
			prisma.backgroundJob.updateMany = vi
				.fn()
				.mockResolvedValueOnce({ count: 0 })
				.mockResolvedValueOnce({ count: 1 });

			await store.persistStatusControl("job-1", action);

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

	it("leaves a job alone when the control does not apply to its status", async () => {
		prisma.backgroundJob.findUnique = vi
			.fn()
			.mockResolvedValue(buildTraktImportJob({ status: "completed" }));

		await store.persistStatusControl("job-1", "pause");

		expect(prisma.backgroundJob.updateMany).not.toHaveBeenCalled();
	});

	it("rejects controls for a missing job", async () => {
		prisma.backgroundJob.findUnique = vi.fn().mockResolvedValue(null);

		await expect(store.persistStatusControl("job-1", "pause")).rejects.toThrow(
			NotFoundException,
		);
		await expect(
			store.persistControl("job-1", { acknowledgedAt: "2026-03-23" }),
		).rejects.toThrow(NotFoundException);
	});

	it("merges controls into the newest job data", async () => {
		prisma.backgroundJob.findUnique = vi
			.fn()
			.mockResolvedValue(buildTraktImportJob());

		await store.persistControl("job-1", {
			reminderSnoozedUntil: "2026-03-30T18:00:00.000Z",
		});

		expect(prisma.backgroundJob.updateMany).toHaveBeenCalledWith({
			where: { id: "job-1", updatedAt: new Date("2026-03-23T18:00:00.000Z") },
			data: {
				data: expect.objectContaining({
					traktUsername: "alice",
					reminderSnoozedUntil: "2026-03-30T18:00:00.000Z",
				}),
			},
		});
	});

	it("keeps a concurrently paused job paused while saving worker progress", async () => {
		const pausedAt = new Date("2026-03-23T18:00:05.000Z");
		const pausedNextRunAt = new Date("2026-03-23T18:00:04.000Z");
		prisma.backgroundJob.findUnique = vi.fn().mockResolvedValue(
			buildTraktImportJob({
				status: "paused",
				updatedAt: pausedAt,
				nextRunAt: pausedNextRunAt,
				data: { traktUsername: "alice", acknowledgedAt: "2026-03-23" },
			}),
		);

		await store.persistWorkerState(
			"job-1",
			{
				traktUsername: "alice",
				currentPage: 2,
				totalPages: 3,
				sourceCount: 100,
				normalizedCount: 90,
				importedCount: 80,
				skippedCount: 10,
				failedCount: 0,
				unmatchedCount: 0,
				alreadyOnShelfCount: 0,
				snapshotAt: "2026-03-23T18:00:00.000Z",
			},
			{
				status: "running",
				nextRunAt: new Date(),
				lastError: null,
				completedAt: null,
			},
		);

		expect(prisma.backgroundJob.updateMany).toHaveBeenCalledWith({
			where: { id: "job-1", updatedAt: pausedAt },
			data: expect.objectContaining({
				status: "paused",
				nextRunAt: pausedNextRunAt,
				data: expect.objectContaining({
					currentPage: 2,
					acknowledgedAt: "2026-03-23",
				}),
			}),
		});
	});

	it("never replaces a terminal state with a different one", async () => {
		prisma.backgroundJob.findUnique = vi
			.fn()
			.mockResolvedValue(buildTraktImportJob({ status: "completed" }));

		await store.failJob("job-1", "boom");

		expect(prisma.backgroundJob.updateMany).not.toHaveBeenCalled();
	});

	it("gives up after three worker-state CAS conflicts", async () => {
		prisma.backgroundJob.findUnique = vi
			.fn()
			.mockResolvedValue(buildTraktImportJob());
		prisma.backgroundJob.updateMany = vi.fn().mockResolvedValue({ count: 0 });

		await expect(
			store.persistWorkerState("job-1", undefined, {
				status: "running",
				nextRunAt: new Date(),
				lastError: null,
				completedAt: null,
			}),
		).rejects.toThrow(TraktJobCasError);
		expect(prisma.backgroundJob.updateMany).toHaveBeenCalledTimes(3);
	});

	it("reports a lost claim without touching the newer state", async () => {
		const job = buildTraktImportJob();
		prisma.backgroundJob.updateMany = vi.fn().mockResolvedValue({ count: 0 });
		prisma.backgroundJob.findUnique = vi
			.fn()
			.mockResolvedValue(buildTraktImportJob({ status: "paused" }));

		await expect(store.claimJob(job)).resolves.toBe(false);

		expect(prisma.backgroundJob.updateMany).toHaveBeenCalledWith({
			where: {
				id: "job-1",
				updatedAt: job.updatedAt,
				status: { in: ["queued", "running", "waiting_retry"] },
				nextRunAt: { lte: expect.any(Date) },
			},
			data: expect.objectContaining({ status: "running", lastError: null }),
		});
		expect(prisma.backgroundJob.updateMany).toHaveBeenCalledOnce();
	});

	it("reaps jobs stuck in running back to waiting_retry", async () => {
		prisma.backgroundJob.updateMany = vi.fn().mockResolvedValue({ count: 2 });

		await store.reapStaleRunningJobs();

		const call = (prisma.backgroundJob.updateMany as Mock).mock.calls[0][0];
		expect(call.where).toMatchObject({
			type: "trakt_import",
			status: "running",
		});
		const threshold = call.where.updatedAt.lt as Date;
		const ageMinutes = (Date.now() - threshold.getTime()) / 60_000;
		expect(ageMinutes).toBeGreaterThanOrEqual(4.9);
		expect(ageMinutes).toBeLessThan(6);
		expect(call.data).toMatchObject({
			status: "waiting_retry",
			lastError: expect.stringContaining("Resuming"),
		});
	});

	it("looks up jobs with the same predicates the import flows rely on", async () => {
		prisma.backgroundJob.findFirst = vi.fn().mockResolvedValue(null);

		await store.findCurrentJob("did:plc:abc");
		await store.findNextRunnableJob();
		await expect(store.requireJob("did:plc:abc")).rejects.toThrow(
			NotFoundException,
		);

		const calls = (prisma.backgroundJob.findFirst as Mock).mock.calls;
		expect(calls[0][0]).toEqual({
			where: { type: "trakt_import", userDid: "did:plc:abc" },
			orderBy: [{ createdAt: "desc" }],
		});
		expect(calls[1][0]).toMatchObject({
			where: {
				type: "trakt_import",
				status: { in: ["queued", "running", "waiting_retry"] },
			},
			orderBy: [{ nextRunAt: "asc" }, { createdAt: "asc" }],
		});
		expect(calls[2][0]).toEqual({
			where: { type: "trakt_import", userDid: "did:plc:abc" },
			orderBy: { createdAt: "desc" },
		});
	});
});
