import {
	moviesControllerGetMovieWatchHistoryOptions,
	moviesControllerGetUserMoviesOptions,
	showsControllerGetShowWatchHistoryOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAuth } from "@/lib/auth-context";

interface WatchStatusShowOptions {
	mediaType: "show";
	showId: string;
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
		enabled: isAuthenticated && isShow && !!userDid,
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

	const uniqueEpisodesWatched = useMemo(() => {
		if (!isShow || !Array.isArray(showWatchHistory)) return 0;
		return new Set(
			showWatchHistory.map((ep) => `${ep.seasonNumber}-${ep.episodeNumber}`),
		).size;
	}, [isShow, showWatchHistory]);

	const isEpisodeWatched = (seasonNum: number, episodeNum: number) => {
		if (!isShow || !showWatchHistory) return false;
		return showWatchHistory.some(
			(ep) => ep.seasonNumber === seasonNum && ep.episodeNumber === episodeNum,
		);
	};

	const isSeasonFullyWatched = (seasonNum: number, episodeCount: number) => {
		if (!isShow || !showWatchHistory || episodeCount === 0) return false;
		const watchedInSeason = showWatchHistory.filter(
			(ep) => ep.seasonNumber === seasonNum,
		).length;
		return watchedInSeason >= episodeCount;
	};

	const latestWatchedDate = useMemo(() => {
		if (isMovie) return movieWatchHistory?.[0]?.watchedDate;
		if (isShow && showWatchHistory && showWatchHistory.length > 0) {
			return [...showWatchHistory].sort((a, b) =>
				b.watchedDate.localeCompare(a.watchedDate),
			)[0]?.watchedDate;
		}
		return undefined;
	}, [isMovie, isShow, movieWatchHistory, showWatchHistory]);

	return {
		isAuthenticated,
		// Movie
		isWatched: isMovie ? isMovieWatched : undefined,
		movieWatchHistory: isMovie ? movieWatchHistory : undefined,
		totalMovieWatches: isMovie ? (movieWatchHistory?.length ?? 0) : 0,
		// Show
		isTracking: isShow ? isTracking : undefined,
		showWatchHistory: isShow ? showWatchHistory : undefined,
		uniqueEpisodesWatched: isShow ? uniqueEpisodesWatched : 0,
		isEpisodeWatched: isShow ? isEpisodeWatched : undefined,
		isSeasonFullyWatched: isShow ? isSeasonFullyWatched : undefined,
		// Common
		latestWatchedDate,
	};
}
