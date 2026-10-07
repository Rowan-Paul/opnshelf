import {
	ConflictException,
	ForbiddenException,
	Injectable,
	Logger,
	Inject,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import { AUTH_SERVICE } from "../auth/auth.tokens";
import type { AuthService } from "../auth/auth.service";
import { includesWatchSpaceGrant } from "../auth/oauth-scopes";
import { PrismaService } from "../prisma/prisma.service";
import type { PrivacyScope } from "../generated/client";
import { WatchAccountLock } from "./watch-account-lock";
import {
	WatchMigrationPds,
	WatchMigrationPdsError,
} from "./watch-migration-pds";
import { requireWatchSession } from "./watch-operation";
import {
	ContentPrivacyCoordinator,
	visibility,
	type ContentCategory,
} from "./content-privacy-coordinator";
import { ContentPrivacyJournal } from "./content-privacy-journal";
import {
	ContentPrivacyProjection,
	type ContentSnapshot,
} from "./content-privacy-projection";
import {
	privacyRepositoryConfig,
	type PrivacyVisibility,
} from "./privacy-category";
import {
	moveWatchToPrivate,
	moveWatchToPublic,
	WatchMigrationConflict,
} from "./watch-record-migration";

function categoryOf(state: PrivacyScope): ContentCategory {
	if (
		state.category !== "library" &&
		state.category !== "notes" &&
		state.category !== "lists"
	)
		throw new Error("Invalid privacy category");
	return state.category;
}
function sameSnapshot(a: ContentSnapshot, b: ContentSnapshot) {
	const cids = new Map(a.map((r) => [`${r.collection}/${r.rkey}`, r.cid]));
	return (
		a.length === b.length &&
		b.every((r) => cids.get(`${r.collection}/${r.rkey}`) === r.cid)
	);
}
function busy(error: unknown) {
	return (
		error instanceof ConflictException ||
		error instanceof ServiceUnavailableException
	);
}
@Injectable()
export class ContentPrivacyService {
	private readonly logger = new Logger(ContentPrivacyService.name);
	constructor(
		private readonly prisma: PrismaService,
		private readonly coordinator: ContentPrivacyCoordinator,
		private readonly locks: WatchAccountLock,
		private readonly projection: ContentPrivacyProjection,
		@Inject(AUTH_SERVICE) private readonly auth: Pick<AuthService, "restore">,
	) {}
	private repository(
		did: string,
		session: unknown,
		category: ContentCategory,
		listRkey?: string,
		signal?: AbortSignal,
	) {
		return new WatchMigrationPds(
			did,
			requireWatchSession(session),
			signal,
			privacyRepositoryConfig(category, listRkey),
		);
	}
	async start(
		did: string,
		session: unknown,
		category: ContentCategory,
		target: PrivacyVisibility,
		confirmed: boolean,
		listRkey?: string,
	) {
		const current = await this.coordinator.scope(did, category, listRkey);
		if (
			!current?.targetVisibility &&
			(current?.visibility ?? "public") === target
		)
			return current;
		const config = privacyRepositoryConfig(category, listRkey);
		if (
			!includesWatchSpaceGrant(
				(await requireWatchSession(session).getTokenInfo()).scope,
				config.scope,
				did,
			)
		)
			throw new ForbiddenException(
				"Authorize Private data access before continuing.",
			);
		if (
			category === "lists" &&
			!(await this.prisma.list.findUnique({
				where: { userDid_rkey: { userDid: did, rkey: listRkey! } },
				select: { id: true },
			}))
		)
			throw new NotFoundException("List not found");
		const pds = this.repository(did, session, category, listRkey);
		try {
			await pds.assertExistingPrivate();
		} catch (error) {
			if (
				!(
					target === "private" &&
					error instanceof WatchMigrationPdsError &&
					error.code === "SpaceNotFound"
				)
			)
				throw error;
		}
		return this.coordinator.start(did, category, target, confirmed, listRkey);
	}
	private async snapshot(
		pds: WatchMigrationPds,
		state: PrivacyScope,
		privateRepo: boolean,
	): Promise<ContentSnapshot> {
		const records: ContentSnapshot = [];
		for (const collection of privacyRepositoryConfig(
			categoryOf(state),
			state.listRkey ?? undefined,
		).collections) {
			let cursor: string | undefined;
			const cursors = new Set<string>();
			do {
				const page = await pds.list(collection, privateRepo, cursor);
				for (const record of page.records) {
					if (
						state.category !== "lists" ||
						(collection === "xyz.opnshelf.list"
							? record.rkey === state.listRkey
							: record.value.listRkey === state.listRkey)
					)
						records.push(record);
				}
				cursor = page.cursor;
				if (cursor && cursors.has(cursor))
					throw new Error("PDS repeated a cursor");
				if (cursor) cursors.add(cursor);
			} while (cursor);
		}
		if (
			new Set(records.map((r) => `${r.collection}/${r.rkey}`)).size !==
			records.length
		)
			throw new Error("Duplicate PDS record");
		return records;
	}
	async runMigration(id: string) {
		const initial = await this.prisma.privacyScope.findUniqueOrThrow({
			where: { id },
		});
		return this.locks.run(initial.userDid, async (lockSignal) => {
			await this.coordinator.assertAccount(initial.userDid);
			const state = await this.prisma.privacyScope.findUniqueOrThrow({
				where: { id },
			});
			if (
				!state.migrationId ||
				!state.targetVisibility ||
				!["queued", "running"].includes(state.status ?? "")
			)
				return;
			const generation = state.migrationId,
				target = visibility(state.targetVisibility);
			const signal = AbortSignal.any([lockSignal, AbortSignal.timeout(120000)]);
			await this.prisma.privacyScope.update({
				where: { id },
				data: { status: "running" },
			});
			try {
				const pds = this.repository(
					state.userDid,
					await this.auth.restore(state.userDid),
					categoryOf(state),
					state.listRkey ?? undefined,
					signal,
				);
				if (target === "private") await pds.assertPrivate();
				else await pds.assertExistingPrivate();
				const sources = await this.snapshot(pds, state, target === "public");
				const journal = new ContentPrivacyJournal(
					this.prisma,
					id,
					generation,
					state.userDid,
					target,
				);
				if (sources.length) {
					for (const record of sources.slice(0, 5)) {
						const ref = { collection: record.collection, rkey: record.rkey };
						if (target === "private")
							await moveWatchToPrivate(ref, pds, journal);
						else await moveWatchToPublic(ref, pds, journal);
					}
					signal.throwIfAborted();
					await this.prisma.privacyScope.update({
						where: { id },
						data: { status: "queued" },
					});
					return;
				}
				const destination = await this.snapshot(
					pds,
					state,
					target === "private",
				);
				const receipts = await this.prisma.privacyCopy.findMany({
					where: { scopeId: id, migrationId: generation },
				});
				const cids = new Map(
					destination.map((r) => [`${r.collection}/${r.rkey}`, r.cid]),
				);
				if (
					receipts.some((r) => cids.get(`${r.collection}/${r.rkey}`) !== r.cid)
				)
					throw new WatchMigrationConflict();
				await this.projection.index(state.userDid, destination, signal);
				if (
					!sameSnapshot(
						destination,
						await this.snapshot(pds, state, target === "private"),
					) ||
					(await this.snapshot(pds, state, target === "public")).length
				)
					throw new WatchMigrationConflict();
				await pds.assertExistingPrivate();
				signal.throwIfAborted();
				await this.prisma.$transaction(async (tx) => {
					await this.projection.reconcile(
						tx,
						state.userDid,
						categoryOf(state),
						destination,
						state.listRkey,
					);
					await tx.privacyCopy.deleteMany({
						where: { scopeId: id, migrationId: generation },
					});
					await tx.privacyScope.update({
						where: { id, migrationId: generation },
						data: {
							visibility: target,
							targetVisibility: null,
							migrationId: null,
							status: null,
							error: null,
							syncedAt: new Date(),
							syncAttemptedAt: new Date(),
						},
					});
				});
			} catch (error) {
				if (!busy(error))
					await this.prisma.privacyScope.updateMany({
						where: { id, migrationId: generation },
						data: {
							status: "failed",
							error:
								error instanceof WatchMigrationConflict
									? "Records changed in another app. Resolve the conflicting records, then resume."
									: "This privacy change stopped. Retry to continue; recovery copies were retained.",
						},
					});
				throw error;
			}
		});
	}
	async sync(id: string) {
		const initial = await this.prisma.privacyScope.findUniqueOrThrow({
			where: { id },
		});
		return this.locks.run(initial.userDid, async (lockSignal) => {
			await this.coordinator.assertAccount(initial.userDid);
			const state = await this.prisma.privacyScope.findUniqueOrThrow({
				where: { id },
			});
			if (state.targetVisibility)
				throw new ConflictException("Privacy change in progress");
			const signal = AbortSignal.any([lockSignal, AbortSignal.timeout(120000)]);
			const pds = this.repository(
				state.userDid,
				await this.auth.restore(state.userDid),
				categoryOf(state),
				state.listRkey ?? undefined,
				signal,
			);
			if (state.visibility === "private") await pds.assertExistingPrivate();
			const records = await this.snapshot(
				pds,
				state,
				state.visibility === "private",
			);
			await this.projection.index(state.userDid, records, signal);
			if (state.visibility === "private") await pds.assertExistingPrivate();
			signal.throwIfAborted();
			await this.prisma.$transaction(async (tx) => {
				await this.projection.reconcile(
					tx,
					state.userDid,
					categoryOf(state),
					records,
					state.listRkey,
				);
				await tx.privacyScope.update({
					where: { id },
					data: {
						syncedAt: new Date(),
						syncAttemptedAt: new Date(),
						error: null,
					},
				});
			});
		});
	}
	async tick() {
		const migration = await this.prisma.privacyScope.findFirst({
			where: { status: { in: ["queued", "running"] } },
			orderBy: { updatedAt: "asc" },
		});
		if (migration) {
			try {
				await this.runMigration(migration.id);
			} catch (error) {
				if (!busy(error))
					this.logger.warn(
						"Content privacy operation failed; recovery remains available.",
					);
			}
		}
		const state = await this.prisma.privacyScope.findFirst({
			where: {
				managed: true,
				targetVisibility: null,
				AND: [
					{ OR: [{ status: null }, { status: { not: "deleted" } }] },
					{
						OR: [
							{ visibility: "public" },
							{ user: { watchPrivacyEnabled: true } },
						],
					},
					{
						OR: [
							{ syncAttemptedAt: null },
							{ syncAttemptedAt: { lt: new Date(Date.now() - 60000) } },
						],
					},
				],
			},
			orderBy: { syncAttemptedAt: { sort: "asc", nulls: "first" } },
		});
		if (!state) return;
		try {
			await this.sync(state.id);
		} catch (error) {
			await this.prisma.privacyScope.updateMany({
				where: { id: state.id },
				data: {
					syncAttemptedAt: new Date(),
					...(!busy(error)
						? {
								error:
									"Sync paused. Reauthorize Private data access and retry.",
							}
						: {}),
				},
			});
			if (!busy(error))
				this.logger.warn(
					"Content privacy operation failed; recovery remains available.",
				);
		}
	}
}
