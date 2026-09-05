/**
 * Pure helpers over the Trakt Import item ledger (`traktImportItem` rows). No
 * Nest, no Prisma, no network: turning a raw Trakt payload item into a ledger
 * row, deriving result counts and Unmatched groups from the ledger, ranking
 * TMDB search results for a match, and rebuilding an import item from a row
 * the User matched or asked to retry.
 */
import {
	deterministicEpisodeWatchRkey,
	deterministicMovieWatchRkey,
} from "../../common/watch-rkey";
import type { TMDBMovie } from "../../movies/movies-tmdb.service";
import type { TMDBShow } from "../../shows/shows-tmdb.service";
import type {
	ImportSkipDto,
	NormalizedImportItemDto,
	TraktImportJobDto,
	TraktMatchCandidateDto,
} from "../dto/import-history.dto";
import {
	type BackgroundJobRecord,
	getTraktImportRecovery,
	mapTraktImportIssue,
	mapTraktImportJob,
	type TraktImportIssueRow,
} from "../trakt-job-dto";
import {
	type TraktHistoryPayloadItem,
	candidateYearScore,
	getOptionalIdentifierValue,
	getOptionalIntegerValue,
	getOptionalStringValue,
	yearFromDate,
} from "../trakt-normalize";

export type TraktLedgerOutcome =
	| "pending"
	| "imported"
	| "already_on_shelf"
	| "unmatched"
	| "couldnt_import";

/** Ledger columns derived from one raw Trakt payload item. */
export type TraktLedgerRowFields = {
	mediaType: "movie" | "episode" | "unknown";
	watchedAt: Date | undefined;
	title: string | undefined;
	year: number | undefined;
	episodeTitle: string | undefined;
	seasonNumber: number | undefined;
	episodeNumber: number | undefined;
	traktMediaKey: string | undefined;
	traktId: string | undefined;
	traktSlug: string | undefined;
	tmdbId: string | undefined;
	reason: string | undefined;
	message: string | undefined;
};

export type TraktLedgerRowDraft = {
	/**
	 * "pending" when the item normalized and still has to be checked against
	 * the Shelf; the caller decides between "pending" and "already_on_shelf".
	 */
	initialOutcome: "pending" | "unmatched" | "couldnt_import";
	fields: TraktLedgerRowFields;
};

/**
 * Describe a raw Trakt history item for the ledger. A valid Trakt Watch
 * without a TMDB id is retained as Unmatched so the User can match it later;
 * anything else that did not normalize is "couldnt_import".
 */
export function draftTraktLedgerRow(
	rawPayload: unknown,
	normalized: { item?: NormalizedImportItemDto; skip?: ImportSkipDto },
): TraktLedgerRowDraft {
	const raw = rawPayload as TraktHistoryPayloadItem | undefined;
	const rawType =
		raw?.type === "movie" || raw?.type === "episode" ? raw.type : "unknown";
	const media = rawType === "movie" ? raw?.movie : raw?.show;
	const title = getOptionalStringValue(media?.title);
	const year = getOptionalIntegerValue(media?.year);
	const traktId = getOptionalIdentifierValue(media?.ids?.trakt);
	const traktSlug = getOptionalStringValue(media?.ids?.slug);
	const stableIdentity =
		traktId ?? traktSlug ?? `${title ?? "unknown"}:${year ?? ""}`;
	const traktMediaKey =
		rawType === "movie"
			? `movie:${stableIdentity}`
			: rawType === "episode"
				? `show:${stableIdentity}`
				: undefined;
	const parsedWatchedAt =
		typeof raw?.watched_at === "string" &&
		!Number.isNaN(Date.parse(raw.watched_at))
			? new Date(raw.watched_at)
			: undefined;

	let initialOutcome: TraktLedgerRowDraft["initialOutcome"] = "couldnt_import";
	if (normalized.item) {
		initialOutcome = "pending";
	} else if (
		normalized.skip?.reason === "missing_tmdb_id" &&
		traktMediaKey &&
		parsedWatchedAt &&
		(rawType === "movie" ||
			(rawType === "episode" &&
				Number.isInteger(raw?.episode?.season) &&
				Number.isInteger(raw?.episode?.number)))
	) {
		initialOutcome = "unmatched";
	}

	return {
		initialOutcome,
		fields: {
			mediaType: rawType,
			watchedAt: parsedWatchedAt,
			title,
			year,
			episodeTitle: getOptionalStringValue(raw?.episode?.title),
			seasonNumber: getOptionalIntegerValue(raw?.episode?.season),
			episodeNumber: getOptionalIntegerValue(raw?.episode?.number),
			traktMediaKey,
			traktId,
			traktSlug,
			tmdbId: normalized.item
				? String(
						normalized.item.type === "movie"
							? normalized.item.movieTmdbId
							: normalized.item.showTmdbId,
					)
				: undefined,
			reason: normalized.skip?.reason,
			message: normalized.skip?.message,
		},
	};
}

/**
 * The rkey the import wrote for a normalized item. Deterministic, so the
 * ledger can point at the Watch without reading the write result back.
 */
export function deterministicWatchRkeyForItem(
	item: NormalizedImportItemDto,
): string {
	return item.type === "movie"
		? deterministicMovieWatchRkey(String(item.movieTmdbId), item.watchedAt)
		: deterministicEpisodeWatchRkey(
				String(item.showTmdbId),
				item.seasonNumber ?? 0,
				item.episodeNumber ?? 0,
				item.watchedAt,
			);
}

