import { ConflictException, NotFoundException } from "@nestjs/common";

const mockDeleteRecord = vi.fn();
const mockListRecords = vi.fn();

vi.mock("@atproto/api", () => ({
	Agent: vi.fn().mockImplementation(() => ({
		com: {
			atproto: {
				repo: {
					listRecords: mockListRecords,
					deleteRecord: mockDeleteRecord,
				},
			},
		},
	})),
}));

import { PrismaService } from "../prisma/prisma.service";
import type { AuthService } from "../auth/auth.service";
import { UserDeletionService } from "./user-deletion.service";

describe("UserDeletionService", () => {
	let service: UserDeletionService;

	const prisma = {
		user: {
			findUnique: vi.fn(),
			delete: vi.fn(),
		},
		trackedMovie: {
			findMany: vi.fn(),
			count: vi.fn(),
		},
		trackedEpisode: {
			findMany: vi.fn(),
			count: vi.fn(),
		},
		follow: {
			findMany: vi.fn(),
			count: vi.fn(),
		},
		note: {
			findMany: vi.fn(),
			count: vi.fn(),
		},
		review: {
			findMany: vi.fn(),
			count: vi.fn(),
		},
		rating: {
			findMany: vi.fn(),
			count: vi.fn(),
		},
		publication: {
			findMany: vi.fn(),
		},
		backgroundJob: {
			findFirst: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			updateMany: vi.fn(),
		},
	} as unknown as PrismaService;

	const authService = {
		restore: vi.fn(),
		revoke: vi.fn(),
	} as unknown as AuthService;

	beforeEach(() => {
		vi.clearAllMocks();

		prisma.user.findUnique = vi.fn().mockResolvedValue({ did: "did:plc:test" });
		prisma.user.delete = vi.fn().mockResolvedValue(undefined);
		prisma.trackedMovie.findMany = vi.fn().mockResolvedValue([]);
		prisma.trackedMovie.count = vi.fn().mockResolvedValue(0);
		prisma.trackedEpisode.findMany = vi.fn().mockResolvedValue([]);
		prisma.trackedEpisode.count = vi.fn().mockResolvedValue(0);
		prisma.follow.findMany = vi.fn().mockResolvedValue([]);
		prisma.follow.count = vi.fn().mockResolvedValue(0);
		prisma.note.findMany = vi.fn().mockResolvedValue([]);
		prisma.note.count = vi.fn().mockResolvedValue(0);
		prisma.review.findMany = vi.fn().mockResolvedValue([]);
		prisma.review.count = vi.fn().mockResolvedValue(0);
		prisma.rating.findMany = vi.fn().mockResolvedValue([]);
		prisma.rating.count = vi.fn().mockResolvedValue(0);
		prisma.publication.findMany = vi.fn().mockResolvedValue([]);
		prisma.backgroundJob.findFirst = vi.fn().mockResolvedValue(null);
		prisma.backgroundJob.create = vi.fn().mockResolvedValue({
			id: "job-1",
			type: "account_deletion",
			userDid: "did:plc:test",
			status: "queued",
			data: { deletePdsData: true, totalRecords: 1, deletedRecords: 0 },
			createdAt: new Date(),
		});

		mockListRecords.mockResolvedValue({ data: { records: [] } });
		mockDeleteRecord.mockResolvedValue(undefined);

		service = new UserDeletionService(prisma, authService);
	});

	describe("deleteUserSync", () => {
		it("deletes a user without PDS cleanup", async () => {
			await service.deleteUserSync("did:plc:test");

			expect(prisma.user.delete).toHaveBeenCalledWith({
				where: { did: "did:plc:test" },
			});
			// The OAuth session must be revoked too — it's a standalone table with
			// no FK cascade, so a deleted account would otherwise keep a live session.
			expect(authService.revoke).toHaveBeenCalledWith("did:plc:test");
		});

		it("throws when user not found", async () => {
			prisma.user.findUnique = vi.fn().mockResolvedValue(null);

			await expect(service.deleteUserSync("did:plc:missing")).rejects.toThrow(
				NotFoundException,
			);
		});
	});

	describe("createDeletionJob", () => {
		it("creates a deletion job with record counts", async () => {
			prisma.trackedMovie.count = vi.fn().mockResolvedValue(5);
			prisma.trackedEpisode.count = vi.fn().mockResolvedValue(10);
			prisma.rating.count = vi.fn().mockResolvedValue(6);
			prisma.follow.count = vi.fn().mockResolvedValue(3);
			prisma.note.count = vi.fn().mockResolvedValue(2);
			prisma.review.count = vi.fn().mockResolvedValue(4);

			await service.createDeletionJob("did:plc:test", true);

			expect(prisma.backgroundJob.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					type: "account_deletion",
					userDid: "did:plc:test",
					status: "queued",
					data: expect.objectContaining({
						// 5 + 10 + 6 ratings + 3 + 2 + 4 + 1 profile
						deletePdsData: true,
						totalRecords: 31,
						deletedRecords: 0,
					}),
				}),
			});
		});

		it("throws when user not found", async () => {
			prisma.user.findUnique = vi.fn().mockResolvedValue(null);

			await expect(
				service.createDeletionJob("did:plc:missing", true),
			).rejects.toThrow(NotFoundException);
		});

		it("rejects when a deletion is already in progress", async () => {
			prisma.backgroundJob.findFirst = vi.fn().mockResolvedValue({
				id: "existing-job",
				status: "running",
			});

			await expect(
				service.createDeletionJob("did:plc:test", true),
			).rejects.toThrow(ConflictException);
		});
	});

	describe("processNextDeletionJob (async worker)", () => {
		// Make findFirst (the worker's pickup query) and findUnique (the per-job
		// load) both return the same job record.
		function queueJob(data: Record<string, unknown>) {
			const job = {
				id: "job-1",
				userDid: "did:plc:test",
				status: "queued",
				startedAt: null,
				data,
			};
			prisma.backgroundJob.findFirst = vi.fn().mockResolvedValue(job);
			prisma.backgroundJob.findUnique = vi.fn().mockResolvedValue(job);
			return job;
		}

		it("runs the full PDS pipeline, then deletes the user and revokes the session", async () => {
			queueJob({ deletePdsData: true, totalRecords: 1, deletedRecords: 0 });
			authService.restore = vi.fn().mockResolvedValue({ did: "did:plc:test" });
			prisma.trackedMovie.findMany = vi
				.fn()
				.mockResolvedValue([{ rkey: "m1" }]);
			prisma.rating.findMany = vi.fn().mockResolvedValue([{ rkey: "r1" }]);

			await service.processNextDeletionJob();

			expect(mockDeleteRecord).toHaveBeenCalledWith(
				expect.objectContaining({ rkey: "m1" }),
			);
			// Ratings must be cleaned from the PDS too (previously orphaned).
			expect(mockDeleteRecord).toHaveBeenCalledWith(
				expect.objectContaining({ rkey: "r1" }),
			);
			expect(mockDeleteRecord).toHaveBeenCalledWith(
				expect.objectContaining({ rkey: "self" }),
			);
			expect(prisma.user.delete).toHaveBeenCalledWith({
				where: { did: "did:plc:test" },
			});
			expect(authService.revoke).toHaveBeenCalledWith("did:plc:test");
			expect(prisma.backgroundJob.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ status: "completed" }),
				}),
			);
		});

		it("stops after the per-tick batch and reschedules as waiting_retry", async () => {
			queueJob({ deletePdsData: true, totalRecords: 250, deletedRecords: 0 });
			authService.restore = vi.fn().mockResolvedValue({ did: "did:plc:test" });
			prisma.trackedMovie.findMany = vi
				.fn()
				.mockResolvedValue(
					Array.from({ length: 250 }, (_, i) => ({ rkey: `m${i}` })),
				);

			await service.processNextDeletionJob();

			// DELETION_BATCH_SIZE: one tick deletes at most 200 records, then yields.
			expect(mockDeleteRecord).toHaveBeenCalledTimes(200);
			expect(prisma.user.delete).not.toHaveBeenCalled();
			expect(authService.revoke).not.toHaveBeenCalled();
			expect(prisma.backgroundJob.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						status: "waiting_retry",
						nextRunAt: expect.any(Date),
					}),
				}),
			);
		});

		it("resumes from the persisted step, skipping already-deleted steps", async () => {
			queueJob({
				deletePdsData: true,
				totalRecords: 6,
				deletedRecords: 5,
				currentStep: "profile",
			});
			authService.restore = vi.fn().mockResolvedValue({ did: "did:plc:test" });
			prisma.trackedMovie.findMany = vi
				.fn()
				.mockResolvedValue([{ rkey: "m1" }]);

			await service.processNextDeletionJob();

			// "movies" precedes "profile" in the pipeline — it must be skipped, so
			// its records are never re-listed or re-deleted.
			expect(prisma.trackedMovie.findMany).not.toHaveBeenCalled();
			expect(mockDeleteRecord).not.toHaveBeenCalledWith(
				expect.objectContaining({ rkey: "m1" }),
			);
			expect(mockDeleteRecord).toHaveBeenCalledWith(
				expect.objectContaining({ rkey: "self" }),
			);
			expect(prisma.user.delete).toHaveBeenCalled();
		});

		it("fails the job when the session can't be restored, leaving the user intact", async () => {
			queueJob({ deletePdsData: true, totalRecords: 1, deletedRecords: 0 });
			authService.restore = vi.fn().mockResolvedValue(null);

			await service.processNextDeletionJob();

			expect(prisma.user.delete).not.toHaveBeenCalled();
			expect(authService.revoke).not.toHaveBeenCalled();
			expect(prisma.backgroundJob.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						status: "failed",
						lastError: expect.stringContaining("session expired"),
					}),
				}),
			);
		});

		it("skips PDS deletion entirely when deletePdsData is false", async () => {
			queueJob({ deletePdsData: false, totalRecords: 0, deletedRecords: 0 });

			await service.processNextDeletionJob();

			expect(authService.restore).not.toHaveBeenCalled();
			expect(mockDeleteRecord).not.toHaveBeenCalled();
			expect(prisma.user.delete).toHaveBeenCalledWith({
				where: { did: "did:plc:test" },
			});
			expect(authService.revoke).toHaveBeenCalledWith("did:plc:test");
			expect(prisma.backgroundJob.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ status: "completed" }),
				}),
			);
		});

		it("does nothing when no deletion job is queued", async () => {
			prisma.backgroundJob.findFirst = vi.fn().mockResolvedValue(null);

			await service.processNextDeletionJob();

			expect(prisma.backgroundJob.findUnique).not.toHaveBeenCalled();
			expect(prisma.user.delete).not.toHaveBeenCalled();
		});
	});

	describe("reapStaleRunningJobs", () => {
		it("resets crash-orphaned running jobs back to waiting_retry", async () => {
			prisma.backgroundJob.updateMany = vi.fn().mockResolvedValue({ count: 2 });

			await service.reapStaleRunningJobs();

			expect(prisma.backgroundJob.updateMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						status: "running",
						updatedAt: { lt: expect.any(Date) },
					}),
					data: expect.objectContaining({
						status: "waiting_retry",
						nextRunAt: expect.any(Date),
					}),
				}),
			);
		});
	});
});
