import { Prisma } from "../generated/client";
import type { PrismaService } from "../prisma/prisma.service";
import {
	WatchMigrationConflict,
	type WatchMigrationJournal,
	type WatchMoveReceipt,
	type WatchReference,
	type WatchVisibility,
} from "./watch-record-migration";

/** Immutable recovery copies belong to one category migration generation. */
export class ContentPrivacyJournal implements WatchMigrationJournal {
	constructor(
		private readonly prisma: PrismaService,
		private readonly scopeId: string,
		private readonly migrationId: string,
		private readonly ownerDid: string,
		private readonly target: WatchVisibility,
	) {}
	async assertDirection(target: WatchVisibility) {
		if (
			target !== this.target ||
			!(await this.prisma.privacyScope.findFirst({
				where: {
					id: this.scopeId,
					userDid: this.ownerDid,
					migrationId: this.migrationId,
					targetVisibility: target,
					status: "running",
				},
				select: { id: true },
			}))
		)
			throw new Error("Privacy migration generation changed");
	}
	async load(ref: WatchReference) {
		await this.assertDirection(this.target);
		const copy = await this.prisma.privacyCopy.findUnique({
			where: { scopeId_collection_rkey: { scopeId: this.scopeId, ...ref } },
		});
		if (!copy) return undefined;
		if (
			copy.migrationId !== this.migrationId ||
			!copy.value ||
			typeof copy.value !== "object" ||
			Array.isArray(copy.value)
		)
			throw new Error("Invalid privacy recovery copy");
		return { ...ref, cid: copy.cid, value: copy.value };
	}
	async recordVerifiedCopy(receipt: WatchMoveReceipt) {
		await this.prisma.$transaction(async (tx) => {
			const rows = await tx.$queryRaw<
				{ id: string }[]
			>`SELECT id FROM "PrivacyScope" WHERE id=${this.scopeId} AND "userDid"=${this.ownerDid} AND "migrationId"=${this.migrationId} AND "targetVisibility"=${this.target} AND status='running' FOR UPDATE`;
			if (!rows.length) throw new Error("Privacy migration generation changed");
			await tx.privacyCopy.createMany({
				data: [
					{
						scopeId: this.scopeId,
						migrationId: this.migrationId,
						collection: receipt.collection,
						rkey: receipt.rkey,
						cid: receipt.cid,
						value: receipt.value as Prisma.InputJsonObject,
					},
				],
				skipDuplicates: true,
			});
			const copy = await tx.privacyCopy.findUniqueOrThrow({
				where: {
					scopeId_collection_rkey: {
						scopeId: this.scopeId,
						collection: receipt.collection,
						rkey: receipt.rkey,
					},
				},
			});
			if (copy.migrationId !== this.migrationId || copy.cid !== receipt.cid)
				throw new WatchMigrationConflict();
		});
	}
}
