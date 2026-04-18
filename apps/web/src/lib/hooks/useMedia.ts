import {
	type MoviesControllerGetMovieDetailsResponse,
	type MoviesControllerGetUserMoviesResponse,
	moviesControllerGetMovieDetailsOptions,
	moviesControllerGetUserMoviesOptions,
	moviesControllerMarkWatched,
	moviesControllerUnmarkWatched,
	type ShowsControllerGetShowDetailsResponse,
	type ShowsControllerGetUserShowsResponse,
	showsControllerGetShowDetailsOptions,
	showsControllerGetShowWatchHistoryQueryKey,
	showsControllerGetUserShowsOptions,
	showsControllerGetUserUpNextOptions,
	showsControllerMarkWatched,
	showsControllerUnmarkWatched,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
					path: { userDid: "", showId: variables.body.showId },
				}),
			});
			// Also invalidate up next queries - affects which episode is "current"
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserUpNextOptions({ path: { userDid: "" } })
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

	return useMutation({
		mutationFn: async (variables: {
			path: { showId: string; seasonNumber: number; episodeNumber: number };
		}) => {
			const result = await showsControllerUnmarkWatched(variables);
			return result.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["shows"] });
		},
	});
}

// Type exports
export type {
	MoviesControllerGetMovieDetailsResponse,
	MoviesControllerGetUserMoviesResponse,
	ShowsControllerGetShowDetailsResponse,
	ShowsControllerGetUserShowsResponse,
};
