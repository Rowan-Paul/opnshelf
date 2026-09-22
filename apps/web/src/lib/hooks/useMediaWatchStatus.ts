import {
	moviesControllerGetMovieWatchHistoryOptions,
	moviesControllerGetUserMovieWatchCountsOptions,
	showsControllerGetShowWatchHistoryOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAuth } from "#/lib/auth-context";

interface UseMediaWatchStatusShowOptions {
	mediaType: "show";
	showId: string;
	/** Show poster grids use the batched progress endpoint instead. */
	skipHistory?: boolean;
}

interface UseMediaWatchStatusMovieOptions {
	mediaType: "movie";
	movieId: string;
	/**
	 * Poster cards only need the count, which the shared user-movies list
	 * carries; fetching each card's full history was one request per poster.
	 */
	skipHistory?: boolean;
}

type UseMediaWatchStatusOptions =
	| UseMediaWatchStatusShowOptions
	| UseMediaWatchStatusMovieOptions;

export function useMediaWatchStatus(options: UseMediaWatchStatusOptions) {
	const { user, isAuthenticated } = useAuth();
	const userDid = user?.did || "";

	// Movie queries
	// Counts only: one small shared answer for every card on the page, not the
	// user's full movie list with every movie's details.
	const { data: userMovies } = useQuery({
		...moviesControllerGetUserMovieWatchCountsOptions({
			path: { userDid },
		}),
		enabled: isAuthenticated && options.mediaType === "movie",
	});

	const { data: movieWatchHistory } = useQuery({
		...moviesControllerGetMovieWatchHistoryOptions({
			path: {
				userDid,
				movieId: options.mediaType === "movie" ? options.movieId : "",
			},
		}),
		enabled:
			isAuthenticated && options.mediaType === "movie" && !options.skipHistory,
	});

	// Show queries
	const { data: showWatchHistory } = useQuery({
		...showsControllerGetShowWatchHistoryOptions({
			path: {
				userDid,
				showId: options.mediaType === "show" ? options.showId : "",
			},
		}),
		enabled:
			isAuthenticated && options.mediaType === "show" && !options.skipHistory,
	});

	// Movie derived state
	const isMovieWatched = useMemo(() => {
		if (options.mediaType !== "movie") return false;
		if (!userMovies || !Array.isArray(userMovies)) return false;
		return userMovies.some((um) => um.movieId === options.movieId);
	}, [userMovies, options]);

	// Show derived state
	const movieWatchCount = useMemo(() => {
		if (options.mediaType !== "movie" || !Array.isArray(userMovies)) return 0;
		return (
			userMovies.find((um) => um.movieId === options.movieId)?.watchCount ?? 0
		);
	}, [userMovies, options]);

	const isTracking = useMemo(() => {
		if (options.mediaType !== "show") return false;
		return !!showWatchHistory && showWatchHistory.length > 0;
	}, [showWatchHistory, options]);

	const uniqueEpisodesWatched = useMemo(() => {
		if (options.mediaType !== "show") return 0;
		if (!showWatchHistory || !Array.isArray(showWatchHistory)) return 0;
		const unique = new Set(
			showWatchHistory.map(
				(ep: { seasonNumber: number; episodeNumber: number }) =>
					`${ep.seasonNumber}-${ep.episodeNumber}`,
			),
		);
		return unique.size;
	}, [showWatchHistory, options]);

	const isEpisodeWatched = (seasonNum: number, episodeNum: number) => {
		if (options.mediaType !== "show") return false;
		if (!showWatchHistory || showWatchHistory.length === 0) return false;
		return showWatchHistory.some(
			(ep) => ep.seasonNumber === seasonNum && ep.episodeNumber === episodeNum,
		);
	};

	const isSeasonFullyWatched = (seasonNum: number, episodeCount: number) => {
		if (options.mediaType !== "show") return false;
		if (!showWatchHistory || showWatchHistory.length === 0) return false;
		if (episodeCount === 0) return false;
		const watchedInSeason = showWatchHistory.filter(
			(ep) => ep.seasonNumber === seasonNum,
		).length;
		return watchedInSeason >= episodeCount;
	};

	return {
		// Common
		isAuthenticated,
		// Movie
		isWatched: options.mediaType === "movie" ? isMovieWatched : undefined,
		movieWatchHistory,
		movieWatchCount:
			options.mediaType === "movie" ? movieWatchCount : undefined,
		// Show
		isTracking: options.mediaType === "show" ? isTracking : undefined,
		watchHistory: options.mediaType === "show" ? showWatchHistory : undefined,
		uniqueEpisodesWatched:
			options.mediaType === "show" ? uniqueEpisodesWatched : undefined,
		isEpisodeWatched:
			options.mediaType === "show" ? isEpisodeWatched : undefined,
		isSeasonFullyWatched:
			options.mediaType === "show" ? isSeasonFullyWatched : undefined,
	};
}
