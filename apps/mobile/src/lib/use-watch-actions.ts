import {
	type EpisodeHistoryItemDto,
	moviesControllerDeleteWatchHistoryEntryMutation,
	moviesControllerGetMovieWatchHistoryQueryKey,
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerMarkWatchedMutation,
	moviesControllerUnmarkWatchedMutation,
	shelfControllerGetUserActivitySummaryQueryKey,
	shelfControllerGetUserShelfQueryKey,
	showsControllerDeleteEpisodeWatchHistoryEntryMutation,
	showsControllerGetShowWatchHistoryQueryKey,
	showsControllerMarkSeasonWatchedMutation,
	showsControllerMarkShowWatchedMutation,
	showsControllerMarkWatchedMutation,
	showsControllerUnmarkWatchedMutation,
	type TrackedMovieDto,
	type WatchHistoryItemDto,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";

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

function errorMessage(error: unknown, fallback: string) {
	return error instanceof Error ? error.message : fallback;
}

/**
 * Tracking mutations for a movie or show with optimistic cache updates.
 *
 * Optimistic strategy:
 * - Movies: optimistically push/remove the movie in the tracked-movies list and
 *   prepend/clear the per-movie watch-history list so the detail UI flips state
 *   immediately. Snapshot both, roll both back on error, invalidate both + the
 *   shelf on settle.
 * - Shows: optimistically push/remove the (season, episode) entry in the show
 *   watch-history list. Show/season marks invalidate on settle (they touch many
 *   episodes server-side, so a full refetch is the safe reconciliation).
 *
 * Every mutation carries an explicit array-based `mutationKey`.
 */
export function useWatchActions(options: UseWatchActionsOptions) {
	const { isAuthenticated, user } = useAuth();
	const userDid = user?.did ?? "";
	const queryClient = useQueryClient();
	const toast = useToast();

	const haptic = (style: Haptics.ImpactFeedbackStyle) => {
		void Haptics.impactAsync(style).catch(() => {});
	};

	const invalidateShelf = () => {
		queryClient.invalidateQueries({
			queryKey: shelfControllerGetUserShelfQueryKey({ path: { userDid } }),
		});
		queryClient.invalidateQueries({
			queryKey: shelfControllerGetUserActivitySummaryQueryKey({
				path: { userDid },
			}),
		});
	};

	// --- Movie keys ---
	const movieId = options.mediaType === "movie" ? options.movieId : "";
	const userMoviesKey = moviesControllerGetUserMoviesQueryKey({
		path: { userDid },
	});
	const movieHistoryKey = moviesControllerGetMovieWatchHistoryQueryKey({
		path: { userDid, movieId },
	});

	const markMovie = useMutation({
		mutationKey: ["movies", movieId, "markWatched"],
		...moviesControllerMarkWatchedMutation(),
		onMutate: async (variables) => {
			await Promise.all([
				queryClient.cancelQueries({ queryKey: userMoviesKey }),
				queryClient.cancelQueries({ queryKey: movieHistoryKey }),
			]);
			const prevUserMovies =
				queryClient.getQueryData<TrackedMovieDto[]>(userMoviesKey);
			const prevHistory =
				queryClient.getQueryData<WatchHistoryItemDto[]>(movieHistoryKey);

			const watchedDate = variables.body.watchedAt ?? new Date().toISOString();
			queryClient.setQueryData<WatchHistoryItemDto[]>(
				movieHistoryKey,
				(old) => [
					{ id: `optimistic-${Date.now()}`, watchedDate },
					...(old ?? []),
				],
			);
			queryClient.setQueryData<TrackedMovieDto[]>(userMoviesKey, (old) => {
				if (!Array.isArray(old)) return old;
				if (old.some((m) => String(m.movieId) === movieId)) return old;
				return [...old, { movieId } as TrackedMovieDto];
			});
			return { prevUserMovies, prevHistory };
		},
		onError: (error, _vars, context) => {
			if (context?.prevUserMovies !== undefined) {
				queryClient.setQueryData(userMoviesKey, context.prevUserMovies);
			}
			if (context?.prevHistory !== undefined) {
				queryClient.setQueryData(movieHistoryKey, context.prevHistory);
			}
			toast.error(errorMessage(error, "Failed to mark as watched"));
		},
		onSuccess: () => {
			haptic(Haptics.ImpactFeedbackStyle.Medium);
			toast.success("Added to shelf");
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: userMoviesKey });
			queryClient.invalidateQueries({ queryKey: movieHistoryKey });
			invalidateShelf();
		},
	});

	const unmarkMovie = useMutation({
		mutationKey: ["movies", movieId, "unmarkWatched"],
		...moviesControllerUnmarkWatchedMutation(),
		onMutate: async () => {
			await Promise.all([
				queryClient.cancelQueries({ queryKey: userMoviesKey }),
				queryClient.cancelQueries({ queryKey: movieHistoryKey }),
			]);
			const prevUserMovies =
				queryClient.getQueryData<TrackedMovieDto[]>(userMoviesKey);
			const prevHistory =
				queryClient.getQueryData<WatchHistoryItemDto[]>(movieHistoryKey);

			queryClient.setQueryData<WatchHistoryItemDto[]>(movieHistoryKey, []);
			queryClient.setQueryData<TrackedMovieDto[]>(userMoviesKey, (old) =>
				Array.isArray(old)
					? old.filter((m) => String(m.movieId) !== movieId)
					: old,
			);
			return { prevUserMovies, prevHistory };
		},
		onError: (error, _vars, context) => {
			if (context?.prevUserMovies !== undefined) {
				queryClient.setQueryData(userMoviesKey, context.prevUserMovies);
			}
			if (context?.prevHistory !== undefined) {
				queryClient.setQueryData(movieHistoryKey, context.prevHistory);
			}
			toast.error(errorMessage(error, "Failed to remove from watched"));
		},
		onSuccess: () => {
			haptic(Haptics.ImpactFeedbackStyle.Light);
			toast.success("Removed from shelf");
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: userMoviesKey });
			queryClient.invalidateQueries({ queryKey: movieHistoryKey });
			invalidateShelf();
		},
	});

	const deleteMovieEntry = useMutation({
		mutationKey: ["movies", movieId, "deleteWatchHistoryEntry"],
		...moviesControllerDeleteWatchHistoryEntryMutation(),
		onMutate: async (variables) => {
			await Promise.all([
				queryClient.cancelQueries({ queryKey: movieHistoryKey }),
				queryClient.cancelQueries({ queryKey: userMoviesKey }),
			]);
			const prevHistory =
				queryClient.getQueryData<WatchHistoryItemDto[]>(movieHistoryKey);
			const prevUserMovies =
				queryClient.getQueryData<TrackedMovieDto[]>(userMoviesKey);
			const id = variables.path?.trackedMovieId;
			const next = (prevHistory ?? []).filter((e) => e.id !== id);
			queryClient.setQueryData<WatchHistoryItemDto[]>(movieHistoryKey, next);
			// Last play removed → the movie is no longer on the shelf.
			if (next.length === 0) {
				queryClient.setQueryData<TrackedMovieDto[]>(userMoviesKey, (old) =>
					Array.isArray(old)
						? old.filter((m) => String(m.movieId) !== movieId)
						: old,
				);
			}
			return { prevHistory, prevUserMovies };
		},
		onError: (error, _vars, context) => {
			if (context?.prevHistory !== undefined) {
				queryClient.setQueryData(movieHistoryKey, context.prevHistory);
			}
			if (context?.prevUserMovies !== undefined) {
				queryClient.setQueryData(userMoviesKey, context.prevUserMovies);
			}
			toast.error(errorMessage(error, "Failed to delete watch"));
		},
		onSuccess: () => {
			haptic(Haptics.ImpactFeedbackStyle.Light);
			toast.success("Watch deleted");
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: movieHistoryKey });
			queryClient.invalidateQueries({ queryKey: userMoviesKey });
			invalidateShelf();
		},
	});

	// --- Show keys ---
	const showId = options.mediaType === "show" ? options.showId : "";
	const showHistoryKey = showsControllerGetShowWatchHistoryQueryKey({
		path: { userDid, showId },
	});

	const markEpisode = useMutation({
		mutationKey: ["shows", showId, "episodes", "markWatched"],
		...showsControllerMarkWatchedMutation(),
		onMutate: async (variables) => {
			await queryClient.cancelQueries({ queryKey: showHistoryKey });
			const prevHistory =
				queryClient.getQueryData<EpisodeHistoryItemDto[]>(showHistoryKey);
			const { seasonNumber, episodeNumber, watchedAt } = variables.body;
			queryClient.setQueryData<EpisodeHistoryItemDto[]>(
				showHistoryKey,
				(old) => [
					{
						episodeNumber,
						id: `optimistic-${Date.now()}`,
						seasonNumber,
						watchedDate: watchedAt ?? new Date().toISOString(),
					},
					...(old ?? []),
				],
			);
			return { prevHistory };
		},
		onError: (error, _vars, context) => {
			if (context?.prevHistory !== undefined) {
				queryClient.setQueryData(showHistoryKey, context.prevHistory);
			}
			toast.error(errorMessage(error, "Failed to mark episode as watched"));
		},
		onSuccess: () => {
			haptic(Haptics.ImpactFeedbackStyle.Medium);
			toast.success("Episode added to shelf");
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: showHistoryKey });
			invalidateShelf();
		},
	});

	const unmarkEpisode = useMutation({
		mutationKey: ["shows", showId, "episodes", "unmarkWatched"],
		...showsControllerUnmarkWatchedMutation(),
		onMutate: async (variables) => {
			await queryClient.cancelQueries({ queryKey: showHistoryKey });
			const prevHistory =
				queryClient.getQueryData<EpisodeHistoryItemDto[]>(showHistoryKey);
			const seasonNumber = variables.query?.seasonNumber as number | undefined;
			const episodeNumber = variables.query?.episodeNumber as
				| number
				| undefined;
			queryClient.setQueryData<EpisodeHistoryItemDto[]>(
				showHistoryKey,
				(old) =>
					Array.isArray(old)
						? old.filter(
								(ep) =>
									!(
										ep.seasonNumber === seasonNumber &&
										ep.episodeNumber === episodeNumber
									),
							)
						: old,
			);
			return { prevHistory };
		},
		onError: (error, _vars, context) => {
			if (context?.prevHistory !== undefined) {
				queryClient.setQueryData(showHistoryKey, context.prevHistory);
			}
			toast.error(errorMessage(error, "Failed to remove episode"));
		},
		onSuccess: () => {
			haptic(Haptics.ImpactFeedbackStyle.Light);
			toast.success("Episode removed from shelf");
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: showHistoryKey });
			invalidateShelf();
		},
	});

	const deleteEpisodeEntry = useMutation({
		mutationKey: ["shows", showId, "episodes", "deleteWatchHistoryEntry"],
		...showsControllerDeleteEpisodeWatchHistoryEntryMutation(),
		onMutate: async (variables) => {
			await queryClient.cancelQueries({ queryKey: showHistoryKey });
			const prevHistory =
				queryClient.getQueryData<EpisodeHistoryItemDto[]>(showHistoryKey);
			const id = variables.path?.trackedEpisodeId;
			queryClient.setQueryData<EpisodeHistoryItemDto[]>(
				showHistoryKey,
				(old) => (Array.isArray(old) ? old.filter((e) => e.id !== id) : old),
			);
			return { prevHistory };
		},
		onError: (error, _vars, context) => {
			if (context?.prevHistory !== undefined) {
				queryClient.setQueryData(showHistoryKey, context.prevHistory);
			}
			toast.error(errorMessage(error, "Failed to delete watch"));
		},
		onSuccess: () => {
			haptic(Haptics.ImpactFeedbackStyle.Light);
			toast.success("Watch deleted");
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: showHistoryKey });
			invalidateShelf();
		},
	});

	const markShow = useMutation({
		mutationKey: ["shows", showId, "markShowWatched"],
		...showsControllerMarkShowWatchedMutation(),
		onError: (error) => {
			toast.error(errorMessage(error, "Failed to mark show as watched"));
		},
		onSuccess: () => {
			haptic(Haptics.ImpactFeedbackStyle.Medium);
			toast.success("Added to shelf");
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: showHistoryKey });
			invalidateShelf();
		},
	});

	const markSeason = useMutation({
		mutationKey: ["shows", showId, "markSeasonWatched"],
		...showsControllerMarkSeasonWatchedMutation(),
		onError: (error) => {
			toast.error(errorMessage(error, "Failed to mark season as watched"));
		},
		onSuccess: () => {
			haptic(Haptics.ImpactFeedbackStyle.Medium);
			toast.success("Season added to shelf");
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: showHistoryKey });
			invalidateShelf();
		},
	});

	const unmarkShow = useMutation({
		mutationKey: ["shows", showId, "unmarkShowWatched"],
		...showsControllerUnmarkWatchedMutation(),
		onError: (error) => {
			toast.error(errorMessage(error, "Failed to remove show"));
		},
		onSuccess: () => {
			haptic(Haptics.ImpactFeedbackStyle.Light);
			toast.success("Removed from shelf");
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: showHistoryKey });
			invalidateShelf();
		},
	});

	const unmarkSeason = useMutation({
		mutationKey: ["shows", showId, "unmarkSeasonWatched"],
		...showsControllerUnmarkWatchedMutation(),
		onError: (error) => {
			toast.error(errorMessage(error, "Failed to remove season"));
		},
		onSuccess: () => {
			haptic(Haptics.ImpactFeedbackStyle.Light);
			toast.success("Season removed from shelf");
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: showHistoryKey });
			invalidateShelf();
		},
	});

	// --- Handlers ---
	const markMovieWatched = (watchedAt?: string) => {
		if (!isAuthenticated || options.mediaType !== "movie") return;
		markMovie.mutate({ body: { movieId: options.movieId, watchedAt } });
	};

	const unmarkMovieWatched = () => {
		if (!isAuthenticated || options.mediaType !== "movie") return;
		unmarkMovie.mutate({
			path: { movieId: options.movieId },
			query: { mode: "all" },
		});
	};

	const markEpisodeWatched = (
		seasonNumber: number,
		episodeNumber: number,
		watchedAt?: string,
	) => {
		if (!isAuthenticated || options.mediaType !== "show") return;
		markEpisode.mutate({
			body: { showId: options.showId, seasonNumber, episodeNumber, watchedAt },
		});
	};

	const unmarkEpisodeWatched = (
		seasonNumber: number,
		episodeNumber: number,
		mode: "latest" | "all" = "all",
	) => {
		if (!isAuthenticated || options.mediaType !== "show") return;
		unmarkEpisode.mutate({
			path: { showId: options.showId },
			query: { seasonNumber, episodeNumber, mode },
		});
	};

	const markShowWatched = (watchedAt?: string) => {
		if (!isAuthenticated || options.mediaType !== "show") return;
		markShow.mutate({ body: { showId: options.showId, watchedAt } });
	};

	const unmarkShowWatched = () => {
		if (!isAuthenticated || options.mediaType !== "show") return;
		unmarkShow.mutate({
			path: { showId: options.showId },
			query: { mode: "all" },
		});
	};

	const markSeasonWatched = (seasonNumber: number, watchedAt?: string) => {
		if (!isAuthenticated || options.mediaType !== "show") return;
		markSeason.mutate({
			body: { showId: options.showId, seasonNumber, watchedAt },
		});
	};

	const unmarkSeasonWatched = (seasonNumber: number) => {
		if (!isAuthenticated || options.mediaType !== "show") return;
		unmarkSeason.mutate({
			path: { showId: options.showId },
			query: { mode: "all", seasonNumber },
		});
	};

	const deleteMovieWatchHistoryEntry = (trackedMovieId: string) => {
		if (!isAuthenticated || options.mediaType !== "movie") return;
		deleteMovieEntry.mutate({ path: { trackedMovieId } });
	};

	const deleteEpisodeWatchHistoryEntry = (trackedEpisodeId: string) => {
		if (!isAuthenticated || options.mediaType !== "show") return;
		deleteEpisodeEntry.mutate({ path: { trackedEpisodeId } });
	};

	return {
		// Movie
		markMovieWatched,
		unmarkMovieWatched,
		deleteMovieWatchHistoryEntry,
		isMarkMoviePending: markMovie.isPending,
		isUnmarkMoviePending: unmarkMovie.isPending,
		isDeleteMovieEntryPending: deleteMovieEntry.isPending,
		// Show
		markEpisodeWatched,
		unmarkEpisodeWatched,
		markShowWatched,
		unmarkShowWatched,
		markSeasonWatched,
		unmarkSeasonWatched,
		deleteEpisodeWatchHistoryEntry,
		isMarkEpisodePending: markEpisode.isPending,
		isUnmarkEpisodePending: unmarkEpisode.isPending,
		isDeleteEpisodeEntryPending: deleteEpisodeEntry.isPending,
		isMarkShowPending: markShow.isPending,
		isUnmarkShowPending: unmarkShow.isPending,
		isMarkSeasonPending: markSeason.isPending,
		isUnmarkSeasonPending: unmarkSeason.isPending,
	};
}
