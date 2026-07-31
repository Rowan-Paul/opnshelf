import type { QueryClient } from "@tanstack/react-query";

/**
 * Operation ids of every query whose data is derived from the signed-in user's
 * watch activity. A watch mutation (mark, unmark, or delete a play) has to
 * invalidate all of them, otherwise surfaces such as the dashboard's 30-day bar
 * chart keep showing counts from before the mutation.
 *
 * These are hey-api operation ids, which live in `queryKey[0]._id`, so one entry
 * covers both the plain and the infinite variant of a query, and every page
 * size / path param of it.
 *
 * Keep this list in sync when a new endpoint starts reading watch history.
 */
export const WATCH_ACTIVITY_QUERY_IDS = [
	// Recommendation row seeded from recent watches
	"discoverControllerBecauseYouWatched",
	// List items carry a viewer-relative `watched` flag and `watchedCount`
	"listsControllerGetList",
	"listsControllerGetPublicUserList",
	"listsControllerGetPublicUserLists",
	"listsControllerGetUserLists",
	// Movies the user tracks, and the plays behind them
	"moviesControllerGetMovieWatchHistory",
	"moviesControllerGetUserMovies",
	"moviesControllerGetUserMoviesPaginated",
	// Shelf + the activity summary behind the stats strip
	"shelfControllerGetUserActivitySummary",
	"shelfControllerGetUserShelf",
	// Shows the user tracks, their plays, and what comes next
	"showsControllerGetShowWatchHistory",
	"showsControllerGetUserEpisodesPaginated",
	"showsControllerGetUserReleaseCalendar",
	"showsControllerGetUserShows",
	"showsControllerGetUserUpNext",
	// Public profile: feeds the 30-day activity bar chart, watched-this-year
	// count and most-watched show on both the dashboard and the profile page
	"usersControllerGetPublicProfile",
] as const;

const WATCH_ACTIVITY_QUERY_ID_SET: ReadonlySet<string> = new Set(
	WATCH_ACTIVITY_QUERY_IDS,
);

/** True when `queryKey` belongs to a watch-activity-derived query. */
export function isWatchActivityQueryKey(queryKey: readonly unknown[]): boolean {
	const first = queryKey[0] as { _id?: unknown } | undefined;
	return (
		typeof first?._id === "string" && WATCH_ACTIVITY_QUERY_ID_SET.has(first._id)
	);
}

/**
 * Invalidate every watch-activity-derived query. Call this from the `onSettled`
 * / `onSuccess` of any mutation that changes what the user has watched.
 */
export function invalidateWatchActivityQueries(queryClient: QueryClient) {
	return queryClient.invalidateQueries({
		predicate: (query) => isWatchActivityQueryKey(query.queryKey),
	});
}
