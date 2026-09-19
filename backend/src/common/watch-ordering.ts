/**
 * Ordering for date-ordered Watch lists.
 *
 * A Watch carries an OPTIONAL watch date (`watchedDate` in the DB, `watchedAt`
 * in the API and the lexicon). An undated Watch is a deliberate user choice —
 * "I watched this, I'm not saying when" — not missing data, so it must never be
 * given an invented date and must never outrank a Watch the user did date.
 *
 * Postgres sorts NULLs FIRST for DESC by default, so a bare
 * `orderBy: { watchedDate: "desc" }` floats every undated Watch to the top of
 * the list. That is wrong everywhere, and actively destructive for
 * "remove the latest Watch", which would delete an undated Watch instead of the
 * genuinely most recent one.
 *
 * The rule (ADR 0037): undated Watches sort AFTER dated Watches in any
 * date-ordered Watch list, regardless of sort direction, tie-broken by
 * `createdAt` descending so the most recently logged undated Watch comes first
 * among its peers.
 */

type SortOrder = "asc" | "desc";

type WatchDateOrderBy = [
	{ watchedDate: { sort: SortOrder; nulls: "last" } },
	{ createdAt: "desc" },
];

/**
 * Order by watch date with undated Watches last.
 *
 * Returns a fresh array each call so callers can safely spread additional
 * tie-breakers after it (see `getUserUpNext`, which appends season/episode).
 */
export function watchDateOrderBy(
	direction: SortOrder = "desc",
): WatchDateOrderBy {
	return [
		{ watchedDate: { sort: direction, nulls: "last" } },
		{ createdAt: "desc" },
	];
}
