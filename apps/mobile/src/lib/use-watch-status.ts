import {
	moviesControllerGetMovieWatchHistoryOptions,
	moviesControllerGetUserMoviesOptions,
	showsControllerGetShowWatchHistoryOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { getShowWatchIndex } from "@/lib/show-watch-index";
import { latestWatchDate } from "@/lib/watch-date";

interface WatchStatusShowOptions {
	mediaType: "show";
	showId: string;
	/** Show poster grids use the batched progress endpoint instead. */
	skipHistory?: boolean;
}

interface WatchStatusMovieOptions {
	mediaType: "movie";
	movieId: string;
}

type UseWatchStatusOptions = WatchStatusShowOptions | WatchStatusMovieOptions;

/**
 * Read-only tracked status for a movie or show, mirroring the web
 * `useMediaWatchStatus` hook. Movies use the user's tracked-movies list +
 * per-movie watch history; shows derive tracking + per-episode status from the
 * show watch history.
 */
export function useWatchStatus(options: UseWatchStatusOptions) {
	const { user, isAuthenticated } = useAuth();
	const userDid = user?.did ?? "";

	const isMovie = options.mediaType === "movie";
	const isShow = options.mediaType === "show";

	const { data: userMovies } = useQuery({
		...moviesControllerGetUserMoviesOptions({ path: { userDid } }),
		enabled: isAuthenticated && isMovie && !!userDid,
	});

	const { data: movieWatchHistory } = useQuery({
		...moviesControllerGetMovieWatchHistoryOptions({
			path: { userDid, movieId: isMovie ? options.movieId : "" },
		}),
		enabled: isAuthenticated && isMovie && !!userDid,
	});

	const { data: showWatchHistory } = useQuery({
		...showsControllerGetShowWatchHistoryOptions({
			path: { userDid, showId: isShow ? options.showId : "" },
		}),
		enabled: isAuthenticated && isShow && !!userDid && !options.skipHistory,
	});

	const isMovieWatched = useMemo(() => {
		if (!isMovie || !Array.isArray(userMovies)) return false;
		return userMovies.some(
			(m) => String(m.movieId) === (isMovie ? options.movieId : ""),
		);
	}, [isMovie, userMovies, options]);

	const isTracking = useMemo(
		() => isShow && !!showWatchHistory && showWatchHistory.length > 0,
		[isShow, showWatchHistory],
	);

	const watchIndex = showWatchHistory
		? getShowWatchIndex(showWatchHistory)
		: undefined;
	const uniqueEpisodesWatched = isShow ? (watchIndex?.episodes.size ?? 0) : 0;
	const episodeWatchCount = (seasonNum: number, episodeNum: number) =>
		isShow ? (watchIndex?.episodes.get(`${seasonNum}-${episodeNum}`) ?? 0) : 0;
	const isEpisodeWatched = (seasonNum: number, episodeNum: number) =>
		episodeWatchCount(seasonNum, episodeNum) > 0;
	const isSeasonFullyWatched = (seasonNum: number, episodeCount: number) =>
		isShow &&
		episodeCount > 0 &&
		(watchIndex?.seasons.get(seasonNum) ?? 0) >= episodeCount;
	const latestWatchedDate = useMemo(() => {
		if (isMovie) return latestWatchDate(movieWatchHistory ?? []);
		return isShow ? watchIndex?.latestWatchedDate : undefined;
	}, [isMovie, isShow, movieWatchHistory, watchIndex]);

	return {
		isAuthenticated,
		// Movie
		isWatched: isMovie ? isMovieWatched : undefined,
		movieWatchHistory: isMovie ? movieWatchHistory : undefined,
		totalMovieWatches: isMovie ? (movieWatchHistory?.length ?? 0) : 0,
		// Show
		episodeWatchCount,
		isTracking: isShow ? isTracking : undefined,
		showWatchHistory: isShow ? showWatchHistory : undefined,
		uniqueEpisodesWatched: isShow ? uniqueEpisodesWatched : 0,
		isEpisodeWatched: isShow ? isEpisodeWatched : undefined,
		isSeasonFullyWatched: isShow ? isSeasonFullyWatched : undefined,
		// Common
		latestWatchedDate,
	};
}
