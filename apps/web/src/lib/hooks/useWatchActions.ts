import {
	moviesControllerGetMovieWatchHistoryQueryKey,
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerMarkWatchedMutation,
	moviesControllerUnmarkWatchedMutation,
	showsControllerGetSeasonDetailsQueryKey,
	showsControllerGetShowWatchHistoryQueryKey,
	showsControllerGetUserUpNextOptions,
	showsControllerMarkSeasonWatchedMutation,
	showsControllerMarkShowWatchedMutation,
	showsControllerMarkWatchedMutation,
	showsControllerUnmarkWatchedMutation,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "#/lib/auth-context";

interface WatchActionsMovieOptions {
	mediaType: "movie";
	movieId: string;
}

interface WatchActionsShowOptions {
	mediaType: "show";
	showId: string;
}

type UseWatchActionsOptions =
	| WatchActionsMovieOptions
	| WatchActionsShowOptions;

export function useWatchActions(options: UseWatchActionsOptions) {
	const { isAuthenticated, user } = useAuth();
	const userDid = user?.did || "";
	const queryClient = useQueryClient();

	// Movie mutations
	const markMovieWatched = useMutation({
		...moviesControllerMarkWatchedMutation(),
		onMutate: async () => {
			const userMoviesKey = moviesControllerGetUserMoviesQueryKey({
				path: { userDid },
			});
			await queryClient.cancelQueries({ queryKey: userMoviesKey });
			const previousUserMovies = queryClient.getQueryData(userMoviesKey);

			queryClient.setQueryData(userMoviesKey, (old: unknown) => {
				if (!old || !Array.isArray(old)) return old;
				return [
					...old,
					{
						movieId:
							options.mediaType === "movie" ? Number(options.movieId) : 0,
					},
				];
			});

			return { previousUserMovies, userMoviesKey };
		},
		onError: (_err, _variables, context) => {
			if (context?.previousUserMovies) {
				queryClient.setQueryData(
					context.userMoviesKey,
					context.previousUserMovies,
				);
			}
		},
		onSettled: (_data, _error, _variables, context) => {
			if (context?.userMoviesKey) {
				queryClient.invalidateQueries({ queryKey: context.userMoviesKey });
			}
			if (options.mediaType === "movie") {
				queryClient.invalidateQueries({
					queryKey: moviesControllerGetMovieWatchHistoryQueryKey({
						path: { userDid, movieId: options.movieId },
					}),
				});
			}
		},
	});

	const unmarkMovieWatched = useMutation({
		...moviesControllerUnmarkWatchedMutation(),
		onMutate: async () => {
			const userMoviesKey = moviesControllerGetUserMoviesQueryKey({
				path: { userDid },
			});
			await queryClient.cancelQueries({ queryKey: userMoviesKey });
			const previousUserMovies = queryClient.getQueryData(userMoviesKey);

			queryClient.setQueryData(userMoviesKey, (old: unknown) => {
				if (!old || !Array.isArray(old)) return old;
				return old.filter(
					(m: { movieId: number }) =>
						String(m.movieId) !==
						(options.mediaType === "movie" ? options.movieId : ""),
				);
			});

			return { previousUserMovies, userMoviesKey };
		},
		onError: (_err, _variables, context) => {
			if (context?.previousUserMovies) {
				queryClient.setQueryData(
					context.userMoviesKey,
					context.previousUserMovies,
				);
			}
		},
		onSettled: (_data, _error, _variables, context) => {
			if (context?.userMoviesKey) {
				queryClient.invalidateQueries({ queryKey: context.userMoviesKey });
			}
			if (options.mediaType === "movie") {
				queryClient.invalidateQueries({
					queryKey: moviesControllerGetMovieWatchHistoryQueryKey({
						path: { userDid, movieId: options.movieId },
					}),
				});
			}
		},
	});

	// Show mutations
	const showWatchHistoryKey =
		options.mediaType === "show"
			? showsControllerGetShowWatchHistoryQueryKey({
					path: { userDid, showId: options.showId },
				})
			: [];

	const invalidateShowQueries = () => {
		if (options.mediaType !== "show") return;
		queryClient.invalidateQueries({ queryKey: showWatchHistoryKey });
		queryClient.invalidateQueries({
			queryKey: showsControllerGetUserUpNextOptions({ path: { userDid } })
				.queryKey,
		});
		queryClient.invalidateQueries({ queryKey: ["shows"] });
	};

	const markEpisodeWatched = useMutation({
		...showsControllerMarkWatchedMutation(),
		onSuccess: (_data, variables) => {
			invalidateShowQueries();
			// Also invalidate season details so season page stays in sync
			if (options.mediaType === "show") {
				queryClient.invalidateQueries({
					queryKey: showsControllerGetSeasonDetailsQueryKey({
						path: {
							showId: options.showId,
							seasonNumber: String(variables.body.seasonNumber),
						},
					}),
				});
			}
		},
	});

	const unmarkEpisodeWatched = useMutation({
		...showsControllerUnmarkWatchedMutation(),
		onSuccess: (_data, variables) => {
			invalidateShowQueries();
			if (options.mediaType === "show") {
				queryClient.invalidateQueries({
					queryKey: showsControllerGetSeasonDetailsQueryKey({
						path: {
							showId: options.showId,
							seasonNumber: String(variables.query?.seasonNumber),
						},
					}),
				});
			}
		},
	});

	const markShowWatched = useMutation({
		...showsControllerMarkShowWatchedMutation(),
		onSuccess: () => {
			invalidateShowQueries();
		},
	});

	const unmarkShowWatched = useMutation({
		...showsControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			invalidateShowQueries();
		},
	});

	const markSeasonWatched = useMutation({
		...showsControllerMarkSeasonWatchedMutation(),
		onSuccess: (_data, variables) => {
			invalidateShowQueries();
			if (options.mediaType === "show") {
				queryClient.invalidateQueries({
					queryKey: showsControllerGetSeasonDetailsQueryKey({
						path: {
							showId: options.showId,
							seasonNumber: String(variables.body.seasonNumber),
						},
					}),
				});
			}
		},
	});

	const handleMarkMovieWatched = () => {
		if (!isAuthenticated || options.mediaType !== "movie") return;
		markMovieWatched.mutate({ body: { movieId: options.movieId } });
	};

	const handleUnmarkMovieWatched = () => {
		if (!isAuthenticated || options.mediaType !== "movie") return;
		unmarkMovieWatched.mutate({
			path: { movieId: options.movieId },
			query: { mode: "all" },
		});
	};

	const handleMarkEpisodeWatched = (
		seasonNumber: number,
		episodeNumber: number,
	) => {
		if (!isAuthenticated || options.mediaType !== "show") return;
		markEpisodeWatched.mutate({
			body: { showId: options.showId, seasonNumber, episodeNumber },
		});
	};

	const handleUnmarkEpisodeWatched = (
		seasonNumber: number,
		episodeNumber: number,
	) => {
		if (!isAuthenticated || options.mediaType !== "show") return;
		unmarkEpisodeWatched.mutate({
			path: { showId: options.showId },
			query: { seasonNumber, episodeNumber },
		});
	};

	const handleMarkShowWatched = () => {
		if (!isAuthenticated || options.mediaType !== "show") return;
		markShowWatched.mutate({ body: { showId: options.showId } });
	};

	const handleUnmarkShowWatched = () => {
		if (!isAuthenticated || options.mediaType !== "show") return;
		unmarkShowWatched.mutate({
			path: { showId: options.showId },
			query: { mode: "all" },
		});
	};

	const handleMarkSeasonWatched = (seasonNumber: number) => {
		if (!isAuthenticated || options.mediaType !== "show") return;
		markSeasonWatched.mutate({
			body: { showId: options.showId, seasonNumber },
		});
	};

	const handleUnmarkSeasonWatched = (seasonNumber: number) => {
		if (!isAuthenticated || options.mediaType !== "show") return;
		unmarkShowWatched.mutate({
			path: { showId: options.showId },
			query: { mode: "all", seasonNumber: String(seasonNumber) },
		});
	};

	return {
		// Movie actions
		markMovieWatched: handleMarkMovieWatched,
		unmarkMovieWatched: handleUnmarkMovieWatched,
		isMarkMoviePending: markMovieWatched.isPending,
		isUnmarkMoviePending: unmarkMovieWatched.isPending,
		// Show actions
		markEpisodeWatched: handleMarkEpisodeWatched,
		unmarkEpisodeWatched: handleUnmarkEpisodeWatched,
		markShowWatched: handleMarkShowWatched,
		unmarkShowWatched: handleUnmarkShowWatched,
		markSeasonWatched: handleMarkSeasonWatched,
		unmarkSeasonWatched: handleUnmarkSeasonWatched,
		isMarkEpisodePending: markEpisodeWatched.isPending,
		isUnmarkEpisodePending: unmarkEpisodeWatched.isPending,
		isMarkShowPending: markShowWatched.isPending,
		isUnmarkShowPending: unmarkShowWatched.isPending,
		isMarkSeasonPending: markSeasonWatched.isPending,
	};
}
