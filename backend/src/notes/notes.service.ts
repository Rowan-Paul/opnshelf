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

	async getUserNotes(userDid: string, limit: number = 20, cursor?: string) {
		const take = limit + 1;

		const notes = await this.prisma.note.findMany({
			where: { userDid },
			orderBy: { updatedAt: "desc" },
			take,
			...(cursor && {
				skip: 1,
				cursor: { id: cursor },
			}),
		});

		const hasMore = notes.length > limit;
		const items = hasMore ? notes.slice(0, limit) : notes;
		const nextCursor = hasMore ? items[items.length - 1]?.id : null;

		const total = await this.prisma.note.count({
			where: { userDid },
		});

		// Fetch related movie/show data for each note
		const movieIds = items
			.filter((n) => n.mediaType === "movie")
			.map((n) => n.mediaId);
		const showIds = items
			.filter((n) => n.mediaType !== "movie")
			.map((n) => n.mediaId);

		const [movies, shows] = await Promise.all([
			movieIds.length > 0
				? this.prisma.movie.findMany({
						where: { movieId: { in: movieIds } },
					})
				: Promise.resolve([]),
			showIds.length > 0
				? this.prisma.show.findMany({
						where: { showId: { in: showIds } },
					})
				: Promise.resolve([]),
		]);

		const movieMap = new Map<
			string,
			{ title: string; posterPath: string | null }
		>();
		for (const m of movies) {
			movieMap.set(m.movieId, { title: m.title, posterPath: m.posterPath });
		}
		const showMap = new Map<
			string,
			{ title: string; posterPath: string | null }
		>();
		for (const s of shows) {
			showMap.set(s.showId, { title: s.title, posterPath: s.posterPath });
		}

		const enrichedItems = items.map((note) => {
			const media =
				note.mediaType === "movie"
					? movieMap.get(note.mediaId)
					: showMap.get(note.mediaId);
			return {
				...note,
				title: media?.title,
				posterPath: media?.posterPath,
			};
		});

		return {
			items: enrichedItems,
			nextCursor,
			total,
		};
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
