import { ConflictException, NotFoundException } from "@nestjs/common";

const mockDeleteRecord = jest.fn();
const mockListRecords = jest.fn();

jest.mock("@atproto/api", () => ({
	Agent: jest.fn().mockImplementation(() => ({
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
			findUnique: jest.fn(),
			delete: jest.fn(),
		},
		trackedMovie: {
			findMany: jest.fn(),
			count: jest.fn(),
		},
		trackedEpisode: {
			findMany: jest.fn(),
			count: jest.fn(),
		},
		follow: {
			findMany: jest.fn(),
			count: jest.fn(),
		},
		note: {
			findMany: jest.fn(),
			count: jest.fn(),
		},
		review: {
			findMany: jest.fn(),
			count: jest.fn(),
		},
		backgroundJob: {
			findFirst: jest.fn(),
			findUnique: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
		},
	} as unknown as PrismaService;

	const authService = {
		restore: jest.fn(),
		revoke: jest.fn(),
	} as unknown as AuthService;

	beforeEach(() => {
		jest.clearAllMocks();

		prisma.user.findUnique = jest
			.fn()
			.mockResolvedValue({ did: "did:plc:test" });
		prisma.user.delete = jest.fn().mockResolvedValue(undefined);
		prisma.trackedMovie.findMany = jest.fn().mockResolvedValue([]);
		prisma.trackedMovie.count = jest.fn().mockResolvedValue(0);
		prisma.trackedEpisode.findMany = jest.fn().mockResolvedValue([]);
		prisma.trackedEpisode.count = jest.fn().mockResolvedValue(0);
		prisma.follow.findMany = jest.fn().mockResolvedValue([]);
		prisma.follow.count = jest.fn().mockResolvedValue(0);
		prisma.note.findMany = jest.fn().mockResolvedValue([]);
		prisma.note.count = jest.fn().mockResolvedValue(0);
		prisma.review.findMany = jest.fn().mockResolvedValue([]);
		prisma.review.count = jest.fn().mockResolvedValue(0);
		prisma.backgroundJob.findFirst = jest.fn().mockResolvedValue(null);
		prisma.backgroundJob.create = jest.fn().mockResolvedValue({
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
			prisma.user.findUnique = jest.fn().mockResolvedValue(null);

			await expect(service.deleteUserSync("did:plc:missing")).rejects.toThrow(
				NotFoundException,
			);
		});
	});

	describe("createDeletionJob", () => {
		it("creates a deletion job with record counts", async () => {
			prisma.trackedMovie.count = jest.fn().mockResolvedValue(5);
			prisma.trackedEpisode.count = jest.fn().mockResolvedValue(10);
			prisma.follow.count = jest.fn().mockResolvedValue(3);
			prisma.note.count = jest.fn().mockResolvedValue(2);
			prisma.review.count = jest.fn().mockResolvedValue(4);

			await service.createDeletionJob("did:plc:test", true);

			expect(prisma.backgroundJob.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					type: "account_deletion",
					userDid: "did:plc:test",
					status: "queued",
					data: expect.objectContaining({
						deletePdsData: true,
						totalRecords: 25,
						deletedRecords: 0,
					}),
				}),
			});
		});

		it("throws when user not found", async () => {
			prisma.user.findUnique = jest.fn().mockResolvedValue(null);

			await expect(
				service.createDeletionJob("did:plc:missing", true),
			).rejects.toThrow(NotFoundException);
		});

		it("rejects when a deletion is already in progress", async () => {
			prisma.backgroundJob.findFirst = jest.fn().mockResolvedValue({
				id: "existing-job",
				status: "running",
			});

			await expect(
				service.createDeletionJob("did:plc:test", true),
			).rejects.toThrow(ConflictException);
		});
	});
});
