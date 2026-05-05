import { Agent } from "@atproto/api";
import { TID } from "@atproto/common";
import { Injectable, NotFoundException } from "@nestjs/common";
import {
	$nsid as NOTE_COLLECTION,
	main as noteSchema,
} from "../lexicons/xyz/opnshelf/note";
import type { Main as NoteRecord } from "../lexicons/xyz/opnshelf/note.defs";
import { PrismaService } from "../prisma/prisma.service";
import type { UpsertNoteDto } from "./dto/note.dto";

export interface ATSession {
	did: string;
}

@Injectable()
export class NotesService {
	constructor(private prisma: PrismaService) {}

	async getNote(
		userDid: string,
		mediaType: "movie" | "show" | "season" | "episode",
		mediaId: string,
		seasonNumber?: number,
		episodeNumber?: number,
	) {
		return this.prisma.note.findUnique({
			where: {
				userDid_mediaType_mediaId_seasonNumber_episodeNumber: {
					userDid,
					mediaType,
					mediaId,
					seasonNumber: seasonNumber ?? 0,
					episodeNumber: episodeNumber ?? 0,
				},
			},
		});
	}

	async upsertNote(userDid: string, session: ATSession, dto: UpsertNoteDto) {
		const existing = await this.prisma.note.findUnique({
			where: {
				userDid_mediaType_mediaId_seasonNumber_episodeNumber: {
					userDid,
					mediaType: dto.mediaType,
					mediaId: dto.mediaId,
					seasonNumber: dto.seasonNumber ?? 0,
					episodeNumber: dto.episodeNumber ?? 0,
				},
			},
		});

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		if (existing) {
			// Update existing note in PDS
			const record: NoteRecord = noteSchema.build({
				mediaType: dto.mediaType,
				mediaId: dto.mediaId,
				seasonNumber: dto.seasonNumber,
				episodeNumber: dto.episodeNumber,
				content: dto.content,
				createdAt: existing.createdAt.toISOString(),
			});

			const response = await agent.com.atproto.repo.putRecord({
				repo: session.did,
				collection: NOTE_COLLECTION,
				rkey: existing.rkey,
				record,
				validate: false,
			});

			const updated = await this.prisma.note.update({
				where: { id: existing.id },
				data: {
					cid: response.data.cid,
					content: dto.content,
				},
			});

			return updated;
		}

		// Create new note
		const rkey = TID.nextStr();
		const now = new Date().toISOString();

		const record: NoteRecord = noteSchema.build({
			mediaType: dto.mediaType,
			mediaId: dto.mediaId,
			seasonNumber: dto.seasonNumber,
			episodeNumber: dto.episodeNumber,
			content: dto.content,
			createdAt: now,
		});

		const response = await agent.com.atproto.repo.putRecord({
			repo: session.did,
			collection: NOTE_COLLECTION,
			rkey,
			record,
			validate: false,
		});

		const note = await this.prisma.note.create({
			data: {
				rkey,
				uri: response.data.uri,
				cid: response.data.cid,
				userDid,
				mediaType: dto.mediaType,
				mediaId: dto.mediaId,
				seasonNumber: dto.seasonNumber ?? 0,
				episodeNumber: dto.episodeNumber ?? 0,
				content: dto.content,
			},
		});

		return note;
	}

	async deleteNote(
		userDid: string,
		session: ATSession,
		noteId: string,
	): Promise<void> {
		const note = await this.prisma.note.findFirst({
			where: { id: noteId, userDid },
		});

		if (!note) {
			throw new NotFoundException("Note not found");
		}

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		await agent.com.atproto.repo.deleteRecord({
			repo: session.did,
			collection: NOTE_COLLECTION,
			rkey: note.rkey,
		});

		await this.prisma.note.delete({
			where: { id: noteId },
		});
	}

	async indexNoteRecord(
		uri: string,
		cid: string,
		rkey: string,
		userDid: string,
		record: NoteRecord,
	): Promise<void> {
		await this.prisma.note.upsert({
			where: { rkey },
			create: {
				rkey,
				uri,
				cid,
				userDid,
				mediaType: record.mediaType,
				mediaId: record.mediaId,
				seasonNumber: record.seasonNumber ?? 0,
				episodeNumber: record.episodeNumber ?? 0,
				content: record.content,
			},
			update: {
				cid,
				mediaType: record.mediaType,
				mediaId: record.mediaId,
				seasonNumber: record.seasonNumber ?? 0,
				episodeNumber: record.episodeNumber ?? 0,
				content: record.content,
			},
		});
	}

	async deleteNoteRecord(rkey: string): Promise<void> {
		await this.prisma.note.deleteMany({
			where: { rkey },
		});
	}
}
