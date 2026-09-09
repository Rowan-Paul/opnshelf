/**
 * Turns normalized import items into Watches: builds the PDS records, writes
 * them in `applyWrites` batches with deterministic rkeys, and indexes each
 * written record. Shared by the Trakt Import worker, the match/retry flows,
 * and the CSV import endpoint.
 */
import { Agent } from "@atproto/api";
import {
	BadRequestException,
	Inject,
	Injectable,
	Logger,
} from "@nestjs/common";
import { AUTH_SERVICE } from "../../auth/auth.tokens";
import type { AuthService } from "../../auth/auth.service";
import {
	deterministicEpisodeWatchRkey,
	deterministicMovieWatchRkey,
} from "../../common/watch-rkey";
import { MoviesService } from "../../movies/movies.service";
import { PrismaService } from "../../prisma/prisma.service";
import { ShowsService } from "../../shows/shows.service";
import type {
	ImportErrorDto,
	ImportHistoryResponseDto,
	NormalizedImportItemDto,
} from "../dto/import-history.dto";
import {
	PdsRateLimitError,
	type PdsRateLimitSnapshot,
	classifyImportWriteError,
	getErrorMessage,
	getPdsRetryAfterSeconds,
	isPdsRateLimitError,
	isRecordExistsError,
	reportPdsRateLimit,
} from "../import-errors";
import { buildImportKey, describeImportItem } from "../trakt-normalize";

export interface ATSession {
	did: string;
}

export type ImportWriteOptions = {
	onRateLimit?: (snapshot: PdsRateLimitSnapshot) => void;
};

/** A PDS record built and ready to write, paired with the item it came from. */
type PendingWrite = {
	itemIndex: number;
	item: NormalizedImportItemDto;
	rkey: string;
	collection: string;
	record: unknown;
} & (
	| { type: "movie"; movieTmdbId: string }
	| {
			type: "episode";
			showTmdbId: string;
			seasonNumber: number;
			episodeNumber: number;
	  }
);

type WriteResult = { uri: string; cid: string };

const PDS_APPLY_WRITES_BATCH_SIZE = 200;

@Injectable()
export class WatchImportWriter {
	private readonly logger = new Logger(WatchImportWriter.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly moviesService: MoviesService,
		private readonly showsService: ShowsService,
		@Inject(AUTH_SERVICE)
		private readonly authService: Pick<AuthService, "restore">,
	) {}

	async importNormalizedItems(
		userDid: string,
		session: ATSession,
		items: NormalizedImportItemDto[],
		options?: ImportWriteOptions,
	): Promise<ImportHistoryResponseDto> {
		if (items.length > 100) {
			throw new BadRequestException(
				"A maximum of 100 items can be imported per request",
			);
		}

		const built = await this.buildPendingWrites(userDid, items);
		const { pendingWrites } = built;
		let imported = 0;
		let skipped = built.skipped;
		let failed = built.failed;
		const errors: ImportErrorDto[] = [...built.errors];

		if (pendingWrites.length === 0) {
			return { imported, skipped, failed, errors };
		}

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		for (
			let batchStart = 0;
			batchStart < pendingWrites.length;
			batchStart += PDS_APPLY_WRITES_BATCH_SIZE
		) {
			const batch = pendingWrites.slice(
				batchStart,
				batchStart + PDS_APPLY_WRITES_BATCH_SIZE,
			);
			const batchLabel = `${batchStart + 1}–${batchStart + batch.length}`;
			let results: WriteResult[] | undefined;

			this.logger.debug(
				`PDS applyWrites: sending batch of ${batch.length} records (items ${batchLabel}) to ${session.did}`,
			);
			try {
				const created = await this.applyWriteBatch(
					agent,
					session,
					batch,
					"create",
					options,
				);
				results = created.results;
				this.logger.debug(
					`PDS applyWrites: batch of ${batch.length} succeeded (commit ${created.commitCid})`,
				);
			} catch (writeError) {
				let error: unknown = writeError;
				// Crash-recovery / idempotent re-import: rkeys are deterministic
				// content hashes, so if a previous run wrote these records to the
				// PDS but died before the DB write, the `create` batch fails with
				// "record already exists". Retry the same batch as `update` ops —
				// the record at that rkey is byte-identical, so this is an
				// idempotent overwrite. Keeps batching (one extra round-trip per
				// affected batch, not per item).
				if (!isPdsRateLimitError(error) && isRecordExistsError(error)) {
					this.logger.debug(
						`PDS applyWrites: batch ${batchLabel} already exists, retrying as update (idempotent re-import)`,
					);
					try {
						const updated = await this.applyWriteBatch(
							agent,
							session,
							batch,
							"update",
							options,
						);
						results = updated.results;
					} catch (retryError) {
						// Update retry also failed — fall through to normal error
						// handling below using the retry error.
						error = retryError;
					}
				}

				if (!results) {
					if (isPdsRateLimitError(error)) {
						this.logger.warn(
							`PDS applyWrites: rate limited on batch ${batchLabel}`,
						);
						throw new PdsRateLimitError(getPdsRetryAfterSeconds(error));
					}
					this.logger.warn(
						`PDS applyWrites: batch ${batchLabel} failed: ${getErrorMessage(error)}`,
					);
					const classified = classifyImportWriteError(error);
					for (const pw of batch) {
						failed += 1;
						errors.push({
							index: pw.itemIndex + 1,
							code: "write_failed",
							reason: classified.reason,
							message: classified.message,
						});
					}
					continue;
				}
			}

			const indexed = await this.indexWrittenBatch(userDid, batch, results);
			imported += indexed.imported;
			skipped += indexed.skipped;
			failed += indexed.failed;
			errors.push(...indexed.errors);
		}

		return {
			imported,
			skipped,
			failed,
			errors,
		};
	}

