import { Injectable } from "@nestjs/common";
import type { Prisma } from "../generated/client";
import { PrismaService } from "../prisma/prisma.service";
import { LibraryService } from "../library/library.service";
import { NotesService } from "../notes/notes.service";
import { ListsService } from "../lists/lists.service";
import { main as librarySchema } from "../lexicons/xyz/opnshelf/library/item";
import { main as noteSchema } from "../lexicons/xyz/opnshelf/note";
import { main as listSchema } from "../lexicons/xyz/opnshelf/list";
import { main as itemSchema } from "../lexicons/xyz/opnshelf/list/item";
import type { WatchMigrationPds } from "./watch-migration-pds";
import type { ContentCategory } from "./content-privacy-coordinator";
export type ContentSnapshot = Awaited<
	ReturnType<WatchMigrationPds["list"]>
>["records"];
@Injectable()
export class ContentPrivacyProjection {
	constructor(
		private readonly prisma: PrismaService,
		private readonly library: LibraryService,
		private readonly notes: NotesService,
		private readonly lists: ListsService,
	) {}
	async index(did: string, records: ContentSnapshot, signal: AbortSignal) {
		// Lists precede their items, so every item resolves its stable parent key.
		for (const record of records) {
			signal.throwIfAborted();
			const args = [record.uri, record.cid, record.rkey, did] as const;
			const identity = { userDid_rkey: { userDid: did, rkey: record.rkey } };
			switch (record.collection) {
				case "xyz.opnshelf.library.item":
					await this.library.indexLibraryItemRecord(
						...args,
						librarySchema.parse(record.value),
					);
					await this.prisma.libraryItem.update({
						where: identity,
						data: { uri: record.uri },
					});
					break;
				case "xyz.opnshelf.note":
					await this.notes.indexNoteRecord(
						...args,
						noteSchema.parse(record.value),
					);
					await this.prisma.note.update({
						where: identity,
						data: { uri: record.uri },
					});
					break;
				case "xyz.opnshelf.list":
					await this.lists.indexListRecord(
						...args,
						listSchema.parse(record.value),
					);
					await this.prisma.list.update({
						where: identity,
						data: { uri: record.uri },
					});
					break;
				case "xyz.opnshelf.list.item":
					await this.lists.indexListItemRecord(
						...args,
						itemSchema.parse(record.value),
					);
					await this.prisma.listItem.update({
						where: identity,
						data: { uri: record.uri },
					});
					break;
				default:
					throw new Error("Unexpected category record");
			}
		}
	}
	async reconcile(
		tx: Prisma.TransactionClient,
		did: string,
		category: ContentCategory,
		records: ContentSnapshot,
		listRkey?: string | null,
	) {
		const keys = (collection: string) =>
			records.filter((r) => r.collection === collection).map((r) => r.rkey);
		if (category === "library")
			await tx.libraryItem.deleteMany({
				where: {
					userDid: did,
					rkey: { notIn: keys("xyz.opnshelf.library.item") },
				},
			});
		else if (category === "notes")
			await tx.note.deleteMany({
				where: { userDid: did, rkey: { notIn: keys("xyz.opnshelf.note") } },
			});
		else {
			if (!listRkey) throw new Error("Missing List scope");
			await tx.listItem.deleteMany({
				where: {
					userDid: did,
					list: { userDid: did, rkey: listRkey },
					rkey: { notIn: keys("xyz.opnshelf.list.item") },
				},
			});
			if (!keys("xyz.opnshelf.list").includes(listRkey))
				await tx.list.deleteMany({ where: { userDid: did, rkey: listRkey } });
		}
	}
}
