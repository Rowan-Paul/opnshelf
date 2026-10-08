import { createHash } from "node:crypto";
import { Agent } from "@atproto/api";
import { Inject, Injectable } from "@nestjs/common";
import { AUTH_SERVICE } from "../auth/auth.tokens";
import type { AuthService } from "../auth/auth.service";
import { isAtprotoRecordMissingError } from "../common/atproto-record-errors";
import { main as ratingSchema } from "../lexicons/xyz/opnshelf/rating";
import { MoviesService } from "../movies/movies.service";
import { PrismaService } from "../prisma/prisma.service";
import { RatingsService } from "../ratings/ratings.service";
import { buildEpisodeWatchRecord } from "../shows/episode-watch-record";
import { ShowsService } from "../shows/shows.service";
import { type SyncRecord } from "./reconcile";
import {
	rankMovieMatchCandidates,
	rankShowMatchCandidates,
} from "../users/import/trakt-import-ledger";

export function collection(record: SyncRecord) {
	return record.kind === "rating"
		? "xyz.opnshelf.rating"
		: record.mediaType === "movie"
			? "xyz.opnshelf.movie"
			: "xyz.opnshelf.episode";
}
export function syncRkey(connectionId: string, remoteKey: string) {
	return createHash("sha256")
		.update(`trakt-sync:${connectionId}:${remoteKey}`)
		.digest("hex")
		.slice(0, 32);
}

