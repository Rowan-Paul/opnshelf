import { latestWatchDate } from "./watch-date";

type EpisodeWatch = {
	seasonNumber: number;
	episodeNumber: number;
	watchedDate?: string | null;
};
type WatchIndex = {
	episodes: Map<string, number>;
	seasons: Map<number, number>;
	latestWatchedDate: string | undefined;
};
// Query data is immutable. All episode observers share the index for that
// snapshot; a refetch/optimistic update builds a new one, and old ones are GC'd.
const indexes = new WeakMap<ReadonlyArray<EpisodeWatch>, WatchIndex>();
export function getShowWatchIndex(
	watches: ReadonlyArray<EpisodeWatch>,
): WatchIndex {
	const cached = indexes.get(watches);
	if (cached) return cached;
	const episodes = new Map<string, number>();
	const seasons = new Map<number, number>();
	for (const watch of watches) {
		const key = `${watch.seasonNumber}-${watch.episodeNumber}`;
		episodes.set(key, (episodes.get(key) ?? 0) + 1);
		seasons.set(watch.seasonNumber, (seasons.get(watch.seasonNumber) ?? 0) + 1);
	}
	const index = {
		episodes,
		seasons,
		latestWatchedDate: latestWatchDate(watches),
	};
	indexes.set(watches, index);
	return index;
}
