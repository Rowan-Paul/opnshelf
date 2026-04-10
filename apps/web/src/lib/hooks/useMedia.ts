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
		mutationFn: moviesControllerMarkWatched,
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
		mutationFn: moviesControllerUnmarkWatched,
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
export function useUserShows(userDid: string, pageSize = 20) {
	return useQuery({
		...showsControllerGetUserShowsOptions({
			path: { userDid },
			query: { page: 1, pageSize },
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
		mutationFn: showsControllerMarkWatched,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["shows"] });
		},
	});
}

// Unmark episode as watched mutation
export function useUnmarkEpisodeWatched() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: showsControllerUnmarkWatched,
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
