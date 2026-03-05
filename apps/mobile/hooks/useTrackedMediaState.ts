import { useMemo } from "react";

type TrackedMovie = { movieId: string };
type TrackedShow = { showId: string };

export function useTrackedMediaState(
	trackedMovies: TrackedMovie[] | undefined,
	trackedShows: TrackedShow[] | undefined,
) {
	const watchedMovieIds = useMemo(() => {
		if (!trackedMovies) return new Set<string>();
		return new Set(trackedMovies.map((m) => m.movieId));
	}, [trackedMovies]);

	const watchedShowIds = useMemo(() => {
		if (!trackedShows) return new Set<string>();
		return new Set(trackedShows.map((s) => s.showId));
	}, [trackedShows]);

	return { watchedMovieIds, watchedShowIds };
}
