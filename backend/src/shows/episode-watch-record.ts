import { TID } from "@atproto/common";
import {
	$nsid as COLLECTION,
	main as episodeSchema,
} from "../lexicons/xyz/opnshelf/episode";
import type { Main as EpisodeRecord } from "../lexicons/xyz/opnshelf/episode.defs";
import type { TMDBSeason } from "./shows-tmdb.service";

/**
 * Pure helpers that shape an episode Watch before it reaches the PDS.
 *
 * `customWatchedAt` has three states: `undefined` means "now", `null` means an
 * undated Watch (the record carries no `watchedAt`), and a string is an
 * explicit date to normalize.
 */
export function resolveWatchedAt(customWatchedAt: string | null | undefined) {
	return customWatchedAt === undefined
		? new Date().toISOString()
		: customWatchedAt === null
			? undefined
			: new Date(customWatchedAt).toISOString();
}

/** Episodes of a Season that have already aired, so they can be Watched. */
export function eligibleEpisodes(season: TMDBSeason) {
	return (season.episodes ?? []).filter((episode) => {
		if (!episode.air_date) return false;
		const airedAt = new Date(episode.air_date).getTime();
		return Number.isFinite(airedAt) && airedAt <= Date.now();
	});
}

/**
 * Build an episode Watch record for the PDS.
 *
 * When `deterministicRkey` is provided (history import), the same logical
 * watch always maps to the same rkey, so re-issuing the PDS write is an
 * idempotent overwrite rather than a duplicate. Interactive single watches
 * omit it and get a fresh chronological TID.
 */
export function buildEpisodeWatchRecord(
	showId: string,
	seasonNumber: number,
	episodeNumber: number,
	customWatchedAt?: string | null,
	deterministicRkey?: string,
) {
	const rkey = deterministicRkey ?? TID.nextStr();
	const now = new Date().toISOString();
	const watchedAt =
		customWatchedAt === undefined
			? now
			: customWatchedAt === null
				? undefined
				: new Date(customWatchedAt).toISOString();
	const record: EpisodeRecord = episodeSchema.build({
		showId,
		seasonNumber,
		episodeNumber,
		source: "tmdb",
		...(watchedAt === undefined ? {} : { watchedAt }),
		createdAt: now,
	});
	return { rkey, record, collection: COLLECTION };
}
