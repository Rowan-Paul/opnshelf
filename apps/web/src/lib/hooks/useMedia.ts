import {
	type MoviesControllerGetMovieDetailsResponse,
	type MoviesControllerGetUserMoviesResponse,
	moviesControllerGetMovieDetailsOptions,
	moviesControllerGetUserMoviesOptions,
	moviesControllerMarkWatched,
	moviesControllerUnmarkWatched,
	type ShowsControllerGetShowDetailsResponse,
	type ShowsControllerGetUserShowsResponse,
	showsControllerGetEpisodeDetailsOptions,
	showsControllerGetSeasonDetailsOptions,
	showsControllerGetShowDetailsOptions,
	showsControllerGetShowWatchHistoryOptions,
	showsControllerGetShowWatchHistoryQueryKey,
	showsControllerGetUserShowsOptions,
	showsControllerGetUserUpNextOptions,
	showsControllerMarkWatched,
	showsControllerUnmarkWatched,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "#/lib/auth-context";

// Movie detail hook
export function useMovieDetails(movieId: string) {
	return useQuery({
		...moviesControllerGetMovieDetailsOptions({
			path: { movieId },
		}),
		enabled: !!movieId,
	});
}

// User's tracked movies
export function useUserMovies(userDid: string) {
	return useQuery({
		...moviesControllerGetUserMoviesOptions({
			path: { userDid },
		}),
		enabled: !!userDid,
	});
}

// Mark movie as watched mutation
export function useMarkMovieWatched() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (variables: { body: { movieId: string } }) => {
			const result = await moviesControllerMarkWatched(variables);
			return result.data;
		},
		onSuccess: () => {
			// Invalidate relevant queries
			queryClient.invalidateQueries({ queryKey: ["movies"] });
		},
	});
}

// Unmark movie as watched mutation
export function useUnmarkMovieWatched() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (variables: { path: { movieId: string } }) => {
			const result = await moviesControllerUnmarkWatched(variables);
			return result.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["movies"] });
		},
	});
}

// Show detail hook
export function useShowDetails(showId: string) {
	return useQuery({
		...showsControllerGetShowDetailsOptions({
			path: { showId },
		}),
		enabled: !!showId,
	});
}

// Episode detail hook
export function useEpisodeDetails(
	showId: string,
	seasonNumber: string,
	episodeNumber: string,
) {
	return useQuery({
		...showsControllerGetEpisodeDetailsOptions({
			path: { showId, seasonNumber, episodeNumber },
		}),
		enabled: !!showId && !!seasonNumber && !!episodeNumber,
	});
}

// User's tracked shows with pagination
export function useUserShows(userDid: string, _pageSize = 20) {
	return useQuery({
		...showsControllerGetUserShowsOptions({
			path: { userDid },
		}),
		enabled: !!userDid,
	});
}

// Get "Up Next" episodes for user
export function useUserUpNext(userDid: string) {
	return useQuery({
		...showsControllerGetUserUpNextOptions({
			path: { userDid },
		}),
		enabled: !!userDid,
	});
}

// Mark episode as watched mutation
export function useMarkEpisodeWatched() {
	const queryClient = useQueryClient();
	const { user } = useAuth();
	const userDid = user?.did || "";

	return useMutation({
		mutationKey: ["shows", "markEpisodeWatched"],
		mutationFn: async (variables: {
			body: { showId: string; seasonNumber: number; episodeNumber: number };
		}) => {
			const result = await showsControllerMarkWatched(variables);
			return result.data;
		},
		onSuccess: (_data, variables) => {
			// Invalidate the specific show's watch history
			queryClient.invalidateQueries({
				queryKey: showsControllerGetShowWatchHistoryQueryKey({
					path: { userDid, showId: variables.body.showId },
				}),
			});
			// Also invalidate up next queries - affects which episode is "current"
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserUpNextOptions({ path: { userDid } })
					.queryKey,
			});
			// Invalidate general shows list
			queryClient.invalidateQueries({ queryKey: ["shows"] });
		},
	});
}

// Unmark episode as watched mutation
export function useUnmarkEpisodeWatched() {
	const queryClient = useQueryClient();
	const { user } = useAuth();
	const userDid = user?.did || "";

	return useMutation({
		mutationFn: async (variables: {
			path: { showId: string; seasonNumber: number; episodeNumber: number };
		}) => {
			const result = await showsControllerUnmarkWatched(variables);
			return result.data;
		},
		onSuccess: (_data, variables) => {
			// Invalidate the specific show's watch history
			queryClient.invalidateQueries({
				queryKey: showsControllerGetShowWatchHistoryQueryKey({
					path: { userDid, showId: variables.path.showId },
				}),
			});
			// Also invalidate up next queries - affects which episode is "current"
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserUpNextOptions({ path: { userDid } })
					.queryKey,
			});
			// Invalidate general shows list
			queryClient.invalidateQueries({ queryKey: ["shows"] });
		},
	});
}

// Show watch history hook
export function useShowWatchHistory(showId: string) {
	const { user } = useAuth();
	const userDid = user?.did || "";

	return useQuery({
		...showsControllerGetShowWatchHistoryOptions({
			path: { userDid: userDid || "", showId },
		}),
		enabled: !!userDid && !!showId,
	});
}

// Season detail hook
export function useSeasonDetails(showId: string, seasonNumber: string) {
	return useQuery({
		...showsControllerGetSeasonDetailsOptions({
			path: { showId, seasonNumber },
		}),
		enabled: !!showId && !!seasonNumber,
	});
}

// Episode watch actions with loading-state tracking
export function useEpisodeWatchActions(showId: string) {
	const { isAuthenticated } = useAuth();
	const [processingEpisode, setProcessingEpisode] = useState<{
		seasonNumber: number;
		episodeNumber: number;
	} | null>(null);
	const [unmarkingEpisode, setUnmarkingEpisode] = useState<{
		seasonNumber: number;
		episodeNumber: number;
	} | null>(null);

	const markEpisodeMutation = useMarkEpisodeWatched();
	const unmarkEpisodeMutation = useUnmarkEpisodeWatched();

	const handleMarkEpisode = (seasonNumber: number, episodeNumber: number) => {
		if (!isAuthenticated) return;
		setProcessingEpisode({ seasonNumber, episodeNumber });
		markEpisodeMutation.mutate(
			{ body: { showId, seasonNumber, episodeNumber } },
			{ onSettled: () => setProcessingEpisode(null) },
		);
	};

	const handleUnmarkEpisode = (seasonNumber: number, episodeNumber: number) => {
		if (!isAuthenticated) return;
		setUnmarkingEpisode({ seasonNumber, episodeNumber });
		unmarkEpisodeMutation.mutate(
			{ path: { showId, seasonNumber, episodeNumber } },
			{ onSettled: () => setUnmarkingEpisode(null) },
		);
	};

	return {
		processingEpisode,
		unmarkingEpisode,
		handleMarkEpisode,
		handleUnmarkEpisode,
	};
}

// Type exports
export type {
	MoviesControllerGetMovieDetailsResponse,
	MoviesControllerGetUserMoviesResponse,
	ShowsControllerGetShowDetailsResponse,
	ShowsControllerGetUserShowsResponse,
};
