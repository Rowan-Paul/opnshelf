import {
	deterministicEpisodeWatchRkey,
	deterministicMovieWatchRkey,
} from "../../common/watch-rkey";
import type { TMDBMovie } from "../../movies/movies-tmdb.service";
import type { TMDBShow } from "../../shows/shows-tmdb.service";
import type { TraktImportIssueRow } from "../trakt-job-dto";
import { normalizeTraktApiItem } from "../trakt-normalize";
import {
	deterministicWatchRkeyForItem,
	draftTraktLedgerRow,
	importItemFromMatchedRow,
	importItemFromRetryRow,
	rankMovieMatchCandidates,
	rankShowMatchCandidates,
	summarizeTraktImportJob,
} from "./trakt-import-ledger";

function draft(raw: unknown) {
	return draftTraktLedgerRow(raw, normalizeTraktApiItem(raw, 1));
}

function ledgerRow(
	overrides: Partial<TraktImportIssueRow> = {},
): TraktImportIssueRow {
	return {
		id: "item-1",
		sourceIndex: 1,
		outcome: "imported",
		mediaType: "movie",
		title: "Arrival",
		year: 2016,
		episodeTitle: null,
		seasonNumber: null,
		episodeNumber: null,
		watchedAt: new Date("2026-03-22T12:00:00.000Z"),
		reason: null,
		message: null,
		traktMediaKey: "movie:1",
		...overrides,
	};
}

const job = {
	id: "job-1",
	type: "trakt_import",
	userDid: "did:plc:abc",
	status: "completed",
	data: {
		traktUsername: "alice",
		currentPage: 3,
		totalPages: 3,
		sourceCount: 7,
		normalizedCount: 6,
		importedCount: 5,
		skippedCount: 1,
		failedCount: 1,
		unmatchedCount: 0,
		alreadyOnShelfCount: 1,
	},
	nextRunAt: new Date("2026-03-23T18:00:00.000Z"),
	lastError: null,
	startedAt: null,
	completedAt: new Date("2026-03-23T18:05:00.000Z"),
	createdAt: new Date("2026-03-23T18:00:00.000Z"),
	updatedAt: new Date("2026-03-23T18:05:00.000Z"),
} as unknown as Parameters<typeof summarizeTraktImportJob>[0];

describe("draftTraktLedgerRow", () => {
	it("marks a normalized item pending and records its TMDB id", () => {
		const result = draft({
			type: "movie",
			action: "watch",
			watched_at: "2026-03-22T12:00:00.000Z",
			movie: { title: "Arrival", year: 2016, ids: { tmdb: 329865, trakt: 7 } },
		});

		expect(result.initialOutcome).toBe("pending");
		expect(result.fields).toMatchObject({
			mediaType: "movie",
			watchedAt: new Date("2026-03-22T12:00:00.000Z"),
			title: "Arrival",
			year: 2016,
			traktMediaKey: "movie:7",
			traktId: "7",
			tmdbId: "329865",
			reason: undefined,
		});
	});

	it("retains a valid Trakt title without a TMDB id as unmatched", () => {
		const result = draft({
			type: "movie",
			action: "watch",
			watched_at: "2026-03-22T12:00:00.000Z",
			movie: {
				title: "The Lord of the Rings: Extended Edition",
				year: 2001,
				ids: { trakt: 123, slug: "lotr-extended" },
			},
		});

		expect(result.initialOutcome).toBe("unmatched");
		expect(result.fields).toMatchObject({
			traktMediaKey: "movie:123",
			traktSlug: "lotr-extended",
			tmdbId: undefined,
			reason: "missing_tmdb_id",
		});
	});

	it("keys an episode without ids on its show title and year", () => {
		const result = draft({
			type: "episode",
			action: "watch",
			watched_at: "2026-03-22T12:00:00.000Z",
			show: { title: "Severance", year: 2022 },
			episode: { season: 1, number: 2, title: "Half Loop" },
		});

		expect(result.initialOutcome).toBe("unmatched");
		expect(result.fields).toMatchObject({
			mediaType: "episode",
			traktMediaKey: "show:Severance:2022",
			episodeTitle: "Half Loop",
			seasonNumber: 1,
			episodeNumber: 2,
		});
	});

	it("marks an episode without a season or number as couldnt_import", () => {
		const result = draft({
			type: "episode",
			action: "watch",
			watched_at: "2026-03-22T12:00:00.000Z",
			show: { title: "Severance", year: 2022, ids: { trakt: 9 } },
			episode: { title: "Half Loop" },
		});

		expect(result.initialOutcome).toBe("couldnt_import");
	});

	it("marks an unknown payload as couldnt_import without a media key", () => {
		const result = draft({ type: "season", watched_at: "not a date" });

		expect(result.initialOutcome).toBe("couldnt_import");
		expect(result.fields).toMatchObject({
			mediaType: "unknown",
			watchedAt: undefined,
			traktMediaKey: undefined,
		});
	});
});

describe("deterministicWatchRkeyForItem", () => {
	it("matches the rkeys the writer uses", () => {
		expect(
			deterministicWatchRkeyForItem({
				type: "movie",
				movieTmdbId: 329865,
				watchedAt: "2026-03-22T12:00:00.000Z",
			}),
		).toBe(deterministicMovieWatchRkey("329865", "2026-03-22T12:00:00.000Z"));
		expect(
			deterministicWatchRkeyForItem({
				type: "episode",
				showTmdbId: 1399,
				seasonNumber: 1,
				episodeNumber: 2,
				watchedAt: "2026-03-22T12:00:00.000Z",
			}),
		).toBe(
			deterministicEpisodeWatchRkey("1399", 1, 2, "2026-03-22T12:00:00.000Z"),
		);
	});
});

