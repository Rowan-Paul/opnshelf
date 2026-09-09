import {
	invalidateWatchActivityQueries,
	moviesControllerDeleteWatchHistoryEntryMutation,
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerMarkWatchedMutation,
	moviesControllerUnmarkWatchedMutation,
	showsControllerDeleteEpisodeWatchHistoryEntryMutation,
	showsControllerGetSeasonDetailsQueryKey,
	showsControllerMarkSeasonWatchedMutation,
	showsControllerMarkShowWatchedMutation,
	showsControllerMarkWatchedMutation,
	showsControllerUnmarkWatchedMutation,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { posthog } from "#/integrations/posthog/provider";
import { useAuth } from "#/lib/auth-context";

// Warn before bulk-logging this many episodes — that volume can exhaust a
// user's hourly PDS write budget and fail partway (see ADR-0009).
const BULK_WATCH_WARN_THRESHOLD = 200;

// Toast the outcome of a bulk mark, distinguishing full / partial / total
// failure from the { count, requested } the backend returns.
function toastBulkResult(
	data: { count: number; requested: number },
	fullSuccess: string,
) {
	if (data.count === 0) {
		toast.error(
			"Nothing added — your server's rate limit was hit. Try again later.",
		);
	} else if (data.count < data.requested) {
		toast.warning(
			`Added ${data.count} of ${data.requested} episodes — hit your server's rate limit. Try the rest later.`,
		);
	} else {
		toast.success(fullSuccess);
	}
}

function captureWatchLogged(
	mediaType: "movie" | "show",
	watchScope: "movie" | "episode" | "season" | "show",
	watchedAt?: string | null,
	itemsLogged?: number,
) {
	if (itemsLogged === 0) return;
	posthog.capture("watch_logged", {
		media_type: mediaType,
		watch_scope: watchScope,
		source: "web",
		date_kind:
			watchedAt === null ? "undated" : watchedAt ? "specified" : "current",
		...(itemsLogged === undefined ? {} : { items_logged: itemsLogged }),
	});
}

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

	// Every watch mutation changes the same set of derived data: the shelf, the
	// activity summary, up next, the tracked-movie/show lists and the profile
	// stats behind the dashboard bar chart. One shared invalidation keeps them
	// all in sync instead of each mutation listing its own subset.
	const invalidateActivity = () => {
		invalidateWatchActivityQueries(queryClient);
		queryClient.invalidateQueries({ queryKey: ["shows", "progress"] });
	};

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
		onSuccess: (_data, variables) => {
			captureWatchLogged("movie", "movie", variables.body.watchedAt);
			toast.success("Added to shelf");
		},
		onError: (error, _variables, context) => {
			if (context?.previousUserMovies) {
				queryClient.setQueryData(
					context.userMoviesKey,
					context.previousUserMovies,
				);
			}
			toast.error(
				error instanceof Error ? error.message : "Failed to add to shelf",
			);
		},
		onSettled: () => {
			invalidateActivity();
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
			toast.success("Removed from shelf");
		},
		onError: (error, _variables, context) => {
			if (context?.previousUserMovies) {
				queryClient.setQueryData(
					context.userMoviesKey,
					context.previousUserMovies,
				);
			}
			toast.error(
				error instanceof Error ? error.message : "Failed to remove from shelf",
			);
		},
		onSettled: () => {
			invalidateActivity();
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
			invalidateActivity();
		},
	});

	const markEpisodeWatched = useMutation({
		mutationKey: ["shows", showId, "episodes", "markWatched"],
		...showsControllerMarkWatchedMutation(),
		onSuccess: (_data, variables) => {
			captureWatchLogged("show", "episode", variables.body.watchedAt);
			toast.success("Episode added to shelf");
			invalidateActivity();
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
					: "Failed to add episode to shelf",
			);
		},
	});

	const unmarkEpisodeWatched = useMutation({
		mutationKey: ["shows", showId, "episodes", "unmarkWatched"],
		...showsControllerUnmarkWatchedMutation(),
		onSuccess: (_data, variables) => {
			toast.success("Episode removed from shelf");
			invalidateActivity();
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
					: "Failed to remove episode from shelf",
			);
		},
	});

	const markShowWatched = useMutation({
		mutationKey: ["shows", showId, "markShowWatched"],
		...showsControllerMarkShowWatchedMutation(),
		onSuccess: (data, variables) => {
			captureWatchLogged("show", "show", variables.body.watchedAt, data.count);
			toastBulkResult(data, "Show added to shelf");
			invalidateActivity();
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to add show to shelf",
			);
		},
	});

	const unmarkShowWatched = useMutation({
		mutationKey: ["shows", showId, "unmarkShowWatched"],
		...showsControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			toast.success("Show removed from shelf");
			invalidateActivity();
		},
		onError: (error) => {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to remove show from shelf",
			);
		},
	});

	const markSeasonWatched = useMutation({
		mutationKey: ["shows", showId, "markSeasonWatched"],
		...showsControllerMarkSeasonWatchedMutation(),
		onSuccess: (data, variables) => {
			captureWatchLogged(
				"show",
				"season",
				variables.body.watchedAt,
				data.count,
			);
			toastBulkResult(data, "Season added to shelf");
			invalidateActivity();
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
					: "Failed to add season to shelf",
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
			invalidateActivity();
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

	const handleMarkShowWatched = (watchedAt?: string, episodeCount?: number) => {
		if (!isAuthenticated || options.mediaType !== "show") return;
		if (
			episodeCount !== undefined &&
			episodeCount > BULK_WATCH_WARN_THRESHOLD &&
			!window.confirm(
				`This show has ${episodeCount} episodes. Logging them all may hit your server's rate limit and fail partway — continue?`,
			)
		) {
			return;
		}
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
		episodeCount?: number,
	) => {
		if (!isAuthenticated || options.mediaType !== "show") return;
		if (
			episodeCount !== undefined &&
			episodeCount > BULK_WATCH_WARN_THRESHOLD &&
			!window.confirm(
				`This season has ${episodeCount} episodes. Logging them all may hit your server's rate limit and fail partway — continue?`,
			)
		) {
			return;
		}
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
