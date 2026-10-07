import {
	ConflictException,
	ServiceUnavailableException,
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { AUTH_SERVICE } from "../auth/auth.tokens";
import type { AuthService } from "../auth/auth.service";
import { includesWatchSpaceGrant } from "../auth/oauth-scopes";
import { PrismaService } from "../prisma/prisma.service";
import type { Prisma } from "../generated/client";
import { MoviesService } from "../movies/movies.service";
import { ShowsService } from "../shows/shows.service";
import { main as movieSchema } from "../lexicons/xyz/opnshelf/movie";
import { main as episodeSchema } from "../lexicons/xyz/opnshelf/episode";
import { WatchPrivacyCoordinator } from "./watch-privacy-coordinator";
import {
	WatchMigrationPds,
	WatchMigrationPdsError,
} from "./watch-migration-pds";
import { requireWatchSession } from "./watch-operation";
import { PrismaWatchMigrationJournal } from "./watch-migration-journal";
import {
	WATCH_COLLECTIONS,
	WatchMigrationConflict,
	moveWatchToPrivate,
	moveWatchToPublic,
	type WatchVisibility,
} from "./watch-record-migration";

type Snapshot = Awaited<ReturnType<WatchMigrationPds["list"]>>["records"];

@Injectable()
export class WatchPrivacyService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly coordinator: WatchPrivacyCoordinator,
		@Inject(AUTH_SERVICE) private readonly auth: Pick<AuthService, "restore">,
		private readonly movies: MoviesService,
		private readonly shows: ShowsService,
	) {}

	async status(did: string, session: unknown) {
		const user = await this.prisma.user.findUnique({
			where: { did },
			select: {
				watchVisibility: true,
				watchSyncedAt: true,
				watchSyncError: true,
				watchPrivacyMigration: { include: { job: true } },
			},
		});
		if (!user) throw new NotFoundException("Account not found");
		const connected = includesWatchSpaceGrant(
			(await requireWatchSession(session).getTokenInfo()).scope,
		);
		const migration = user.watchPrivacyMigration;
		return {
			visibility: user.watchVisibility,
			connected,
			lastSyncedAt: user.watchSyncedAt?.toISOString() ?? null,
			syncError: user.watchSyncError,
			migration: migration
				? {
						id: migration.jobId,
						target: migration.targetVisibility,
						status: migration.job.status,
						copied: await this.prisma.watchPrivacyCopy.count({
							where: { jobId: migration.jobId },
						}),
						error: migration.job.lastError,
					}
				: null,
		};
	}
	async start(
		did: string,
		session: unknown,
		target: WatchVisibility,
		confirmed: boolean,
	) {
		const current = await this.prisma.user.findUniqueOrThrow({
			where: { did },
			select: { watchVisibility: true, watchPrivacyMigration: true },
		});
		if (!current.watchPrivacyMigration && current.watchVisibility === target)
			return this.status(did, session);
		const watchSession = requireWatchSession(session);
		if (!includesWatchSpaceGrant((await watchSession.getTokenInfo()).scope))
			throw new ForbiddenException(
				"Authorize Private data access before changing privacy.",
			);
		const pds = new WatchMigrationPds(did, watchSession);
		// Space creation belongs to the accepted job, after local policy checks.
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
		await this.coordinator.start(did, target, confirmed);
		return this.status(did, session);
	}
	async retry(did: string, session: unknown) {
		const migration = await this.prisma.watchPrivacyMigration.findUnique({
			where: { userDid: did },
		});
		if (!migration) throw new NotFoundException("Privacy change not found");
		await this.coordinator.retry(did, migration.jobId);
		return this.status(did, session);
	}
	async sync(did: string, session: unknown) {
		await this.coordinator.write(did, async (visibility, signal) => {
			const pds = new WatchMigrationPds(
				did,
				requireWatchSession(session),
				signal,
			);
			if (visibility === "private") await pds.assertExistingPrivate();
			const records = await this.snapshot(pds, visibility);
			await this.index(did, records, signal);
			if (visibility === "private") await pds.assertExistingPrivate();
			signal.throwIfAborted();
			await this.prisma.$transaction((tx) => this.reconcile(tx, did, records));
		});
		return this.status(did, session);
	}

	/** One account per tick, with small record batches and durable retry state. */
	async tick() {
		const migration = await this.prisma.watchPrivacyMigration.findFirst({
			where: { job: { status: { in: ["queued", "running"] } } },
			orderBy: { job: { updatedAt: "asc" } },
		});
		if (migration) await this.runMigration(migration);
		await this.syncNext();
	}
	async runMigration(migration: { userDid: string; jobId: string }) {
		const did = migration.userDid;
		let ready = false;
		await this.coordinator.batch(
			did,
			migration.jobId,
			async (target, signal) => {
				const pds = new WatchMigrationPds(
					did,
					requireWatchSession(await this.auth.restore(did)),
					signal,
				);
				if (target === "private") await pds.assertPrivate();
				else {
					await pds.assertExistingPrivate();
				}
				const journal = new PrismaWatchMigrationJournal(
					this.prisma,
					migration.jobId,
					did,
					target,
				);
				for (const collection of WATCH_COLLECTIONS) {
					// Always re-list the first page: deleting sources invalidates offset cursors.
					const page = await pds.list(
						collection,
						target === "public",
						undefined,
						5,
					);
					if (page.records.length) {
						for (const record of page.records) {
							// Prepare the owner projection before source deletion. It remains
							// hidden and immutable to interactive callers until verification.
							await this.index(
								did,
								[
									{
										...record,
										uri:
											target === "private"
												? `${pds.space}/${did}/${record.collection}/${record.rkey}`
												: `at://${did}/${record.collection}/${record.rkey}`,
									},
								],
								signal,
							);
							if (target === "private")
								await moveWatchToPrivate(record, pds, journal);
							else await moveWatchToPublic(record, pds, journal);
						}
						return;
					}
				}
				ready = true;
			},
		);
		if (ready) {
			let verifiedRecords: Snapshot = [];
			try {
				await this.coordinator.finish(
					did,
					migration.jobId,
					async (tx) => this.reconcile(tx, did, verifiedRecords),
					async (target, signal) => {
						const pds = new WatchMigrationPds(
							did,
							requireWatchSession(await this.auth.restore(did)),
							signal,
						);
						await pds.assertExistingPrivate();
						const records = await this.snapshot(pds, target);
						const receipts = await this.prisma.watchPrivacyCopy.findMany({
							where: { jobId: migration.jobId },
						});
						const cids = new Map(
							records.map((record) => [
								`${record.collection}/${record.rkey}`,
								record.cid,
							]),
						);
						for (const receipt of receipts)
							if (
								cids.get(`${receipt.collection}/${receipt.rkey}`) !==
								receipt.cid
							)
								throw new WatchMigrationConflict();
						// Populate catalogue and projections while the account remains hidden.
						await this.index(did, records, signal);
						// Verify complete destination again after metadata requests and before
						// discarding the journal. Other apps can change either repository.
						const checked = await this.snapshot(pds, target);
						if (
							checked.length !== records.length ||
							checked.some(
								(record) =>
									cids.get(`${record.collection}/${record.rkey}`) !==
									record.cid,
							)
						)
							throw new WatchMigrationConflict();
						for (const collection of WATCH_COLLECTIONS)
							if (
								(await pds.list(collection, target === "public", undefined, 1))
									.records.length
							)
								throw new WatchMigrationConflict();
						await pds.assertExistingPrivate();
						verifiedRecords = records;
					},
				);
			} catch (error) {
				if (
					!(
						error instanceof ConflictException ||
						error instanceof ServiceUnavailableException
					)
				)
					await this.prisma.backgroundJob.updateMany({
						where: { id: migration.jobId, status: "queued" },
						data: {
							status: "failed",
							lastError:
								error instanceof WatchMigrationConflict
									? "Watch records changed in another app. Resolve the conflicting records, then resume this privacy change. Recovery copies were retained."
									: "Verification stopped safely. Reconnect and retry; recovery copies were retained.",
						},
					});
				throw error;
			}
		}
	}
	private async syncNext() {
		const owner = await this.prisma.user.findFirst({
			where: {
				watchPrivacyManaged: true,
				AND: [
					{
						OR: [{ watchVisibility: "public" }, { watchPrivacyEnabled: true }],
					},
				],
				watchPrivacyMigration: { is: null },
				OR: [
					{ watchSyncAttemptedAt: null },
					{ watchSyncAttemptedAt: { lt: new Date(Date.now() - 60_000) } },
				],
			},
			orderBy: { watchSyncAttemptedAt: { sort: "asc", nulls: "first" } },
			select: { did: true },
		});
		if (!owner) return;
		try {
			await this.sync(owner.did, await this.auth.restore(owner.did));
		} catch (error) {
			await this.prisma.user.updateMany({
				where: { did: owner.did },
				data: {
					watchSyncAttemptedAt: new Date(),
					...(error instanceof ConflictException ||
					error instanceof ServiceUnavailableException
						? {}
						: {
								watchSyncError:
									"Watch sync paused. Authorize Private data access and retry.",
							}),
				},
			});
			if (
				!(
					error instanceof ConflictException ||
					error instanceof ServiceUnavailableException
				)
			)
				throw error;
		}
	}
	private async snapshot(
		pds: WatchMigrationPds,
		visibility: WatchVisibility,
	): Promise<Snapshot> {
		const records: Snapshot = [];
		for (const collection of WATCH_COLLECTIONS) {
			let cursor: string | undefined;
			const seen = new Set<string>();
			do {
				const page = await pds.list(
					collection,
					visibility === "private",
					cursor,
				);
				records.push(...page.records);
				cursor = page.cursor;
				if (cursor && seen.has(cursor))
					throw new Error("PDS repeated a Watch cursor");
				if (cursor) seen.add(cursor);
			} while (cursor);
		}
		if (
			new Set(records.map((r) => `${r.collection}/${r.rkey}`)).size !==
			records.length
		)
			throw new Error("PDS returned duplicate Watches");
		return records;
	}
	private async index(did: string, records: Snapshot, signal: AbortSignal) {
		for (const record of records) {
			signal.throwIfAborted();
			if (record.collection === "xyz.opnshelf.movie") {
				const value = movieSchema.parse(record.value);
				const existing = await this.prisma.trackedMovie.findUnique({
					where: { userDid_rkey: { userDid: did, rkey: record.rkey } },
					select: { cid: true, uri: true },
				});
				if (existing?.cid === record.cid && existing.uri === record.uri)
					continue;
				const data = {
					uri: record.uri,
					cid: record.cid,
					movieId: value.movieId,
					watchedDate: value.watchedAt ? new Date(value.watchedAt) : null,
					status: "watched",
				};
				if (
					await this.prisma.movie.findUnique({
						where: { movieId: value.movieId },
						select: { movieId: true },
					})
				) {
					await this.prisma.trackedMovie.upsert({
						where: { userDid_rkey: { userDid: did, rkey: record.rkey } },
						create: { ...data, userDid: did, rkey: record.rkey },
						update: data,
					});
				} else
					await this.movies.indexTrackedMovie(
						record.uri,
						record.cid,
						record.rkey,
						did,
						value.movieId,
						value.watchedAt,
					);
			} else {
				const value = episodeSchema.parse(record.value);
				const existing = await this.prisma.trackedEpisode.findUnique({
					where: { userDid_rkey: { userDid: did, rkey: record.rkey } },
					select: { cid: true, uri: true },
				});
				if (existing?.cid === record.cid && existing.uri === record.uri)
					continue;
				const data = {
					uri: record.uri,
					cid: record.cid,
					showId: value.showId,
					seasonNumber: value.seasonNumber,
					episodeNumber: value.episodeNumber,
					watchedDate: value.watchedAt ? new Date(value.watchedAt) : null,
					status: "watched",
				};
				if (
					await this.prisma.show.findUnique({
						where: { showId: value.showId },
						select: { showId: true },
					})
				) {
					await this.prisma.trackedEpisode.upsert({
						where: { userDid_rkey: { userDid: did, rkey: record.rkey } },
						create: { ...data, userDid: did, rkey: record.rkey },
						update: data,
					});
				} else
					await this.shows.indexTrackedEpisode(
						record.uri,
						record.cid,
						record.rkey,
						did,
						value.showId,
						value.seasonNumber,
						value.episodeNumber,
						value.watchedAt,
					);
			}
		}
	}
	private async reconcile(
		tx: Prisma.TransactionClient,
		did: string,
		records: Snapshot,
	) {
		await tx.trackedMovie.deleteMany({
			where: {
				userDid: did,
				rkey: {
					notIn: records
						.filter((r) => r.collection === "xyz.opnshelf.movie")
						.map((r) => r.rkey),
				},
			},
		});
		await tx.trackedEpisode.deleteMany({
			where: {
				userDid: did,
				rkey: {
					notIn: records
						.filter((r) => r.collection === "xyz.opnshelf.episode")
						.map((r) => r.rkey),
				},
			},
		});
		await tx.user.update({
			where: { did },
			data: {
				watchSyncedAt: new Date(),
				watchSyncAttemptedAt: new Date(),
				watchSyncError: null,
			},
		});
	}
}
