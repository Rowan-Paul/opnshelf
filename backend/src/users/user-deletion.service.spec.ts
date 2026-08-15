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
			deleteMany: vi.fn(),
		},
	} as unknown as PrismaService;

	const authService = {
		restore: vi.fn(),
		revoke: vi.fn(),
	} as unknown as AuthService;

	beforeEach(() => {
		vi.clearAllMocks();
		authService.restore = vi.fn();
		authService.revoke = vi.fn().mockResolvedValue(undefined);

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
		prisma.backgroundJob.deleteMany = vi.fn().mockResolvedValue({ count: 0 });
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
			expect(prisma.backgroundJob.deleteMany).toHaveBeenCalledWith({
				where: { userDid: "did:plc:test", type: "trakt_import" },
			});
			// The OAuth session must be revoked too — it's a standalone table with
			// no FK cascade, so a deleted account would otherwise keep a live session.
			expect(authService.revoke).toHaveBeenCalledWith("did:plc:test");
			expect(
				vi.mocked(authService.revoke).mock.invocationCallOrder[0],
			).toBeLessThan(vi.mocked(prisma.user.delete).mock.invocationCallOrder[0]);
		});

		it("leaves the user intact when session revocation fails", async () => {
			authService.revoke = vi.fn().mockRejectedValue(new Error("DB error"));

			await expect(service.deleteUserSync("did:plc:test")).rejects.toThrow(
				"DB error",
			);

			expect(prisma.user.delete).not.toHaveBeenCalled();
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

		it("advances through a PDS collection across multiple worker ticks", async () => {
			const job = queueJob({
				deletePdsData: true,
				totalRecords: 251,
				deletedRecords: 0,
			});
			authService.restore = vi.fn().mockResolvedValue({ did: "did:plc:test" });
			const episodeRkeys = new Set(
				Array.from({ length: 250 }, (_, index) => `episode-${index}`),
			);

			mockListRecords.mockImplementation(
				({ collection, cursor }: { collection: string; cursor?: string }) => {
					const start = Number(cursor ?? 0);
					const page =
						collection === "xyz.opnshelf.episode"
							? [...episodeRkeys].slice(start, start + 100)
							: [];
					return {
						data: {
							records: page.map((rkey) => ({
								uri: `at://did:plc:test/${collection}/${rkey}`,
							})),
							cursor:
								collection === "xyz.opnshelf.episode" &&
								start + page.length < episodeRkeys.size
									? String(start + page.length)
									: undefined,
						},
					};
				},
			);
			mockDeleteRecord.mockImplementation(
				({ collection, rkey }: { collection: string; rkey: string }) => {
					if (collection === "xyz.opnshelf.episode") episodeRkeys.delete(rkey);
				},
			);
			prisma.backgroundJob.update = vi.fn().mockImplementation(({ data }) => {
				if (data.data) job.data = data.data;
				if (data.status) job.status = data.status;
				return job;
			});

			for (let tick = 0; tick < 4 && episodeRkeys.size > 0; tick++) {
				await service.processNextDeletionJob();
			}
			await service.processNextDeletionJob();

			expect(episodeRkeys.size).toBe(0);
			expect(
				mockDeleteRecord.mock.calls
					.filter(([input]) => input.collection === "xyz.opnshelf.episode")
					.map(([input]) => input.rkey),
			).toHaveLength(250);
			expect(prisma.user.delete).toHaveBeenCalledWith({
				where: { did: "did:plc:test" },
			});
			expect(job.data).toEqual(
				expect.objectContaining({
					currentStep: "completed",
					deletedRecords: 251,
				}),
			);
		});

		it("advances through managed blog mirrors across multiple worker ticks", async () => {
			const job = queueJob({
				deletePdsData: true,
				totalRecords: 251,
				deletedRecords: 0,
				currentStep: "blog_mirrors",
			});
			authService.restore = vi.fn().mockResolvedValue({ did: "did:plc:test" });
			const mirrorRows = Array.from({ length: 250 }, (_, index) => ({
				rkey: `mirror-${String(index).padStart(3, "0")}`,
			}));
			const remaining = new Set(mirrorRows.map(({ rkey }) => rkey));
			prisma.review.findMany = vi.fn().mockResolvedValue(mirrorRows);
			mockDeleteRecord.mockImplementation(
				({ collection, rkey }: { collection: string; rkey: string }) => {
					if (collection !== "site.standard.document") return;
					if (!remaining.delete(rkey)) {
						throw { message: "Delete target record does not exist" };
					}
				},
			);
			prisma.backgroundJob.update = vi.fn().mockImplementation(({ data }) => {
				if (data.data) job.data = data.data;
				if (data.status) job.status = data.status;
				return job;
			});

			for (let tick = 0; tick < 4 && remaining.size > 0; tick++) {
				await service.processNextDeletionJob();
			}

			expect(remaining.size).toBe(0);
		});

		it("runs the full PDS pipeline, then revokes the session and deletes the user", async () => {
			queueJob({ deletePdsData: true, totalRecords: 1, deletedRecords: 0 });
			authService.restore = vi.fn().mockResolvedValue({ did: "did:plc:test" });
			mockListRecords.mockImplementation(
				({ collection }: { collection: string }) => ({
					data: {
						records:
							collection === "xyz.opnshelf.movie"
								? [{ uri: `at://did:plc:test/${collection}/m1` }]
								: collection === "xyz.opnshelf.rating"
									? [{ uri: `at://did:plc:test/${collection}/r1` }]
									: [],
					},
				}),
			);

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
			expect(
				vi.mocked(authService.revoke).mock.invocationCallOrder[0],
			).toBeLessThan(vi.mocked(prisma.user.delete).mock.invocationCallOrder[0]);
			expect(prisma.backgroundJob.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ status: "completed" }),
				}),
			);
		});

		it("fails the job and leaves the user intact when session revocation fails", async () => {
			queueJob({ deletePdsData: false, totalRecords: 0, deletedRecords: 0 });
			authService.revoke = vi.fn().mockRejectedValue(new Error("DB error"));

			await service.processNextDeletionJob();

			expect(prisma.user.delete).not.toHaveBeenCalled();
			expect(prisma.backgroundJob.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						status: "failed",
						lastError: "DB error",
					}),
				}),
			);
		});

		it("fails the job without recreating sessions when user deletion fails", async () => {
			queueJob({ deletePdsData: false, totalRecords: 0, deletedRecords: 0 });
			prisma.user.delete = vi
				.fn()
				.mockRejectedValue(new Error("delete failed"));

			await service.processNextDeletionJob();

			expect(authService.revoke).toHaveBeenCalledOnce();
			expect(prisma.backgroundJob.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						status: "failed",
						lastError: "delete failed",
					}),
				}),
			);
		});

		it("deletes library items and review likes from the PDS", async () => {
			queueJob({ deletePdsData: true, totalRecords: 1, deletedRecords: 0 });
			authService.restore = vi.fn().mockResolvedValue({ did: "did:plc:test" });
			mockListRecords.mockImplementation(
				({ collection }: { collection: string }) => ({
					data: {
						records: [
							...(collection === "xyz.opnshelf.library.item"
								? [{ uri: `at://did:plc:test/${collection}/library-1` }]
								: []),
							...(collection === "xyz.opnshelf.review.like"
								? [{ uri: `at://did:plc:test/${collection}/like-1` }]
								: []),
						],
					},
				}),
			);

			await service.processNextDeletionJob();

			expect(mockDeleteRecord).toHaveBeenCalledWith({
				repo: "did:plc:test",
				collection: "xyz.opnshelf.library.item",
				rkey: "library-1",
			});
			expect(mockDeleteRecord).toHaveBeenCalledWith({
				repo: "did:plc:test",
				collection: "xyz.opnshelf.review.like",
				rkey: "like-1",
			});
		});

		it("stops after the per-tick batch and reschedules as waiting_retry", async () => {
			queueJob({ deletePdsData: true, totalRecords: 250, deletedRecords: 0 });
			authService.restore = vi.fn().mockResolvedValue({ did: "did:plc:test" });
			const movieRkeys = Array.from({ length: 250 }, (_, i) => `m${i}`);
			mockListRecords.mockImplementation(
				({ collection, cursor }: { collection: string; cursor?: string }) => {
					if (collection !== "xyz.opnshelf.movie") {
						return { data: { records: [] } };
					}
					const start = Number(cursor ?? 0);
					const page = movieRkeys.slice(start, start + 100);
					return {
						data: {
							records: page.map((rkey) => ({
								uri: `at://did:plc:test/${collection}/${rkey}`,
							})),
							cursor:
								start + page.length < movieRkeys.length
									? String(start + page.length)
									: undefined,
						},
					};
				},
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

		it("fails the job when a PDS record cannot be deleted", async () => {
			queueJob({ deletePdsData: true, totalRecords: 1, deletedRecords: 0 });
			authService.restore = vi.fn().mockResolvedValue({ did: "did:plc:test" });
			mockListRecords.mockImplementation(
				({ collection }: { collection: string }) => ({
					data: {
						records:
							collection === "xyz.opnshelf.movie"
								? [{ uri: `at://did:plc:test/${collection}/m1` }]
								: [],
					},
				}),
			);
			mockDeleteRecord.mockRejectedValue(new Error("PDS timed out"));

			await service.processNextDeletionJob();

			expect(prisma.user.delete).not.toHaveBeenCalled();
			expect(authService.revoke).not.toHaveBeenCalled();
			expect(prisma.backgroundJob.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						status: "failed",
						lastError: expect.stringContaining("PDS timed out"),
					}),
				}),
			);
		});

		it("treats Tranquil's missing-record response as an idempotent delete", async () => {
			queueJob({ deletePdsData: true, totalRecords: 1, deletedRecords: 0 });
			authService.restore = vi.fn().mockResolvedValue({ did: "did:plc:test" });
			mockDeleteRecord.mockRejectedValue({
				error: "InvalidRequest",
				status: 400,
				message: "Delete target record does not exist",
			});

			await service.processNextDeletionJob();

			expect(prisma.user.delete).toHaveBeenCalledWith({
				where: { did: "did:plc:test" },
			});
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
