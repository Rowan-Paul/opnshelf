import { socialControllerGetWatchersOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "#/lib/auth-context";

/**
 * Followed users who have watched a given media item (for the "Watched by
 * friends" row). Backed by `socialControllerGetWatchers`. Only runs for
 * authenticated users, since friend watchers are scoped to who you follow.
 *
 * `mediaId` follows the scoped convention: a bare movie/show id, or a show id
 * with `:season:N` / `:season:N:episode:M` suffixes.
 */
export function useWatchers(
	mediaType: "movie" | "show",
	mediaId: string,
	// Backend caps watchers at 10 (`MAX_WATCHERS_PAGE_SIZE`); requesting more
	// 400s the whole query, so keep the default at the allowed maximum.
	pageSize = 10,
) {
	const { isAuthenticated } = useAuth();
	return useQuery({
		...socialControllerGetWatchersOptions({
			query: { mediaType, mediaId, pageSize },
		}),
		enabled: isAuthenticated && !!mediaId,
	});
}