/**
 * Derive the job DTO from the complete item ledger. Jobs created before
 * durable outcome rows were introduced retain their aggregate counters. New
 * jobs derive all result counts from the complete item ledger so matching
 * changes are reflected immediately.
 */
export function summarizeTraktImportJob(
	job: NonNullable<BackgroundJobRecord>,
	items: TraktImportIssueRow[],
	issueRows: TraktImportIssueRow[],
): TraktImportJobDto {
	const base = mapTraktImportJob(job);
	const importedCount = items.filter(
		(item) => item.outcome === "imported",
	).length;
	const alreadyOnShelfCount = items.filter(
		(item) => item.outcome === "already_on_shelf",
	).length;
	const unmatchedItems = items.filter((item) => item.outcome === "unmatched");
	const matchableItems = items.filter(
		(item) => getTraktImportRecovery(item) === "match",
	);
	const couldntImportCount = items.filter(
		(item) => item.outcome === "couldnt_import",
	).length;
	const groups = new Map<
		string,
		TraktImportJobDto["unmatchedGroups"][number]
	>();
	for (const item of matchableItems) {
		if (!item.traktMediaKey) continue;
		const existing = groups.get(item.traktMediaKey);
		if (existing) {
			existing.watchCount += 1;
			if (item.watchedAt) existing.watchedAt.push(item.watchedAt.toISOString());
			continue;
		}
		groups.set(item.traktMediaKey, {
			matchKey: item.traktMediaKey,
			mediaType: item.mediaType === "movie" ? "movie" : "show",
			title: item.title ?? "Untitled",
			year: item.year ?? undefined,
			watchCount: 1,
			watchedAt: item.watchedAt ? [item.watchedAt.toISOString()] : [],
		});
	}
	return {
		...base,
		sourceCount: items.length || base.sourceCount,
		importedCount: items.length ? importedCount : base.importedCount,
		skippedCount: items.length ? alreadyOnShelfCount : base.skippedCount,
		failedCount: items.length ? couldntImportCount : base.failedCount,
		alreadyOnShelfCount: items.length
			? alreadyOnShelfCount
			: base.alreadyOnShelfCount,
		unmatchedCount: items.length ? unmatchedItems.length : base.unmatchedCount,
		couldntImportCount: items.length
			? couldntImportCount
			: base.couldntImportCount,
		issuesPreview: issueRows.map((item) => mapTraktImportIssue(item)),
		unmatchedGroups: [...groups.values()],
	};
}

/** Top 10 TMDB movie results, same-year titles first. */
export function rankMovieMatchCandidates(
	results: TMDBMovie[],
	sourceYear: number | null,
): TraktMatchCandidateDto[] {
	return results
		.sort(
			(a, b) =>
				candidateYearScore(b.release_date, sourceYear) -
				candidateYearScore(a.release_date, sourceYear),
		)
		.slice(0, 10)
		.map((movie) => ({
			tmdbId: String(movie.id),
			mediaType: "movie" as const,
			title: movie.title,
			year: yearFromDate(movie.release_date),
			posterPath: movie.poster_path,
			overview: movie.overview,
		}));
}

/** Top 10 TMDB show results, same-year titles first. */
export function rankShowMatchCandidates(
	results: TMDBShow[],
	sourceYear: number | null,
): TraktMatchCandidateDto[] {
	return results
		.sort(
			(a, b) =>
				candidateYearScore(b.first_air_date, sourceYear) -
				candidateYearScore(a.first_air_date, sourceYear),
		)
		.slice(0, 10)
		.map((show) => ({
			tmdbId: String(show.id),
			mediaType: "show" as const,
			title: show.name,
			year: yearFromDate(show.first_air_date),
			posterPath: show.poster_path,
			overview: show.overview,
		}));
}

type LedgerWatchRow = Pick<
	TraktImportIssueRow,
	"mediaType" | "seasonNumber" | "episodeNumber"
> & { watchedAt: Date };

/**
 * The import item for a ledger row the User matched to `tmdbId`. A non-movie
 * row is treated as an episode of the chosen show.
 */
export function importItemFromMatchedRow(
	row: LedgerWatchRow,
	tmdbId: string,
): NormalizedImportItemDto | null {
	return row.mediaType === "movie"
		? {
				type: "movie",
				movieTmdbId: Number(tmdbId),
				watchedAt: row.watchedAt.toISOString(),
			}
		: row.seasonNumber !== null && row.episodeNumber !== null
			? {
					type: "episode",
					showTmdbId: Number(tmdbId),
					seasonNumber: row.seasonNumber,
					episodeNumber: row.episodeNumber,
					watchedAt: row.watchedAt.toISOString(),
				}
			: null;
}

/** The import item for a ledger row that already carries its own TMDB id. */
export function importItemFromRetryRow(
	row: LedgerWatchRow & { tmdbId: string },
): NormalizedImportItemDto | null {
	return row.mediaType === "movie"
		? {
				type: "movie",
				movieTmdbId: Number(row.tmdbId),
				watchedAt: row.watchedAt.toISOString(),
			}
		: row.mediaType === "episode" &&
				row.seasonNumber !== null &&
				row.episodeNumber !== null
			? {
					type: "episode",
					showTmdbId: Number(row.tmdbId),
					seasonNumber: row.seasonNumber,
					episodeNumber: row.episodeNumber,
					watchedAt: row.watchedAt.toISOString(),
				}
			: null;
}