	/**
	 * Phase 1: drop duplicates and build the PDS records. No network calls, so a
	 * whole page is prepared before we spend any of the write budget.
	 */
	private async buildPendingWrites(
		userDid: string,
		items: NormalizedImportItemDto[],
	): Promise<{
		pendingWrites: PendingWrite[];
		skipped: number;
		failed: number;
		errors: ImportErrorDto[];
	}> {
		const pendingWrites: PendingWrite[] = [];
		const dedupeSet = new Set<string>();
		let skipped = 0;
		let failed = 0;
		const errors: ImportErrorDto[] = [];

		for (let index = 0; index < items.length; index++) {
			const item = items[index];
			const dedupeKey = buildImportKey(item);
			if (dedupeSet.has(dedupeKey)) {
				skipped += 1;
				continue;
			}
			dedupeSet.add(dedupeKey);

			if (await this.alreadyImported(userDid, item)) {
				skipped += 1;
				continue;
			}

			if (item.type === "movie" && item.movieTmdbId) {
				const { rkey, record, collection } =
					this.moviesService.buildMovieWatchRecord(
						String(item.movieTmdbId),
						item.watchedAt,
						deterministicMovieWatchRkey(
							String(item.movieTmdbId),
							item.watchedAt,
						),
					);
				pendingWrites.push({
					type: "movie",
					itemIndex: index,
					item,
					rkey,
					record,
					collection,
					movieTmdbId: String(item.movieTmdbId),
				});
				continue;
			}

			if (
				item.type === "episode" &&
				item.showTmdbId &&
				item.seasonNumber !== undefined &&
				item.episodeNumber !== undefined
			) {
				const { rkey, record, collection } =
					this.showsService.buildEpisodeWatchRecord(
						String(item.showTmdbId),
						item.seasonNumber,
						item.episodeNumber,
						item.watchedAt,
						deterministicEpisodeWatchRkey(
							String(item.showTmdbId),
							item.seasonNumber,
							item.episodeNumber,
							item.watchedAt,
						),
					);
				pendingWrites.push({
					type: "episode",
					itemIndex: index,
					item,
					rkey,
					record,
					collection,
					showTmdbId: String(item.showTmdbId),
					seasonNumber: item.seasonNumber,
					episodeNumber: item.episodeNumber,
				});
				continue;
			}

			failed += 1;
			errors.push({
				index: index + 1,
				code: "invalid_item",
				message: "This item is missing required fields.",
			});
		}

		return { pendingWrites, skipped, failed, errors };
	}

