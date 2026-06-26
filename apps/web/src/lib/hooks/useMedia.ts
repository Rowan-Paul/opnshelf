import {
	type MoviesControllerGetMovieDetailsResponse,
	type MoviesControllerGetUserMoviesResponse,
	moviesControllerGetMovieDetailsOptions,
	moviesControllerGetMovieWatchHistoryQueryKey,
	moviesControllerGetUserMoviesOptions,
	moviesControllerGetUserMoviesPaginatedQueryKey,
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerGetWatchProvidersOptions,
	moviesControllerMarkWatched,
	moviesControllerUnmarkWatched,
	type ShowsControllerGetShowDetailsResponse,
	type ShowsControllerGetUserShowsResponse,
	shelfControllerGetUserActivitySummaryQueryKey,
	shelfControllerGetUserShelfQueryKey,
	showsControllerGetEpisodeDetailsOptions,
	showsControllerGetSeasonDetailsOptions,
	showsControllerGetShowDetailsOptions,
	showsControllerGetShowWatchHistoryOptions,
	showsControllerGetShowWatchHistoryQueryKey,
	showsControllerGetUserShowsOptions,
	showsControllerGetUserUpNextOptions,
	showsControllerGetWatchProvidersOptions,
	showsControllerMarkWatched,
	showsControllerUnmarkWatched,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
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

// Movie watch providers
export function useMovieWatchProviders(movieId: string, country = "US") {
	return useQuery({
		...moviesControllerGetWatchProvidersOptions({
			path: { movieId },
			query: { country },
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

// Invalidate the queries actually affected by marking/unmarking a movie:
// the movie's own watch history, the user's tracked-movies lists (non-paginated
// + paginated), and the shelf/activity summaries. Mirrors how useWatchActions
// scopes the equivalent action instead of nuking the whole ["movies"] tree.
function invalidateMovieWatchQueries(
	queryClient: ReturnType<typeof useQueryClient>,
	userDid: string,
	movieId: string,
) {
	if (movieId) {
		queryClient.invalidateQueries({
			queryKey: moviesControllerGetMovieWatchHistoryQueryKey({
				path: { userDid, movieId },
			}),
		});
	}
	queryClient.invalidateQueries({
		queryKey: moviesControllerGetUserMoviesQueryKey({ path: { userDid } }),
	});
	queryClient.invalidateQueries({
		queryKey: moviesControllerGetUserMoviesPaginatedQueryKey({
			path: { userDid },
		}),
	});
	queryClient.invalidateQueries({
		queryKey: shelfControllerGetUserShelfQueryKey({ path: { userDid } }),
	});
	queryClient.invalidateQueries({
		queryKey: shelfControllerGetUserActivitySummaryQueryKey({
			path: { userDid },
		}),
	});
}

// Mark movie as watched mutation
export function useMarkMovieWatched() {
	const queryClient = useQueryClient();
	const { user } = useAuth();
	const userDid = user?.did || "";

	return useMutation({
		mutationKey: ["movies", "markWatched"],
		mutationFn: async (variables: { body: { movieId: string } }) => {
			const result = await moviesControllerMarkWatched(variables);
			return result.data;
		},
		onSuccess: (_data, variables) => {
			toast.success("Added to shelf");
			invalidateMovieWatchQueries(queryClient, userDid, variables.body.movieId);
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to add to shelf",
			);
		},
	});
}

// Unmark movie as watched mutation
export function useUnmarkMovieWatched() {
	const queryClient = useQueryClient();
	const { user } = useAuth();
	const userDid = user?.did || "";

	return useMutation({
		mutationKey: ["movies", "unmarkWatched"],
		mutationFn: async (variables: { path: { movieId: string } }) => {
			const result = await moviesControllerUnmarkWatched(variables);
			return result.data;
		},
		onSuccess: (_data, variables) => {
			toast.success("Removed from shelf");
			invalidateMovieWatchQueries(queryClient, userDid, variables.path.movieId);
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to remove from shelf",
			);
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

// Show watch providers
export function useShowWatchProviders(showId: string, country = "US") {
	return useQuery({
		...showsControllerGetWatchProvidersOptions({
			path: { showId },
			query: { country },
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
			toast.success("Episode added to shelf");
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
		onError: (error) => {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to add episode to shelf",
			);
		},
	});
}

// Unmark episode as watched mutation
export function useUnmarkEpisodeWatched() {
	const queryClient = useQueryClient();
	const { user } = useAuth();
	const userDid = user?.did || "";

	return useMutation({
		mutationKey: ["shows", "unmarkEpisodeWatched"],
		mutationFn: async (variables: {
			path: { showId: string };
			query?: {
				mode?: "latest" | "all";
				seasonNumber?: number;
				episodeNumber?: number;
			};
		}) => {
			const result = await showsControllerUnmarkWatched(variables);
			return result.data;
		},
		onSuccess: (_data, variables) => {
			toast.success("Episode removed from shelf");
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
		onError: (error) => {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to remove episode from shelf",
			);
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

	const handleUnmarkEpisode = (
		seasonNumber: number,
		episodeNumber: number,
		mode: "latest" | "all" = "latest",
	) => {
		if (!isAuthenticated) return;
		setUnmarkingEpisode({ seasonNumber, episodeNumber });
		unmarkEpisodeMutation.mutate(
			{
				path: { showId },
				query: { seasonNumber, episodeNumber, mode },
			},
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
