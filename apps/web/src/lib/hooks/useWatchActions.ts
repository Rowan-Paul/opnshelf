import {
	moviesControllerDeleteWatchHistoryEntryMutation,
	moviesControllerGetMovieWatchHistoryQueryKey,
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerMarkWatchedMutation,
	moviesControllerUnmarkWatchedMutation,
	shelfControllerGetUserActivitySummaryQueryKey,
	shelfControllerGetUserShelfQueryKey,
	showsControllerDeleteEpisodeWatchHistoryEntryMutation,
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
			invalidateShelfQueries();
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
			invalidateShelfQueries();
		},
	});

	const deleteMovieWatchHistoryEntry = useMutation({
		...moviesControllerDeleteWatchHistoryEntryMutation(),
		onSettled: () => {
			if (options.mediaType === "movie") {
				queryClient.invalidateQueries({
					queryKey: moviesControllerGetMovieWatchHistoryQueryKey({
						path: { userDid, movieId: options.movieId },
					}),
				});
			}
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetUserMoviesQueryKey({
					path: { userDid },
				}),
			});
			invalidateShelfQueries();
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

	const invalidateShelfQueries = () => {
		queryClient.invalidateQueries({
			queryKey: shelfControllerGetUserShelfQueryKey({
				path: { userDid },
			}),
		});
		queryClient.invalidateQueries({
			queryKey: shelfControllerGetUserActivitySummaryQueryKey({
				path: { userDid },
			}),
		});
	};

	const markEpisodeWatched = useMutation({
		...showsControllerMarkWatchedMutation(),
		onSuccess: (_data, variables) => {
			invalidateShowQueries();
			invalidateShelfQueries();
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
			invalidateShelfQueries();
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
			invalidateShelfQueries();
		},
	});

	const unmarkShowWatched = useMutation({
		...showsControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			invalidateShowQueries();
			invalidateShelfQueries();
		},
	});

	const markSeasonWatched = useMutation({
		...showsControllerMarkSeasonWatchedMutation(),
		onSuccess: (_data, variables) => {
			invalidateShowQueries();
			invalidateShelfQueries();
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

	const deleteEpisodeWatchHistoryEntry = useMutation({
		...showsControllerDeleteEpisodeWatchHistoryEntryMutation(),
		onSettled: () => {
			invalidateShowQueries();
			invalidateShelfQueries();
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

	const handleDeleteMovieWatchHistoryEntry = (trackedMovieId: string) => {
		if (!isAuthenticated || options.mediaType !== "movie") return;
		deleteMovieWatchHistoryEntry.mutate({
			path: { trackedMovieId },
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
		mode: "latest" | "all" = "latest",
	) => {
		if (!isAuthenticated || options.mediaType !== "show") return;
		unmarkEpisodeWatched.mutate({
			path: { showId: options.showId },
			query: { seasonNumber, episodeNumber, mode },
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

	const handleDeleteEpisodeWatchHistoryEntry = (trackedEpisodeId: string) => {
		if (!isAuthenticated || options.mediaType !== "show") return;
		deleteEpisodeWatchHistoryEntry.mutate({
			path: { trackedEpisodeId },
		});
	};

	return {
		// Movie actions
		markMovieWatched: handleMarkMovieWatched,
		unmarkMovieWatched: handleUnmarkMovieWatched,
		deleteMovieWatchHistoryEntry: handleDeleteMovieWatchHistoryEntry,
		isMarkMoviePending: markMovieWatched.isPending,
		isUnmarkMoviePending: unmarkMovieWatched.isPending,
		isDeleteMovieHistoryPending: deleteMovieWatchHistoryEntry.isPending,
		// Show actions
		markEpisodeWatched: handleMarkEpisodeWatched,
		unmarkEpisodeWatched: handleUnmarkEpisodeWatched,
		markShowWatched: handleMarkShowWatched,
		unmarkShowWatched: handleUnmarkShowWatched,
		markSeasonWatched: handleMarkSeasonWatched,
		unmarkSeasonWatched: handleUnmarkSeasonWatched,
		deleteEpisodeWatchHistoryEntry: handleDeleteEpisodeWatchHistoryEntry,
		isMarkEpisodePending: markEpisodeWatched.isPending,
		isUnmarkEpisodePending: unmarkEpisodeWatched.isPending,
		isMarkShowPending: markShowWatched.isPending,
		isUnmarkShowPending: unmarkShowWatched.isPending,
		isMarkSeasonPending: markSeasonWatched.isPending,
		isDeleteEpisodeHistoryPending: deleteEpisodeWatchHistoryEntry.isPending,
	};
}
