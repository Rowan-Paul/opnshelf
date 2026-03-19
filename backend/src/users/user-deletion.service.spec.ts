import { BadGatewayException, NotFoundException } from "@nestjs/common";

const mockListRecords = jest.fn();
const mockDeleteRecord = jest.fn();

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
		},
		trackedEpisode: {
			findMany: jest.fn(),
		},
		follow: {
			findMany: jest.fn(),
		},
		listItem: {
			findMany: jest.fn(),
		},
		list: {
			findMany: jest.fn(),
		},
	} as unknown as PrismaService;

	beforeEach(() => {
		jest.clearAllMocks();

		prisma.user.findUnique = jest
			.fn()
			.mockResolvedValue({ did: "did:plc:test" });
		prisma.user.delete = jest.fn().mockResolvedValue(undefined);
		prisma.trackedMovie.findMany = jest.fn().mockResolvedValue([]);
		prisma.trackedEpisode.findMany = jest.fn().mockResolvedValue([]);
		prisma.follow.findMany = jest.fn().mockResolvedValue([]);
		prisma.listItem.findMany = jest.fn().mockResolvedValue([]);
		prisma.list.findMany = jest.fn().mockResolvedValue([]);

		service = new UserDeletionService(prisma);
	});

	it("deletes all repo list items and lists, including favorites missing from Prisma", async () => {
		mockListRecords
			.mockResolvedValueOnce({
				data: {
					records: [
						{
							uri: "at://did:plc:test/xyz.opnshelf.listItem/list-item-1",
							cid: "cid-1",
							value: {},
						},
						{
							uri: "at://did:plc:test/xyz.opnshelf.listItem/list-item-2",
							cid: "cid-2",
							value: {},
						},
					],
					cursor: "cursor-2",
				},
			})
			.mockResolvedValueOnce({
				data: {
					records: [
						{
							uri: "at://did:plc:test/xyz.opnshelf.listItem/list-item-3",
							cid: "cid-3",
							value: {},
						},
					],
				},
			})
			.mockResolvedValueOnce({
				data: {
					records: [
						{
							uri: "at://did:plc:test/xyz.opnshelf.list/favorites",
							cid: "cid-4",
							value: {},
						},
						{
							uri: "at://did:plc:test/xyz.opnshelf.list/custom-list",
							cid: "cid-5",
							value: {},
						},
					],
				},
			});

		await service.deleteUser("did:plc:test", { did: "did:plc:test" }, true);

		expect(mockListRecords).toHaveBeenNthCalledWith(1, {
			repo: "did:plc:test",
			collection: "xyz.opnshelf.listItem",
			limit: 100,
			cursor: undefined,
		});
		expect(mockListRecords).toHaveBeenNthCalledWith(2, {
			repo: "did:plc:test",
			collection: "xyz.opnshelf.listItem",
			limit: 100,
			cursor: "cursor-2",
		});
		expect(mockListRecords).toHaveBeenNthCalledWith(3, {
			repo: "did:plc:test",
			collection: "xyz.opnshelf.list",
			limit: 100,
			cursor: undefined,
		});
		expect(mockDeleteRecord.mock.calls).toEqual([
			[
				{
					repo: "did:plc:test",
					collection: "xyz.opnshelf.listItem",
					rkey: "list-item-1",
				},
			],
			[
				{
					repo: "did:plc:test",
					collection: "xyz.opnshelf.listItem",
					rkey: "list-item-2",
				},
			],
			[
				{
					repo: "did:plc:test",
					collection: "xyz.opnshelf.listItem",
					rkey: "list-item-3",
				},
			],
			[
				{
					repo: "did:plc:test",
					collection: "xyz.opnshelf.list",
					rkey: "favorites",
				},
			],
			[
				{
					repo: "did:plc:test",
					collection: "xyz.opnshelf.list",
					rkey: "custom-list",
				},
			],
		]);
		expect(prisma.listItem.findMany).not.toHaveBeenCalled();
		expect(prisma.list.findMany).not.toHaveBeenCalled();
		expect(prisma.user.delete).toHaveBeenCalledWith({
			where: { did: "did:plc:test" },
		});
	});

	it("aborts account deletion when listing repo records fails", async () => {
		mockListRecords.mockRejectedValueOnce(new Error("PDS unavailable"));

		await expect(
			service.deleteUser("did:plc:test", { did: "did:plc:test" }, true),
		).rejects.toThrow(BadGatewayException);
		expect(prisma.user.delete).not.toHaveBeenCalled();
	});

	it("aborts account deletion when deleting a repo list record fails", async () => {
		mockListRecords
			.mockResolvedValueOnce({
				data: { records: [] },
			})
			.mockResolvedValueOnce({
				data: {
					records: [
						{
							uri: "at://did:plc:test/xyz.opnshelf.list/favorites",
							cid: "cid-1",
							value: {},
						},
					],
				},
			});
		mockDeleteRecord.mockRejectedValueOnce({
			status: 500,
			error: "InternalError",
		});

		await expect(
			service.deleteUser("did:plc:test", { did: "did:plc:test" }, true),
		).rejects.toThrow(BadGatewayException);
		expect(prisma.user.delete).not.toHaveBeenCalled();
	});

	it("treats already-missing repo records as deleted", async () => {
		mockListRecords
			.mockResolvedValueOnce({
				data: { records: [] },
			})
			.mockResolvedValueOnce({
				data: {
					records: [
						{
							uri: "at://did:plc:test/xyz.opnshelf.list/favorites",
							cid: "cid-1",
							value: {},
						},
					],
				},
			});
		mockDeleteRecord.mockRejectedValueOnce({
			status: 404,
			error: "RecordNotFound",
			message: "RecordNotFound",
		});

		await expect(
			service.deleteUser("did:plc:test", { did: "did:plc:test" }, true),
		).resolves.toBeUndefined();
		expect(prisma.user.delete).toHaveBeenCalledWith({
			where: { did: "did:plc:test" },
		});
	});

	it("throws when deleting a missing user", async () => {
		prisma.user.findUnique = jest.fn().mockResolvedValue(null);

		await expect(
			service.deleteUser("did:plc:missing", { did: "did:plc:missing" }, false),
		).rejects.toThrow(NotFoundException);
	});
});
