import {
	moviesControllerGetUserMoviesOptions,
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerMarkWatchedMutation,
	moviesControllerUnmarkWatchedMutation,
	shelfControllerGetUserActivitySummaryQueryKey,
	shelfControllerGetUserShelfQueryKey,
	type TrackedMovieDto,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useCallback, useMemo } from "react";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";

/**
 * Lightweight bulk movie watch-toggle for list/grid surfaces (e.g. a person's
 * filmography) where instantiating a full `useWatchActions` per card would be
 * wasteful. Reads the user's tracked-movies list once to derive watched state,
 * and exposes a single mark/unmark pair parameterised by `movieId` at call
 * time. Optimistically patches the shared tracked-movies cache and invalidates
 * the shelf on settle, matching `use-watch-actions`.
 *
 * Movies only — show "watched" is per-episode and can't be a single toggle.
 */
export function useMovieWatchToggle() {
	const { isAuthenticated, user } = useAuth();
	const userDid = user?.did ?? "";
	const queryClient = useQueryClient();
	const toast = useToast();

	const userMoviesKey = moviesControllerGetUserMoviesQueryKey({
		path: { userDid },
	});

	const { data: userMovies } = useQuery({
		...moviesControllerGetUserMoviesOptions({ path: { userDid } }),
		enabled: isAuthenticated && !!userDid,
	});

	const watchedIds = useMemo(() => {
		const set = new Set<string>();
		if (Array.isArray(userMovies)) {
			for (const m of userMovies) set.add(String(m.movieId));
		}
		return set;
	}, [userMovies]);

	const invalidateShelf = useCallback(() => {
		queryClient.invalidateQueries({
			queryKey: shelfControllerGetUserShelfQueryKey({ path: { userDid } }),
		});
		queryClient.invalidateQueries({
			queryKey: shelfControllerGetUserActivitySummaryQueryKey({
				path: { userDid },
			}),
		});
	}, [queryClient, userDid]);

	const errorMessage = (error: unknown, fallback: string) =>
		error instanceof Error ? error.message : fallback;

	const markMovie = useMutation({
		mutationKey: ["movies", "filmography", "markWatched"],
		...moviesControllerMarkWatchedMutation(),
		onMutate: async (variables) => {
			await queryClient.cancelQueries({ queryKey: userMoviesKey });
			const prev = queryClient.getQueryData<TrackedMovieDto[]>(userMoviesKey);
			const movieId = String(variables.body.movieId);
			queryClient.setQueryData<TrackedMovieDto[]>(userMoviesKey, (old) => {
				if (!Array.isArray(old)) return old;
				if (old.some((m) => String(m.movieId) === movieId)) return old;
				return [...old, { movieId } as TrackedMovieDto];
			});
			return { prev };
		},
		onError: (error, _vars, context) => {
			if (context?.prev !== undefined) {
				queryClient.setQueryData(userMoviesKey, context.prev);
			}
			toast.error(errorMessage(error, "Failed to add to shelf"));
		},
		onSuccess: () => {
			void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
				() => {},
			);
			toast.success("Added to shelf");
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: userMoviesKey });
			invalidateShelf();
		},
	});

	const unmarkMovie = useMutation({
		mutationKey: ["movies", "filmography", "unmarkWatched"],
		...moviesControllerUnmarkWatchedMutation(),
		onMutate: async (variables) => {
			await queryClient.cancelQueries({ queryKey: userMoviesKey });
			const prev = queryClient.getQueryData<TrackedMovieDto[]>(userMoviesKey);
			const movieId = String(variables.path.movieId);
			queryClient.setQueryData<TrackedMovieDto[]>(userMoviesKey, (old) =>
				Array.isArray(old)
					? old.filter((m) => String(m.movieId) !== movieId)
					: old,
			);
			return { prev };
		},
		onError: (error, _vars, context) => {
			if (context?.prev !== undefined) {
				queryClient.setQueryData(userMoviesKey, context.prev);
			}
			toast.error(errorMessage(error, "Failed to remove from shelf"));
		},
		onSuccess: () => {
			void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
				() => {},
			);
			toast.success("Removed from shelf");
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: userMoviesKey });
			invalidateShelf();
		},
	});

	const isWatched = useCallback(
		(movieId: string | number) => watchedIds.has(String(movieId)),
		[watchedIds],
	);

	const toggle = useCallback(
		(movieId: string | number) => {
			if (!isAuthenticated) return;
			const id = String(movieId);
			if (watchedIds.has(id)) {
				unmarkMovie.mutate({ path: { movieId: id }, query: { mode: "all" } });
			} else {
				markMovie.mutate({ body: { movieId: id } });
			}
		},
		[isAuthenticated, watchedIds, markMovie, unmarkMovie],
	);

	return { isAuthenticated, isWatched, toggle };
}
