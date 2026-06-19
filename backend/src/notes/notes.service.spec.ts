import { Test, type TestingModule } from "@nestjs/testing";

jest.mock("../prisma/prisma.service", () => ({
	PrismaService: jest.fn(),
}));

const mockPutRecord = jest.fn();
const mockDeleteRecord = jest.fn();
jest.mock("@atproto/api", () => ({
	Agent: jest.fn().mockImplementation(() => ({
		com: {
			atproto: {
				repo: {
					putRecord: mockPutRecord,
					deleteRecord: mockDeleteRecord,
				},
			},
		},
	})),
}));

jest.mock("@atproto/common", () => ({
	TID: {
		nextStr: jest.fn(() => "testtid123"),
	},
}));

jest.mock("../lexicons/xyz/opnshelf/note", () => ({
	main: {
		build: jest.fn((data: Record<string, unknown>) => ({
			$type: "xyz.opnshelf.note",
			...data,
		})),
		parse: jest.fn((data: Record<string, unknown>) => data),
	},
	$nsid: "xyz.opnshelf.note",
}));

import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotesService, type ATSession } from "./notes.service";

describe("NotesService", () => {
	let service: NotesService;

	const mockPrismaService = {
		note: {
			findUnique: jest.fn(),
			findFirst: jest.fn(),
			findMany: jest.fn(),
			count: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn(),
			upsert: jest.fn(),
		},
		movie: { findMany: jest.fn() },
		show: { findMany: jest.fn() },
	};

	const session: ATSession = { did: "did:plc:abc123" };

	beforeEach(async () => {
		jest.clearAllMocks();
		mockPutRecord.mockReset();
		mockDeleteRecord.mockReset();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				NotesService,
				{ provide: PrismaService, useValue: mockPrismaService },
			],
		}).compile();

		service = module.get<NotesService>(NotesService);
	});

	describe("upsertNote - create path", () => {
		it("writes a new note record to the PDS and persists it to the DB", async () => {
			mockPrismaService.note.findUnique.mockResolvedValue(null);
			mockPutRecord.mockResolvedValue({
				data: {
					uri: "at://did:plc:abc123/xyz.opnshelf.note/testtid123",
					cid: "cid-new",
				},
			});
			mockPrismaService.note.create.mockImplementation(
				({ data }: { data: Record<string, unknown> }) => ({
					id: "note-1",
					...data,
				}),
			);

			const result = await service.upsertNote(session.did, session, {
				mediaType: "movie",
				mediaId: "123",
				content: "Great film.",
			});

			expect(mockPutRecord).toHaveBeenCalledWith(
				expect.objectContaining({
					repo: session.did,
					collection: "xyz.opnshelf.note",
					rkey: "testtid123",
					record: expect.objectContaining({
						mediaType: "movie",
						mediaId: "123",
						content: "Great film.",
						createdAt: expect.any(String),
					}),
				}),
			);
			expect(mockPrismaService.note.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						rkey: "testtid123",
						uri: "at://did:plc:abc123/xyz.opnshelf.note/testtid123",
						cid: "cid-new",
						userDid: session.did,
						content: "Great film.",
						seasonNumber: 0,
						episodeNumber: 0,
					}),
				}),
			);
			expect(result.content).toBe("Great film.");
		});
	});

	describe("upsertNote - update path", () => {
		it("updates the existing note in the PDS reusing its rkey and preserving createdAt", async () => {
			const existing = {
				id: "note-1",
				rkey: "existing-rkey",
				createdAt: new Date("2024-01-01T00:00:00.000Z"),
				content: "old",
			};
			mockPrismaService.note.findUnique.mockResolvedValue(existing);
			mockPutRecord.mockResolvedValue({
				data: {
					uri: "at://did:plc:abc123/xyz.opnshelf.note/existing-rkey",
					cid: "cid-updated",
				},
			});
			mockPrismaService.note.update.mockImplementation(
				({ data }: { data: Record<string, unknown> }) => ({
					id: existing.id,
					rkey: existing.rkey,
					...data,
				}),
			);

			const result = await service.upsertNote(session.did, session, {
				mediaType: "movie",
				mediaId: "123",
				content: "new content",
			});

			expect(mockPutRecord).toHaveBeenCalledWith(
				expect.objectContaining({
					rkey: "existing-rkey",
					collection: "xyz.opnshelf.note",
					record: expect.objectContaining({
						content: "new content",
						createdAt: "2024-01-01T00:00:00.000Z",
					}),
				}),
			);
			expect(mockPrismaService.note.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: "note-1" },
					data: expect.objectContaining({
						content: "new content",
						cid: "cid-updated",
					}),
				}),
			);
			expect(mockPrismaService.note.create).not.toHaveBeenCalled();
			expect(result.content).toBe("new content");
		});

		it("looks up the existing note by the composite unique key", async () => {
			mockPrismaService.note.findUnique.mockResolvedValue(null);
			mockPutRecord.mockResolvedValue({
				data: { uri: "at://uri", cid: "cid" },
			});
			mockPrismaService.note.create.mockImplementation(
				({ data }: { data: Record<string, unknown> }) => data,
			);

			await service.upsertNote(session.did, session, {
				mediaType: "episode",
				mediaId: "999",
				seasonNumber: 2,
				episodeNumber: 4,
				content: "x",
			});

			expect(mockPrismaService.note.findUnique).toHaveBeenCalledWith({
				where: {
					userDid_mediaType_mediaId_seasonNumber_episodeNumber: {
						userDid: session.did,
						mediaType: "episode",
						mediaId: "999",
						seasonNumber: 2,
						episodeNumber: 4,
					},
				},
			});
		});
	});

	describe("deleteNote - authorization + PDS delete", () => {
		it("deletes the PDS record and DB row for the owner", async () => {
			mockPrismaService.note.findFirst.mockResolvedValue({
				id: "note-1",
				rkey: "rkey-del",
				userDid: session.did,
			});
			mockPrismaService.note.delete.mockResolvedValue({});

			await service.deleteNote(session.did, session, "note-1");

			// ownership enforced via findFirst where-clause (id + userDid)
			expect(mockPrismaService.note.findFirst).toHaveBeenCalledWith({
				where: { id: "note-1", userDid: session.did },
			});
			expect(mockDeleteRecord).toHaveBeenCalledWith(
				expect.objectContaining({
					repo: session.did,
					collection: "xyz.opnshelf.note",
					rkey: "rkey-del",
				}),
			);
			expect(mockPrismaService.note.delete).toHaveBeenCalledWith({
				where: { id: "note-1" },
			});
		});

		it("throws NotFoundException and skips the PDS delete when a non-owner tries to delete", async () => {
			// the note exists but belongs to someone else -> scoped findFirst returns null
			mockPrismaService.note.findFirst.mockResolvedValue(null);

			await expect(
				service.deleteNote("did:plc:intruder", session, "note-1"),
			).rejects.toThrow(NotFoundException);

			expect(mockPrismaService.note.findFirst).toHaveBeenCalledWith({
				where: { id: "note-1", userDid: "did:plc:intruder" },
			});
			expect(mockDeleteRecord).not.toHaveBeenCalled();
			expect(mockPrismaService.note.delete).not.toHaveBeenCalled();
		});
	});

	describe("getUserNotes", () => {
		it("paginates with take=limit+1 and exposes the next cursor when there are more", async () => {
			const rows = [
				{
					id: "n1",
					mediaType: "movie",
					mediaId: "1",
					content: "a",
					updatedAt: new Date(),
				},
				{
					id: "n2",
					mediaType: "movie",
					mediaId: "2",
					content: "b",
					updatedAt: new Date(),
				},
			];
			// limit 1 -> take 2; returning 2 rows signals hasMore
			mockPrismaService.note.findMany.mockResolvedValue(rows);
			mockPrismaService.note.count.mockResolvedValue(5);
			mockPrismaService.movie.findMany.mockResolvedValue([
				{ movieId: "1", title: "One", posterPath: "/one.jpg" },
			]);
			mockPrismaService.show.findMany.mockResolvedValue([]);

			const result = await service.getUserNotes(session.did, 1);

			expect(mockPrismaService.note.findMany).toHaveBeenCalledWith(
				expect.objectContaining({ take: 2, where: { userDid: session.did } }),
			);
			expect(result.items).toHaveLength(1);
			expect(result.nextCursor).toBe("n1");
			expect(result.total).toBe(5);
			// movie note enriched with its title/poster
			expect(result.items[0]).toMatchObject({
				id: "n1",
				title: "One",
				posterPath: "/one.jpg",
			});
		});

		it("returns a null cursor when the page is not full", async () => {
			mockPrismaService.note.findMany.mockResolvedValue([
				{
					id: "n1",
					mediaType: "show",
					mediaId: "9",
					content: "a",
					updatedAt: new Date(),
				},
			]);
			mockPrismaService.note.count.mockResolvedValue(1);
			mockPrismaService.movie.findMany.mockResolvedValue([]);
			mockPrismaService.show.findMany.mockResolvedValue([]);

			const result = await service.getUserNotes(session.did, 20);

			expect(result.nextCursor).toBeNull();
			expect(result.items).toHaveLength(1);
		});
	});
});
