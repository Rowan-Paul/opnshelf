import { Test, type TestingModule } from "@nestjs/testing";

vi.mock("../prisma/prisma.service", () => ({
	PrismaService: vi.fn(),
}));

const mockPutRecord = vi.fn();
const mockDeleteRecord = vi.fn();
vi.mock("@atproto/api", () => ({
	Agent: vi.fn().mockImplementation(() => ({
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

vi.mock("@atproto/common", () => ({
	TID: {
		nextStr: vi.fn(() => "testtid123"),
	},
}));

vi.mock("../lexicons/xyz/opnshelf/note", () => ({
	main: {
		build: vi.fn((data: Record<string, unknown>) => ({
			$type: "xyz.opnshelf.note",
			...data,
		})),
		parse: vi.fn((data: Record<string, unknown>) => data),
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
			findUnique: vi.fn(),
			findFirst: vi.fn(),
			findMany: vi.fn(),
			count: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
			deleteMany: vi.fn(),
			upsert: vi.fn(),
		},
		movie: { findMany: vi.fn() },
		show: { findMany: vi.fn() },
	};

	const session: ATSession = { did: "did:plc:abc123" };

	beforeEach(async () => {
		vi.clearAllMocks();
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
		it("returns the requested page window with page metadata", async () => {
			const rows = [
				{
					id: "n1",
					mediaType: "movie",
					mediaId: "1",
					content: "a",
					updatedAt: new Date(),
				},
			];
			mockPrismaService.note.count.mockResolvedValue(5);
			mockPrismaService.note.findMany.mockResolvedValue(rows);
			mockPrismaService.movie.findMany.mockResolvedValue([
				{ movieId: "1", title: "One", posterPath: "/one.jpg" },
			]);
			mockPrismaService.show.findMany.mockResolvedValue([]);

			const result = await service.getUserNotes(session.did, 2, 1);

			expect(mockPrismaService.note.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { userDid: session.did },
					skip: 1,
					take: 1,
				}),
			);
			expect(result.items).toHaveLength(1);
			expect(result.pagination).toEqual({
				total: 5,
				page: 2,
				pageSize: 1,
				totalPages: 5,
				hasNextPage: true,
				hasPreviousPage: true,
			});
			// movie note enriched with its title/poster
			expect(result.items[0]).toMatchObject({
				id: "n1",
				title: "One",
				posterPath: "/one.jpg",
			});
		});

		it("reports no next page once the last page is returned", async () => {
			mockPrismaService.note.count.mockResolvedValue(1);
			mockPrismaService.note.findMany.mockResolvedValue([
				{
					id: "n1",
					mediaType: "show",
					mediaId: "9",
					content: "x",
					updatedAt: new Date(),
				},
			]);
			mockPrismaService.movie.findMany.mockResolvedValue([]);
			mockPrismaService.show.findMany.mockResolvedValue([]);

			const result = await service.getUserNotes(session.did);

			expect(result.pagination.hasNextPage).toBe(false);
			expect(result.pagination.pageSize).toBe(20);
			expect(result.items).toHaveLength(1);
		});
	});
});
