import { useMemo } from "react";
import type {
	DashboardListItem,
	DashboardRange,
	DashboardShelfItem,
} from "@/components/home/types";

export function useHomeMetrics(
	shelfItems: DashboardShelfItem[] | undefined,
	totalTrackedValue: number | undefined,
	lists: DashboardListItem[] | undefined,
	range: DashboardRange,
) {
	const { watchedInRangeCount, totalTracked, recentWatched } = useMemo(() => {
		const now = Date.now();
		const days = range === "week" ? 7 : 30;
		const cutoff = now - days * 24 * 60 * 60 * 1000;

		const items = shelfItems ?? [];
		const sorted = [...items].sort((a, b) => {
			const dateA = a.watchedDate
				? new Date(a.watchedDate).getTime()
				: new Date(a.createdAt).getTime();
			const dateB = b.watchedDate
				? new Date(b.watchedDate).getTime()
				: new Date(b.createdAt).getTime();
			return dateB - dateA;
		});

		const inRange = sorted.filter((item) => {
			const date = item.watchedDate
				? new Date(item.watchedDate).getTime()
				: new Date(item.createdAt).getTime();
			return date >= cutoff;
		});

		return {
			watchedInRangeCount: inRange.length,
			totalTracked: totalTrackedValue ?? 0,
			recentWatched: sorted.slice(0, 5),
		};
	}, [shelfItems, totalTrackedValue, range]);

	const { listCount, totalMoviesInLists, recentLists } = useMemo(() => {
		const items = lists ?? [];
		const sorted = [...items].sort(
			(a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
		);

		return {
			listCount: items.length,
			totalMoviesInLists: items.reduce((acc, list) => acc + list.movieCount, 0),
			recentLists: sorted.slice(0, 4),
		};
	}, [lists]);

	return {
		watchedInRangeCount,
		totalTracked,
		recentWatched,
		listCount,
		totalMoviesInLists,
		recentLists,
	};
}