describe("summarizeTraktImportJob", () => {
	it("derives counts and Unmatched groups from the item ledger", () => {
		const items = [
			ledgerRow({ id: "1", sourceIndex: 1, outcome: "imported" }),
			ledgerRow({ id: "2", sourceIndex: 2, outcome: "already_on_shelf" }),
			ledgerRow({
				id: "3",
				sourceIndex: 3,
				outcome: "unmatched",
				title: "LOTR Extended",
				year: 2001,
				traktMediaKey: "movie:123",
				watchedAt: new Date("2026-03-20T12:00:00.000Z"),
			}),
			ledgerRow({
				id: "4",
				sourceIndex: 4,
				outcome: "unmatched",
				title: "LOTR Extended",
				year: 2001,
				traktMediaKey: "movie:123",
				watchedAt: new Date("2026-03-21T12:00:00.000Z"),
			}),
			ledgerRow({
				id: "5",
				sourceIndex: 5,
				outcome: "couldnt_import",
				reason: "unknown",
				traktMediaKey: "movie:9",
			}),
		];
		const issueRows = items.filter((item) =>
			["unmatched", "couldnt_import"].includes(item.outcome),
		);

		const dto = summarizeTraktImportJob(job, items, issueRows);

		expect(dto).toMatchObject({
			id: "job-1",
			sourceCount: 5,
			importedCount: 1,
			skippedCount: 1,
			alreadyOnShelfCount: 1,
			unmatchedCount: 2,
			couldntImportCount: 1,
			failedCount: 1,
		});
		expect(dto.issuesPreview.map((issue) => issue.id)).toEqual(["3", "4", "5"]);
		expect(dto.unmatchedGroups).toEqual([
			{
				matchKey: "movie:123",
				mediaType: "movie",
				title: "LOTR Extended",
				year: 2001,
				watchCount: 2,
				watchedAt: ["2026-03-20T12:00:00.000Z", "2026-03-21T12:00:00.000Z"],
			},
		]);
	});

	it("keeps aggregate counters for jobs created before durable outcome rows", () => {
		const dto = summarizeTraktImportJob(job, [], []);

		expect(dto).toMatchObject({
			sourceCount: 7,
			importedCount: 5,
			skippedCount: 1,
			failedCount: 1,
			alreadyOnShelfCount: 1,
		});
		expect(dto.issuesPreview).toEqual([]);
		expect(dto.unmatchedGroups).toEqual([]);
	});
});

describe("match candidate ranking", () => {
	it("puts same-year movies first and keeps at most ten", () => {
		const results = Array.from({ length: 12 }, (_, index) => ({
			id: index + 1,
			title: `Movie ${index + 1}`,
			release_date: index === 11 ? "2016-11-11" : "2001-01-01",
			overview: "",
			popularity: 0,
			vote_average: 0,
			vote_count: 0,
		})) as TMDBMovie[];

		const candidates = rankMovieMatchCandidates(results, 2016);

		expect(candidates).toHaveLength(10);
		expect(candidates[0]).toEqual({
			tmdbId: "12",
			mediaType: "movie",
			title: "Movie 12",
			year: 2016,
			posterPath: undefined,
			overview: "",
		});
	});

	it("maps shows with their first air year", () => {
		const results = () =>
			[
				{ id: 1399, name: "Game of Thrones", first_air_date: "2011-04-17" },
				{ id: 1, name: "Other", first_air_date: "2022-01-01" },
			] as TMDBShow[];

		expect(rankShowMatchCandidates(results(), 2022)[0]).toMatchObject({
			tmdbId: "1",
			mediaType: "show",
			year: 2022,
		});
		expect(rankShowMatchCandidates(results(), null)[0]).toMatchObject({
			tmdbId: "1399",
			title: "Game of Thrones",
			year: 2011,
		});
	});
});

describe("import items rebuilt from ledger rows", () => {
	const watchedAt = new Date("2026-03-22T12:00:00.000Z");

	it("builds a movie or episode item for a matched row", () => {
		expect(
			importItemFromMatchedRow(
				{
					mediaType: "movie",
					seasonNumber: null,
					episodeNumber: null,
					watchedAt,
				},
				"329865",
			),
		).toEqual({
			type: "movie",
			movieTmdbId: 329865,
			watchedAt: "2026-03-22T12:00:00.000Z",
		});
		expect(
			importItemFromMatchedRow(
				{ mediaType: "episode", seasonNumber: 1, episodeNumber: 2, watchedAt },
				"1399",
			),
		).toEqual({
			type: "episode",
			showTmdbId: 1399,
			seasonNumber: 1,
			episodeNumber: 2,
			watchedAt: "2026-03-22T12:00:00.000Z",
		});
		expect(
			importItemFromMatchedRow(
				{
					mediaType: "episode",
					seasonNumber: null,
					episodeNumber: 2,
					watchedAt,
				},
				"1399",
			),
		).toBeNull();
	});

	it("only retries rows whose media type it recognises", () => {
		expect(
			importItemFromRetryRow({
				mediaType: "movie",
				seasonNumber: null,
				episodeNumber: null,
				watchedAt,
				tmdbId: "329865",
			}),
		).toMatchObject({ type: "movie", movieTmdbId: 329865 });
		expect(
			importItemFromRetryRow({
				mediaType: "episode",
				seasonNumber: 1,
				episodeNumber: 2,
				watchedAt,
				tmdbId: "1399",
			}),
		).toMatchObject({ type: "episode", showTmdbId: 1399 });
		expect(
			importItemFromRetryRow({
				mediaType: "unknown",
				seasonNumber: 1,
				episodeNumber: 2,
				watchedAt,
				tmdbId: "1399",
			}),
		).toBeNull();
	});
});
