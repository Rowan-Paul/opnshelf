import type { Prisma } from "../generated/client";
import type { PrismaService } from "../prisma/prisma.service";

export type ProjectionSource = "repository" | "stream";

/** Commit a stream projection only before the owner's privacy handover.
 * Metadata fetching belongs before this short transaction. */
export async function projectContent(
	prisma: PrismaService,
	did: string,
	keys: string[],
	source: ProjectionSource,
	write: (db: Prisma.TransactionClient) => Promise<unknown>,
) {
	if (source === "repository") {
		await write(prisma);
		return;
	}
	await prisma.$transaction(async (tx) => {
		const owners = await tx.$queryRaw<
			{ did: string }[]
		>`SELECT did FROM "User" WHERE did = ${did} FOR UPDATE`;
		if (!owners.length) return;
		const managed = await tx.privacyScope.findFirst({
			where: { userDid: did, key: { in: keys }, managed: true },
			select: { id: true },
		});
		if (!managed) await write(tx);
	});
}
