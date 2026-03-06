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
	const { watchedInRangeCount, totalTracked, recentWatched, activityBars } = useMemo(() => {
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
			activityBars: buildActivityBars(sorted, range),
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
		activityBars,
		listCount,
		totalMoviesInLists,
		recentLists,
	};
}

function buildActivityBars(items: DashboardShelfItem[], range: DashboardRange) {
	const bucketSize = range === "week" ? 1 : 7;
	const bucketCount = 7;
	const endOfToday = new Date();
	endOfToday.setHours(23, 59, 59, 999);

	const start = new Date(endOfToday);
	start.setDate(start.getDate() - (bucketSize * bucketCount - 1));
	start.setHours(0, 0, 0, 0);

	return Array.from({ length: bucketCount }, (_, index) => {
		const bucketStart = new Date(start);
		bucketStart.setDate(start.getDate() + index * bucketSize);

		const bucketEnd = new Date(bucketStart);
		bucketEnd.setDate(bucketStart.getDate() + bucketSize - 1);
		bucketEnd.setHours(23, 59, 59, 999);

		const value = items.filter((item) => {
			const sourceDate = item.watchedDate ?? item.createdAt;
			const watchedAt = new Date(sourceDate).getTime();
			return watchedAt >= bucketStart.getTime() && watchedAt <= bucketEnd.getTime();
		}).length;

		return {
			label:
				range === "week"
					? bucketStart.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3)
					: `W${index + 1}`,
			value,
		};
	});
}
