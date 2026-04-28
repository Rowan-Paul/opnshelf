import {
	moviesControllerGetMovieWatchHistoryOptions,
	moviesControllerGetUserMoviesOptions,
	showsControllerGetShowWatchHistoryOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAuth } from "#/lib/auth-context";

interface UseMediaWatchStatusShowOptions {
	mediaType: "show";
	showId: string;
}

interface UseMediaWatchStatusMovieOptions {
	mediaType: "movie";
	movieId: string;
}

type UseMediaWatchStatusOptions =
	| UseMediaWatchStatusShowOptions
	| UseMediaWatchStatusMovieOptions;

export function useMediaWatchStatus(options: UseMediaWatchStatusOptions) {
	const { user, isAuthenticated } = useAuth();
	const userDid = user?.did || "";

	// Movie queries
	const { data: userMovies } = useQuery({
		...moviesControllerGetUserMoviesOptions({
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
		enabled: isAuthenticated && options.mediaType === "movie",
	});

	// Show queries
	const { data: showWatchHistory } = useQuery({
		...showsControllerGetShowWatchHistoryOptions({
			path: {
				userDid,
				showId: options.mediaType === "show" ? options.showId : "",
			},
		}),
		enabled: isAuthenticated && options.mediaType === "show",
	});

	// Movie derived state
	const isMovieWatched = useMemo(() => {
		if (options.mediaType !== "movie") return false;
		if (!userMovies || !Array.isArray(userMovies)) return false;
		return userMovies.some((um) => um.movieId === options.movieId);
	}, [userMovies, options]);

	// Show derived state
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
