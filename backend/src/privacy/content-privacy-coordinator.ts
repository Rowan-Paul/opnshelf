import type { Prisma } from "../generated/client";
import { randomUUID } from "node:crypto";
import {
	ConflictException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WatchAccountLock } from "./watch-account-lock";
import { watchOperation } from "./watch-operation";
import {
	privacyRepositoryConfig,
	type PrivacyCategory,
	type PrivacyVisibility,
} from "./privacy-category";

export type ContentCategory = Exclude<PrivacyCategory, "watches">;
export function contentScopeKey(category: ContentCategory, listRkey?: string) {
	if (category === "lists") {
		privacyRepositoryConfig(category, listRkey);
		return `lists:${listRkey}`;
	}
	return category;
}
export function visibility(value: string): PrivacyVisibility {
	if (value !== "public" && value !== "private")
		throw new Error("Invalid privacy state");
	return value;
}
@Injectable()
export class ContentPrivacyCoordinator {
	constructor(
		private readonly prisma: PrismaService,
		private readonly locks: WatchAccountLock,
	) {}
	async assertAccount(did: string) {
		if (
			!(await this.prisma.user.findUnique({
				where: { did },
				select: { did: true },
			}))
		)
			throw new NotFoundException("Account not found");
		if (
			await this.prisma.backgroundJob.findFirst({
				where: {
					userDid: did,
					type: "account_deletion",
					status: { in: ["queued", "running", "waiting_retry", "paused"] },
				},
				select: { id: true },
			})
		)
			throw new ConflictException("Account deletion is in progress.");
	}
	async scope(did: string, category: ContentCategory, listRkey?: string) {
		return this.prisma.privacyScope.findUnique({
			where: {
				userDid_key: { userDid: did, key: contentScopeKey(category, listRkey) },
			},
		});
	}
	async write<T>(
		did: string,
		category: ContentCategory,
		listRkey: string | undefined,
		work: () => Promise<T>,
	): Promise<T> {
		const run = async (signal: AbortSignal) => {
			await this.assertAccount(did);
			const state =
				category === "lists" && !listRkey
					? null
					: await this.scope(did, category, listRkey);
			if (state?.targetVisibility)
				throw new ConflictException(
					"This category is changing privacy. Try again when it finishes.",
				);
			return watchOperation.run(
				{
					did,
					visibility: visibility(
						state?.visibility ??
							(category === "lists" && !listRkey
								? (
										await this.prisma.user.findUniqueOrThrow({
											where: { did },
											select: { listsDefaultVisibility: true },
										})
									).listsDefaultVisibility
								: "public"),
					),
					signal: AbortSignal.any([signal, AbortSignal.timeout(120000)]),
					repository: privacyRepositoryConfig(
						category,
						listRkey ?? (category === "lists" ? "new" : undefined),
					),
				},
				work,
			);
		};
		const parent = watchOperation.getStore();
		return parent?.did === did ? run(parent.signal) : this.locks.run(did, run);
	}
	async prepareNewList(did: string, rkey: string) {
		const context = watchOperation.getStore();
		if (!context || context.did !== did)
			throw new Error("List creation requires its privacy coordinator");
		context.repository = privacyRepositoryConfig("lists", rkey);
	}
	async activateNewList(did: string, rkey: string) {
		const context = watchOperation.getStore();
		if (!context || context.did !== did)
			throw new Error("List creation requires its privacy coordinator");
		if (context.visibility === "private") {
			// The caller creates the Space with its authorized session before writing.
			await this.prisma.privacyScope.upsert({
				where: {
					userDid_key: { userDid: did, key: contentScopeKey("lists", rkey) },
				},
				create: {
					userDid: did,
					key: contentScopeKey("lists", rkey),
					category: "lists",
					listRkey: rkey,
					visibility: "private",
					managed: true,
				},
				update: {},
			});
		}
	}

	async start(
		did: string,
		category: ContentCategory,
		target: PrivacyVisibility,
		confirmed: boolean,
		listRkey?: string,
		totalRecords?: number,
	) {
		this.confirmPublication(target, confirmed);
		return this.locks.run(did, async () => {
			await this.assertAccount(did);
			return this.prisma.$transaction(async (tx) => {
				await tx.$queryRaw`SELECT did FROM "User" WHERE did = ${did} FOR UPDATE`;
				return this.queue(tx, did, category, target, listRkey, totalRecords);
			});
		});
	}
	/** Acceptance is atomic: the worker cannot start one List between requests
	 * for the remaining Lists and their default. Preflight happens before this. */
	async startAllLists(
		did: string,
		rkeys: string[],
		target: PrivacyVisibility,
		confirmed: boolean,
		totals: Record<string, number | undefined> = {},
	) {
		this.confirmPublication(target, confirmed);
		return this.locks.run(did, async () => {
			await this.assertAccount(did);
			return this.prisma.$transaction(async (tx) => {
				await tx.$queryRaw`SELECT did FROM "User" WHERE did = ${did} FOR UPDATE`;
				for (const rkey of rkeys)
					await this.queue(tx, did, "lists", target, rkey, totals[rkey]);
				await tx.user.update({
					where: { did },
					data: { listsDefaultVisibility: target },
				});
			});
		});
	}
	private confirmPublication(target: PrivacyVisibility, confirmed: boolean) {
		if (target === "public" && !confirmed)
			throw new ConflictException(
				"Confirm publication before making this data Public.",
			);
	}
	private async queue(
		tx: Prisma.TransactionClient,
		did: string,
		category: ContentCategory,
		target: PrivacyVisibility,
		listRkey?: string,
		totalRecords?: number,
	) {
		const key = contentScopeKey(category, listRkey);
		const current = await tx.privacyScope.findUnique({
			where: { userDid_key: { userDid: did, key } },
		});
		if (current?.targetVisibility) {
			if (current.targetVisibility !== target)
				throw new ConflictException(
					"Finish this privacy change before reversing it.",
				);
			return current;
		}
		if ((current?.visibility ?? "public") === target) return current;
		return tx.privacyScope.upsert({
			where: { userDid_key: { userDid: did, key } },
			create: {
				userDid: did,
				key,
				category,
				listRkey,
				managed: true,
				migrationId: randomUUID(),
				targetVisibility: target,
				totalRecords: totalRecords ?? null,
				status: "queued",
			},
			update: {
				managed: true,
				migrationId: randomUUID(),
				targetVisibility: target,
				totalRecords: totalRecords ?? null,
				status: "queued",
				error: null,
			},
		});
	}
	async retry(did: string, category: ContentCategory, listRkey?: string) {
		return this.locks.run(did, async () => {
			await this.assertAccount(did);
			const current = await this.scope(did, category, listRkey);
			if (!current?.migrationId)
				throw new NotFoundException("Privacy change not found");
			return this.prisma.privacyScope.update({
				where: { id: current.id },
				data: { status: "queued", error: null },
			});
		});
	}
}
