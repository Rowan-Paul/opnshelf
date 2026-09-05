import { Agent } from "@atproto/api";
import { TID } from "@atproto/common";
import { Injectable, Logger } from "@nestjs/common";
import { isAtprotoRecordMissingError } from "../common/atproto-record-errors";
import {
	$nsid as COLLECTION,
	main as episodeSchema,
} from "../lexicons/xyz/opnshelf/episode";
import type { Main as EpisodeRecord } from "../lexicons/xyz/opnshelf/episode.defs";
import { PrismaService } from "../prisma/prisma.service";
import { eligibleEpisodes, resolveWatchedAt } from "./episode-watch-record";
import { ShowCatalogueService } from "./show-catalogue.service";
import { ShowsTmdbService } from "./shows-tmdb.service";

export interface ATSession {
	did: string;
}

type WrittenEpisode = {
	uri: string;
	cid: string;
	rkey: string;
	seasonNumber: number;
	episodeNumber: number;
};

/**
 * Episode Watch writes: the PDS record is the source of truth, and the
 * TrackedEpisode row is the local index of it. Every method here does the PDS
 * write first and then mirrors it locally.
 */
@Injectable()
export class EpisodeWatchService {
	private readonly logger = new Logger(EpisodeWatchService.name);
	// Max records per com.atproto.repo.applyWrites call (PDS limit).
	private static readonly PDS_BULK_BATCH_SIZE = 200;

	constructor(
		private prisma: PrismaService,
		private showsTmdb: ShowsTmdbService,
		private catalogue: ShowCatalogueService,
	) {}

	async markEpisodeWatched(
		_userDid: string,
		session: ATSession,
		showId: string,
		seasonNumber: number,
		episodeNumber: number,
		customWatchedAt?: string | null,
	) {
		const rkey = TID.nextStr();
		const watchedAt = resolveWatchedAt(customWatchedAt);
		const now = new Date().toISOString();

		const record: EpisodeRecord = episodeSchema.build({
			showId,
			seasonNumber,
			episodeNumber,
			source: "tmdb",
			...(watchedAt === undefined ? {} : { watchedAt }),
			createdAt: now,
		});

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);
		const response = await agent.com.atproto.repo.putRecord({
			repo: session.did,
			collection: COLLECTION,
			rkey,
			record,
			validate: false,
		});