@Injectable()
export class LocalSyncRecords {
	constructor(
		private readonly prisma: PrismaService,
		private readonly movies: MoviesService,
		private readonly shows: ShowsService,
		private readonly ratings: RatingsService,
		@Inject(AUTH_SERVICE) private readonly auth: Pick<AuthService, "restore">,
	) {}
	async matches(record: SyncRecord, query: string) {
		if (record.mediaType === "movie")
			return rankMovieMatchCandidates(
				(await this.movies.searchMovies(query)).results,
				null,
			);
		return rankShowMatchCandidates(
			(await this.shows.searchShows(query)).results,
			null,
		);
	}
	async validateMatch(record: SyncRecord, id: string) {
		const media =
			record.mediaType === "movie"
				? await this.movies.getMovieDetails(id)
				: await this.shows.getShowDetails(id);
		if (!media?.id) throw new Error("This title could not be found.");
	}
	async snapshot(userDid: string): Promise<SyncRecord[]> {
		const [movies, episodes, ratings] = await this.prisma.$transaction([
			this.prisma.trackedMovie.findMany({
				where: { userDid, status: "watched" },
				include: { movie: true },
			}),
			this.prisma.trackedEpisode.findMany({
				where: { userDid, status: "watched" },
				include: { show: true },
			}),
			this.prisma.rating.findMany({ where: { userDid } }),
		]);
		const [ratedMovies, ratedShows] = await this.prisma.$transaction([
			this.prisma.movie.findMany({
				where: {
					movieId: {
						in: ratings
							.filter((r) => r.mediaType === "movie")
							.map((r) => r.mediaId),
					},
				},
				select: { movieId: true, title: true },
			}),
			this.prisma.show.findMany({
				where: {
					showId: {
						in: ratings
							.filter((r) => r.mediaType !== "movie")
							.map((r) => r.mediaId),
					},
				},
				select: { showId: true, title: true },
			}),
		]);
		return [
			...movies.map(
				(r): SyncRecord => ({
					key: `movie:${r.rkey}`,
					rkey: r.rkey,
					cid: r.cid,
					kind: "watch",
					mediaType: "movie",
					mediaId: r.movieId,
					season: 0,
					episode: 0,
					title: r.movie.title,
					value: r.watchedDate?.toISOString() ?? null,
				}),
			),
			...episodes.map(
				(r): SyncRecord => ({
					key: `episode:${r.rkey}`,
					rkey: r.rkey,
					cid: r.cid,
					kind: "watch",
					mediaType: "episode",
					mediaId: r.showId,
					season: r.seasonNumber,
					episode: r.episodeNumber,
					title: r.show.title,
					value: r.watchedDate?.toISOString() ?? null,
				}),
			),
			...ratings.map(
				(r): SyncRecord => ({
					key: `rating:${r.rkey}`,
					rkey: r.rkey,
					cid: r.cid,
					kind: "rating",
					mediaType: r.mediaType as SyncRecord["mediaType"],
					mediaId: r.mediaId,
					season: r.seasonNumber,
					episode: r.episodeNumber,
					title:
						(r.mediaType === "movie"
							? ratedMovies.find((m) => m.movieId === r.mediaId)
							: ratedShows.find((m) => m.showId === r.mediaId)
						)?.title ?? `${r.mediaType} ${r.mediaId}`,
					value: r.rating,
				}),
			),
		];
	}
	private async agent(userDid: string) {
		const session = await this.auth.restore(userDid);
		if (!session)
			throw new Error("Sign in to Opnshelf again to continue syncing.");
		return new Agent(session);
	}
	/** Confirm absence in the source of truth, not merely a temporarily incomplete index. */
	async confirmDeleted(userDid: string, previous: SyncRecord) {
		const agent = await this.agent(userDid);
		try {
			await agent.com.atproto.repo.getRecord({
				repo: userDid,
				collection: collection(previous),
				rkey: previous.rkey ?? "",
			});
			throw new Error(
				"The PDS still has this record. Waiting for Opnshelf indexing to catch up.",
			);
		} catch (error) {
			if (!isAtprotoRecordMissingError(error)) throw error;
		}
	}
	async write(
		userDid: string,
		connectionId: string,
		desired: SyncRecord | null,
		previous: SyncRecord | null,
		reservedRkey?: string,
	): Promise<SyncRecord | null> {
		const source = desired ?? previous;
		if (!source) return null;
		if (!source.mediaId)
			throw new Error("Choose a TMDB match before importing this item.");
		const agent = await this.agent(userDid);
		const rkey =
			previous?.rkey ?? reservedRkey ?? syncRkey(connectionId, source.key);
		const coll = collection(source);
		let existing: { value: Record<string, unknown>; cid?: string } | undefined;
		try {
			existing = (
				await agent.com.atproto.repo.getRecord({
					repo: userDid,
					collection: coll,
					rkey,
				})
			).data;
		} catch (error) {
			if (!isAtprotoRecordMissingError(error)) throw error;
		}
		const sameMedia =
			existing &&
			(source.kind === "rating"
				? existing.value.mediaType === source.mediaType &&
					existing.value.mediaId === source.mediaId &&
					(existing.value.seasonNumber ?? 0) === source.season &&
					(existing.value.episodeNumber ?? 0) === source.episode
				: source.mediaType === "movie"
					? existing.value.movieId === source.mediaId
					: existing.value.showId === source.mediaId &&
						existing.value.seasonNumber === source.season &&
						existing.value.episodeNumber === source.episode);
		const alreadyApplied =
			existing &&
			sameMedia &&
			desired &&
			(desired.kind === "rating"
				? existing.value.rating === desired.value
				: (existing.value.watchedAt ?? null) === desired.value);
		if (!previous && existing && !alreadyApplied)
			throw new Error(
				"This record changed during recovery. Choose which version to keep.",
			);
		if (
			previous?.cid &&
			existing &&
			existing.cid !== previous.cid &&
			!alreadyApplied
		)
			throw new Error(
				"This record changed while syncing. Refresh and resolve the conflict.",
			);
		if (previous && !existing && desired)
			throw new Error(
				"This record was deleted while syncing. Choose whether to restore it.",
			);
		if (!desired) {
			if (existing)
				await agent.com.atproto.repo.deleteRecord({
					repo: userDid,
					collection: coll,
					rkey,
					swapRecord: existing.cid,
				});
			if (source.kind === "rating")
				await this.prisma.rating.deleteMany({ where: { userDid, rkey } });
			else if (source.mediaType === "movie")
				await this.prisma.trackedMovie.deleteMany({ where: { userDid, rkey } });
			else
				await this.prisma.trackedEpisode.deleteMany({
					where: { userDid, rkey },
				});
			return null;
		}
		let record: Record<string, unknown>;
		if (desired.kind === "rating")
			record = ratingSchema.build({
				mediaType: desired.mediaType,
				mediaId: source.mediaId,
				seasonNumber: desired.season || undefined,
				episodeNumber: desired.episode || undefined,
				rating: Number(desired.value),
				createdAt: new Date(
					typeof existing?.value.createdAt === "string"
						? existing.value.createdAt
						: Date.now(),
				).toISOString(),
			});
		else {
			record =
				existing?.value ??
				(desired.mediaType === "movie"
					? this.movies.buildMovieWatchRecord(
							source.mediaId,
							desired.value as string | null,
							rkey,
						).record
					: buildEpisodeWatchRecord(
							source.mediaId,
							desired.season,
							desired.episode,
							desired.value as string | null,
							rkey,
						).record);
			record = {
				...record,
				...(desired.mediaType === "movie"
					? { movieId: desired.mediaId }
					: {
							showId: desired.mediaId,
							seasonNumber: desired.season,
							episodeNumber: desired.episode,
						}),
			};
			if (desired.value === null) delete record.watchedAt;
			else record.watchedAt = desired.value;
		}
		const result =
			alreadyApplied && existing?.cid
				? {
						data: { uri: `at://${userDid}/${coll}/${rkey}`, cid: existing.cid },
					}
				: await agent.com.atproto.repo.putRecord({
						repo: userDid,
						collection: coll,
						rkey,
						record,
						swapRecord: existing?.cid ?? null,
						validate: false,
					});
		if (desired.kind === "rating")
			await this.ratings.indexRatingRecord(
				result.data.uri,
				result.data.cid,
				rkey,
				userDid,
				ratingSchema.parse(record),
			);
		else if (desired.mediaType === "movie")
			await this.movies.indexTrackedMovie(
				result.data.uri,
				result.data.cid,
				rkey,
				userDid,
				source.mediaId,
				(desired.value as string | undefined) ?? undefined,
			);
		else
			await this.shows.indexTrackedEpisode(
				result.data.uri,
				result.data.cid,
				rkey,
				userDid,
				source.mediaId,
				desired.season,
				desired.episode,
				(desired.value as string | undefined) ?? undefined,
			);
		return {
			...desired,
			key: `${desired.kind === "rating" ? "rating" : desired.mediaType}:${rkey}`,
			rkey,
			cid: result.data.cid,
		};
	}
}