	/**
	 * Phase 2: one applyWrites round-trip for the whole batch. `op` is "update"
	 * only on the idempotent re-import path, where the records already exist.
	 */
	private async applyWriteBatch(
		agent: Agent,
		session: ATSession,
		batch: PendingWrite[],
		op: "create" | "update",
		options?: ImportWriteOptions,
	): Promise<{ results: WriteResult[]; commitCid: string }> {
		const response = await agent.com.atproto.repo.applyWrites({
			repo: session.did,
			writes: batch.map((pw) => ({
				$type: `com.atproto.repo.applyWrites#${op}` as
					| "com.atproto.repo.applyWrites#create"
					| "com.atproto.repo.applyWrites#update",
				collection: pw.collection,
				rkey: pw.rkey,
				value: pw.record as Record<string, unknown>,
			})),
			validate: false,
		});

		reportPdsRateLimit(response.headers, options);

		return {
			commitCid: response.data.commit?.cid ?? "unknown",
			results: batch.map((pw, i) => {
				const result = response.data.results?.[i] as
					| { uri?: string; cid?: string }
					| undefined;
				return {
					uri: result?.uri ?? `at://${session.did}/${pw.collection}/${pw.rkey}`,
					cid: result?.cid ?? "",
				};
			}),
		};
	}

	/**
	 * Phase 3: index each written record (TMDB fetch + DB write). A failure here
	 * is per-item, never fatal for the batch.
	 */
	private async indexWrittenBatch(
		userDid: string,
		batch: PendingWrite[],
		results: WriteResult[],
	): Promise<{
		imported: number;
		skipped: number;
		failed: number;
		errors: ImportErrorDto[];
	}> {
		let imported = 0;
		let skipped = 0;
		let failed = 0;
		const errors: ImportErrorDto[] = [];

		for (let i = 0; i < batch.length; i++) {
			const pw = batch[i];
			const { uri, cid } = results[i];
			try {
				if (pw.type === "movie") {
					await this.moviesService.indexTrackedMovie(
						uri,
						cid,
						pw.rkey,
						userDid,
						pw.movieTmdbId,
						pw.item.watchedAt,
					);
				} else {
					await this.showsService.indexTrackedEpisode(
						uri,
						cid,
						pw.rkey,
						userDid,
						pw.showTmdbId,
						pw.seasonNumber,
						pw.episodeNumber,
						pw.item.watchedAt,
					);
				}
				imported += 1;
			} catch (error) {
				const classified = classifyImportWriteError(error);
				this.logger.warn(
					`Failed to index item at index ${pw.itemIndex + 1} (${describeImportItem(pw.item)}): ${classified.rawMessage}`,
				);
				if (classified.reason === "duplicate_record") {
					skipped += 1;
					continue;
				}
				failed += 1;
				errors.push({
					index: pw.itemIndex + 1,
					code: "write_failed",
					reason: classified.reason,
					message: classified.message,
				});
			}
		}

		return { imported, skipped, failed, errors };
	}

	async alreadyImported(
		userDid: string,
		item: NormalizedImportItemDto,
	): Promise<boolean> {
		// Pre-check on the deterministic rkey: the same logical watch (item +
		// watchedDate) always maps to the same rkey, so this is correct even
		// after a partial crash. It's purely an optimization — the index write
		// is an idempotent upsert on the same rkey, so a missed pre-check can't
		// produce a duplicate. We additionally scope by userDid as a safety
		// check (rkey is globally unique, but a foreign rkey must never match).
		if (item.type === "movie" && item.movieTmdbId) {
			const rkey = deterministicMovieWatchRkey(
				String(item.movieTmdbId),
				item.watchedAt,
			);
			const existing = await this.prisma.trackedMovie.findFirst({
				where: { userDid, rkey },
				select: { id: true },
			});
			return !!existing;
		}

		if (
			item.type === "episode" &&
			item.showTmdbId &&
			item.seasonNumber !== undefined &&
			item.episodeNumber !== undefined
		) {
			const rkey = deterministicEpisodeWatchRkey(
				String(item.showTmdbId),
				item.seasonNumber,
				item.episodeNumber,
				item.watchedAt,
			);
			const existing = await this.prisma.trackedEpisode.findFirst({
				where: { userDid, rkey },
				select: { id: true },
			});
			return !!existing;
		}

		return false;
	}

	/** The AT session to write with, or null when the User must sign in again. */
	async restoreImportSession(userDid: string): Promise<ATSession | null> {
		try {
			const session = await this.authService.restore(userDid);
			return session ? (session as unknown as ATSession) : null;
		} catch (error) {
			this.logger.warn(
				`Failed to restore auth session for ${userDid}: ${getErrorMessage(error)}`,
			);
			return null;
		}
	}
}