		return {
			uri: response.data.uri,
			cid: response.data.cid,
			rkey,
			record,
		};
	}

	async indexTrackedEpisode(
		uri: string,
		cid: string,
		rkey: string,
		userDid: string,
		showId: string,
		seasonNumber: number,
		episodeNumber: number,
		watchedAt: string | undefined,
	) {
		const showData = await this.showsTmdb.getShowDetails(showId);

		if (!showData || !showData.id) {
			throw new Error(
				`Failed to fetch show details for showId ${showId}: invalid response from TMDB`,
			);
		}

		const normalizedShowId = showData.id.toString();

		if (normalizedShowId !== showId) {
			this.logger.warn(
				`Show ID mismatch: requested ${showId}, TMDB returned ${normalizedShowId}. Using TMDB ID for tracked episode.`,
			);
		}

		await this.catalogue.upsertShow(showData);
		await this.catalogue
			.syncShowMetadata(normalizedShowId)
			.catch((err) =>
				this.logger.warn(
					`Failed to sync metadata for show ${normalizedShowId}: ${err instanceof Error ? err.message : String(err)}`,
				),
			);

		// Upsert keyed on the repository-qualified rkey so a re-run of an import (e.g. after a
		// crash between the PDS write and this DB write) overwrites rather than
		// duplicates. Stays consistent with the firehose ingester, the other
		// writer of this row, which uses the same owner-qualified identity.
		return this.prisma.trackedEpisode.upsert({
			where: { userDid_rkey: { userDid, rkey } },
			create: {
				uri,
				rkey,
				cid,
				userDid,
				showId: normalizedShowId,
				seasonNumber,
				episodeNumber,
				watchedDate: watchedAt ? new Date(watchedAt) : null,
				status: "watched",
			},
			update: {
				uri,
				cid,
				showId: normalizedShowId,
				seasonNumber,
				episodeNumber,
				watchedDate: watchedAt ? new Date(watchedAt) : null,
				status: "watched",
			},
			include: { show: true },
		});
	}

	async unmarkEpisodeWatched(
		userDid: string,
		session: ATSession,
		showId: string,
		mode: "latest" | "all" = "latest",
		seasonNumber?: number,
		episodeNumber?: number,
	) {
		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		const where = {
			userDid,
			showId,
			...(seasonNumber !== undefined && { seasonNumber }),
			...(episodeNumber !== undefined && { episodeNumber }),
		};

		if (mode === "all") {
			const trackedEpisodes = await this.prisma.trackedEpisode.findMany({
				where,
				orderBy: { watchedDate: "desc" },
			});

			let firstFailure: unknown;
			for (const tracked of trackedEpisodes) {
				try {
					await agent.com.atproto.repo.deleteRecord({
						repo: session.did,
						collection: COLLECTION,
						rkey: tracked.rkey,
					});
				} catch (error) {
					if (!isAtprotoRecordMissingError(error)) {
						firstFailure ??= error;
						continue;
					}
				}

				await this.removeTrackedEpisodeAfterPdsDelete(userDid, tracked.rkey);
			}

			if (firstFailure) throw firstFailure;

			return { showId, mode, deletedCount: trackedEpisodes.length };
		}

		const latestWatch = await this.prisma.trackedEpisode.findFirst({
			where,
			orderBy: { watchedDate: "desc" },
		});
		if (!latestWatch) {
			return { showId, mode };
		}

		try {
			await agent.com.atproto.repo.deleteRecord({
				repo: session.did,
				collection: COLLECTION,
				rkey: latestWatch.rkey,
			});
		} catch (error) {
			if (!isAtprotoRecordMissingError(error)) throw error;
		}

		await this.removeTrackedEpisodeAfterPdsDelete(userDid, latestWatch.rkey);
		return { showId, mode, rkey: latestWatch.rkey };
	}

	private async removeTrackedEpisodeAfterPdsDelete(
		userDid: string,
		rkey: string,
	): Promise<void> {
		try {
			await this.prisma.trackedEpisode.deleteMany({ where: { userDid, rkey } });
		} catch (error) {
			this.logger.warn(
				{ err: error instanceof Error ? error.message : String(error) },
				"Failed to optimistically remove tracked episode; firehose will catch it",
			);
		}
	}

	async removeTrackedEpisodeById(
		userDid: string,
		session: ATSession,
		trackedEpisodeId: string,
	) {
		const trackedEpisode = await this.prisma.trackedEpisode.findFirst({
			where: {
				id: trackedEpisodeId,
				userDid,
			},
		});

		if (!trackedEpisode) {
			throw new Error("Tracked episode not found");
		}

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);
		await agent.com.atproto.repo.deleteRecord({
			repo: userDid,
			collection: COLLECTION,
			rkey: trackedEpisode.rkey,
		});

		await this.prisma.trackedEpisode.delete({
			where: {
				id: trackedEpisodeId,
			},
		});
	}

	// Write episode records to the PDS in batches via applyWrites. Best-effort:
	// stops at the first failed batch (e.g. a 429 rate limit) and returns
	// whatever succeeded so far — no reserve, no retry. A bulk-mark is the
	// user's own interactive write, so it ignores the import write-reserve and
	// cannot pause synchronously (see ADR-0009).
	private async bulkPutEpisodes(
		session: ATSession,
		records: Array<{
			rkey: string;
			record: EpisodeRecord;
			seasonNumber: number;
			episodeNumber: number;
		}>,
	) {
		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);
		const written: WrittenEpisode[] = [];

		for (
			let start = 0;
			start < records.length;
			start += EpisodeWatchService.PDS_BULK_BATCH_SIZE
		) {
			const batch = records.slice(
				start,
				start + EpisodeWatchService.PDS_BULK_BATCH_SIZE,
			);
			try {
				const response = await agent.com.atproto.repo.applyWrites({
					repo: session.did,
					writes: batch.map((w) => ({
						$type: "com.atproto.repo.applyWrites#create" as const,
						collection: COLLECTION,
						rkey: w.rkey,
						value: w.record as unknown as Record<string, unknown>,
					})),
					validate: false,
				});
				batch.forEach((w, i) => {
					const result = response.data.results?.[i] as
						| { uri?: string; cid?: string }
						| undefined;
					written.push({
						uri: result?.uri ?? `at://${session.did}/${COLLECTION}/${w.rkey}`,
						cid: result?.cid ?? "",
						rkey: w.rkey,
						seasonNumber: w.seasonNumber,
						episodeNumber: w.episodeNumber,
					});
				});
			} catch (err: unknown) {
				this.logger.warn(
					`Bulk episode applyWrites stopped at batch starting ${start} (${written.length}/${records.length} written): ${err instanceof Error ? err.message : String(err)}`,
				);
				break;
			}
		}

		return written;
	}

	// Index the episodes that landed on the PDS in one INSERT. skipDuplicates
	// absorbs the firehose-double-write race (same rkey). Returns the count of
	// episodes now logged — written.length, since a skipped duplicate was
	// already logged and still counts as watched.
	private async indexWrittenEpisodes(
		userDid: string,
		showId: string,
		watchedAt: string | undefined,
		written: WrittenEpisode[],
	) {
		if (written.length === 0) return 0;
		await this.prisma.trackedEpisode.createMany({
			data: written.map((w) => ({
				uri: w.uri,
				rkey: w.rkey,
				cid: w.cid,
				userDid,
				showId,
				seasonNumber: w.seasonNumber,
				episodeNumber: w.episodeNumber,
				watchedDate: watchedAt ? new Date(watchedAt) : null,
				status: "watched",
			})),
			skipDuplicates: true,
		});
		return written.length;
	}

	async markSeasonWatched(
		userDid: string,
		session: ATSession,
		showId: string,
		seasonNumber: number,
		customWatchedAt?: string | null,
	) {
		const season = await this.showsTmdb.getSeasonDetails(showId, seasonNumber);
		const watched = await this.prisma.trackedEpisode.findMany({
			where: { userDid, showId, seasonNumber },
			select: { episodeNumber: true },
		});
		const watchedNumbers = new Set(watched.map((entry) => entry.episodeNumber));
		const episodes = eligibleEpisodes(season).filter(
			(episode) => !watchedNumbers.has(episode.episode_number),
		);
		const requested = episodes.length;

		if (requested === 0) {
			return { count: 0, requested: 0 };
		}

		const watchedAt = resolveWatchedAt(customWatchedAt);
		const now = new Date().toISOString();

		const records = episodes.map((episode) => ({
			rkey: TID.nextStr(),
			record: episodeSchema.build({
				showId,
				seasonNumber,
				episodeNumber: episode.episode_number,
				source: "tmdb",
				...(watchedAt === undefined ? {} : { watchedAt }),
				createdAt: now,
			}),
			seasonNumber,
			episodeNumber: episode.episode_number,
		}));

		const written = await this.bulkPutEpisodes(session, records);

		const showData = await this.showsTmdb.getShowDetails(showId);
		if (!showData || !showData.id) {
			throw new Error(
				`Failed to fetch show details for showId ${showId}: invalid response from TMDB`,
			);
		}
		const normalizedShowId = showData.id.toString();

		await this.catalogue.upsertShow(showData);
		await this.catalogue
			.syncShowMetadata(normalizedShowId)
			.catch((err) =>
				this.logger.warn(
					`Failed to sync metadata for show ${normalizedShowId}: ${err instanceof Error ? err.message : String(err)}`,
				),
			);

		const count = await this.indexWrittenEpisodes(
			userDid,
			normalizedShowId,
			watchedAt,
			written,
		);

		return { count, requested };
	}

	async markShowWatched(
		userDid: string,
		session: ATSession,
		showId: string,
		customWatchedAt?: string | null,
	) {
		const show = await this.showsTmdb.getShowDetails(showId);
		const numberOfSeasons = show.number_of_seasons || 1;

		const watchedAt = resolveWatchedAt(customWatchedAt);

		const now = new Date().toISOString();

		// Fetch every season's episode list in parallel — sequential fetches
		// were a serial bottleneck before any PDS write. Seasons number in the
		// tens at most (episodes can run into the hundreds), so no cap needed.
		const seasonNums = Array.from({ length: numberOfSeasons }, (_, i) => i + 1);
		const seasons = await Promise.all(
			seasonNums.map((seasonNum) =>
				this.showsTmdb.getSeasonDetails(showId, seasonNum).catch((err) => {
					this.logger.warn(
						`Failed to fetch season ${seasonNum} for show ${showId}: ${err instanceof Error ? err.message : String(err)}`,
					);
					return null;
				}),
			),
		);

		const existing = await this.prisma.trackedEpisode.findMany({
			where: { userDid, showId },
			select: { seasonNumber: true, episodeNumber: true },
		});
		const watched = new Set(
			existing.map((entry) => `${entry.seasonNumber}:${entry.episodeNumber}`),
		);
		const records = seasons.flatMap((season, idx) => {
			const seasonNumber = seasonNums[idx];
			if (!season) return [];
			return eligibleEpisodes(season)
				.filter(
					(episode) =>
						!watched.has(`${seasonNumber}:${episode.episode_number}`),
				)
				.map((episode) => ({
					rkey: TID.nextStr(),
					record: episodeSchema.build({
						showId,
						seasonNumber,
						episodeNumber: episode.episode_number,
						source: "tmdb",
						...(watchedAt === undefined ? {} : { watchedAt }),
						createdAt: now,
					}),
					seasonNumber,
					episodeNumber: episode.episode_number,
				}));
		});

		const requested = records.length;
		if (requested === 0) {
			return { count: 0, requested: 0 };
		}

		const written = await this.bulkPutEpisodes(session, records);

		// Reuse the show details already fetched at the top of this method
		// instead of issuing a second identical getShowDetails call.
		if (!show || !show.id) {
			throw new Error(
				`Failed to fetch show details for showId ${showId}: invalid response from TMDB`,
			);
		}
		const normalizedShowId = show.id.toString();

		await this.catalogue.upsertShow(show);
		await this.catalogue
			.syncShowMetadata(normalizedShowId)
			.catch((err) =>
				this.logger.warn(
					`Failed to sync metadata for show ${normalizedShowId}: ${err instanceof Error ? err.message : String(err)}`,
				),
			);

		const count = await this.indexWrittenEpisodes(
			userDid,
			normalizedShowId,
			watchedAt,
			written,
		);

		return { count, requested };
	}
}
