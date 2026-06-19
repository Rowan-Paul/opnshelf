import {
	moviesControllerDeleteWatchHistoryEntryMutation,
	moviesControllerGetMovieWatchHistoryQueryKey,
	moviesControllerGetUserMoviesPaginatedQueryKey,
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerMarkWatchedMutation,
	moviesControllerUnmarkWatchedMutation,
	shelfControllerGetUserActivitySummaryQueryKey,
	shelfControllerGetUserShelfQueryKey,
	showsControllerDeleteEpisodeWatchHistoryEntryMutation,
	showsControllerGetSeasonDetailsQueryKey,
	showsControllerGetShowWatchHistoryQueryKey,
	showsControllerGetUserEpisodesPaginatedQueryKey,
	showsControllerGetUserUpNextOptions,
	showsControllerMarkSeasonWatchedMutation,
	showsControllerMarkShowWatchedMutation,
	showsControllerMarkWatchedMutation,
	showsControllerUnmarkWatchedMutation,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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

	const movieId = options.mediaType === "movie" ? options.movieId : "";
	const showId = options.mediaType === "show" ? options.showId : "";

	// Movie mutations
	const markMovieWatched = useMutation({
		mutationKey: ["movies", movieId, "markWatched"],
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
		onSuccess: () => {
			toast.success("Marked as watched");
		},
		onError: (error, _variables, context) => {
			if (context?.previousUserMovies) {
				queryClient.setQueryData(
					context.userMoviesKey,
					context.previousUserMovies,
				);
			}
			toast.error(
				error instanceof Error ? error.message : "Failed to mark as watched",
			);
		},
		onSettled: () => {
			invalidateUserMoviesQueries();
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
		mutationKey: ["movies", movieId, "unmarkWatched"],
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
		onSuccess: () => {
			toast.success("Removed from watched");
		},
		onError: (error, _variables, context) => {
			if (context?.previousUserMovies) {
				queryClient.setQueryData(
					context.userMoviesKey,
					context.previousUserMovies,
				);
			}
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to remove from watched",
			);
		},
		onSettled: () => {
			invalidateUserMoviesQueries();
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
		mutationKey: ["movies", movieId, "deleteWatchHistoryEntry"],
		...moviesControllerDeleteWatchHistoryEntryMutation(),
		onSuccess: () => {
			toast.success("Watch history entry deleted");
		},
		onError: (error) => {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to delete watch history entry",
			);
		},
		onSettled: () => {
			if (options.mediaType === "movie") {
				queryClient.invalidateQueries({
					queryKey: moviesControllerGetMovieWatchHistoryQueryKey({
						path: { userDid, movieId: options.movieId },
					}),
				});
			}
			invalidateUserMoviesQueries();
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
		// Profile "Recent Episodes" uses the paginated endpoint; partial match
		// (no `query`) covers any page size.
		queryClient.invalidateQueries({
			queryKey: showsControllerGetUserEpisodesPaginatedQueryKey({
				path: { userDid },
			}),
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

	// Invalidate both the non-paginated user-movies list and the paginated
	// variant used by the profile's "Recent Movies" section. Omitting `query`
	// makes this a partial match, so any page size (e.g. limit: 8) is covered.
	const invalidateUserMoviesQueries = () => {
		queryClient.invalidateQueries({
			queryKey: moviesControllerGetUserMoviesQueryKey({ path: { userDid } }),
		});
		queryClient.invalidateQueries({
			queryKey: moviesControllerGetUserMoviesPaginatedQueryKey({
				path: { userDid },
			}),
		});
	};

	const markEpisodeWatched = useMutation({
		mutationKey: ["shows", showId, "episodes", "markWatched"],
		...showsControllerMarkWatchedMutation(),
		onSuccess: (_data, variables) => {
			toast.success("Episode marked as watched");
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
		onError: (error) => {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to mark episode as watched",
			);
		},
	});

	const unmarkEpisodeWatched = useMutation({
		mutationKey: ["shows", showId, "episodes", "unmarkWatched"],
		...showsControllerUnmarkWatchedMutation(),
		onSuccess: (_data, variables) => {
			toast.success("Episode removed from watched");
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
		onError: (error) => {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to remove episode from watched",
			);
		},
	});

	const markShowWatched = useMutation({
		mutationKey: ["shows", showId, "markShowWatched"],
		...showsControllerMarkShowWatchedMutation(),
		onSuccess: () => {
			toast.success("Show marked as watched");
			invalidateShowQueries();
			invalidateShelfQueries();
		},
		onError: (error) => {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to mark show as watched",
			);
		},
	});

	const unmarkShowWatched = useMutation({
		mutationKey: ["shows", showId, "unmarkShowWatched"],
		...showsControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			toast.success("Show removed from watched");
			invalidateShowQueries();
			invalidateShelfQueries();
		},
		onError: (error) => {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to remove show from watched",
			);
		},
	});

	const markSeasonWatched = useMutation({
		mutationKey: ["shows", showId, "markSeasonWatched"],
		...showsControllerMarkSeasonWatchedMutation(),
		onSuccess: (_data, variables) => {
			toast.success("Season marked as watched");
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
		onError: (error) => {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to mark season as watched",
			);
		},
	});

	const deleteEpisodeWatchHistoryEntry = useMutation({
		mutationKey: ["shows", showId, "episodes", "deleteWatchHistoryEntry"],
		...showsControllerDeleteEpisodeWatchHistoryEntryMutation(),
		onSuccess: () => {
			toast.success("Episode watch history deleted");
		},
		onError: (error) => {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to delete episode watch history",
			);
		},
		onSettled: () => {
			invalidateShowQueries();
			invalidateShelfQueries();
		},
	});

	const handleMarkMovieWatched = (watchedAt?: string) => {
		if (!isAuthenticated || options.mediaType !== "movie") return;
		markMovieWatched.mutate({ body: { movieId: options.movieId, watchedAt } });
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
		watchedAt?: string,
	) => {
		if (!isAuthenticated || options.mediaType !== "show") return;
		markEpisodeWatched.mutate({
			body: { showId: options.showId, seasonNumber, episodeNumber, watchedAt },
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

	const handleMarkShowWatched = (watchedAt?: string) => {
		if (!isAuthenticated || options.mediaType !== "show") return;
		markShowWatched.mutate({ body: { showId: options.showId, watchedAt } });
	};

	const handleUnmarkShowWatched = () => {
		if (!isAuthenticated || options.mediaType !== "show") return;
		unmarkShowWatched.mutate({
			path: { showId: options.showId },
			query: { mode: "all" },
		});
	};

	const handleMarkSeasonWatched = (
		seasonNumber: number,
		watchedAt?: string,
	) => {
		if (!isAuthenticated || options.mediaType !== "show") return;
		markSeasonWatched.mutate({
			body: { showId: options.showId, seasonNumber, watchedAt },
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
