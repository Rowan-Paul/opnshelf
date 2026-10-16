import { createHash } from "node:crypto";

/**
 * Derive a DETERMINISTIC AT Protocol rkey for a Watch record.
 *
 * The original import item and timestamp choose its creation key. Recovery
 * recognizes that key without overwriting existing content: a User may have
 * corrected the date since import. Date edits never recompute it (ADR 0042).
 *
 * IMPORTANT — rewatches: the watched date is part of the key material, so two
 * genuinely different watches of the same item (different dates) map to
 * different rkeys and remain distinct. Only an identical (item + watchedDate)
 * re-import dedupes.
 *
 * The output is a SHA-256 hash truncated to 32 hex chars (128 bits). Hex is a
 * subset of the AT Protocol record-key charset (a-z0-9.-_~:) and the length is
 * well within the 1–512 char limit, so the result is always a syntactically
 * valid rkey. 128 bits is collision-safe at any realistic import scale.
 */
function hashWatchKey(material: string): string {
	return createHash("sha256").update(material).digest("hex").slice(0, 32);
}

/**
 * Normalize a watchedAt value to a canonical ISO string so that equivalent
 * timestamps (e.g. with/without milliseconds, different offsets) produce the
 * same key. Mirrors the normalization done when the record itself is built.
 */
function normalizeWatchedAt(watchedAt: string): string {
	return new Date(watchedAt).toISOString();
}

export function deterministicMovieWatchRkey(
	movieId: string,
	watchedAt: string,
): string {
	return hashWatchKey(`movie:${movieId}:${normalizeWatchedAt(watchedAt)}`);
}

export function deterministicEpisodeWatchRkey(
	showId: string,
	seasonNumber: number,
	episodeNumber: number,
	watchedAt: string,
): string {
	return hashWatchKey(
		`episode:${showId}:${seasonNumber}:${episodeNumber}:${normalizeWatchedAt(watchedAt)}`,
	);
}
