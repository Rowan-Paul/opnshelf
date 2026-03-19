import { useMemo } from "react";
import type {
	DashboardActivityBar,
	DashboardActivityBucket,
	DashboardActivitySummary,
	DashboardListItem,
	DashboardRange,
	DashboardShelfItem,
} from "@/components/home/types";

export function useHomeMetrics(
	shelfItems: DashboardShelfItem[] | undefined,
	lists: DashboardListItem[] | undefined,
	range: DashboardRange,
	activitySummary: DashboardActivitySummary | undefined,
) {
	const { watchedInRangeCount, recentWatched, activityBars } = useMemo(() => {
		const now = Date.now();

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

		return {
			watchedInRangeCount:
				range === "week"
					? activitySummary?.watchedLast7Days ?? 0
					: activitySummary?.watchedLast30Days ?? 0,
			recentWatched: sorted.slice(0, 5),
			activityBars: buildActivityBars(activitySummary?.dailyActivity, range, now),
		};
	}, [activitySummary, range, shelfItems]);

	const { listCount, totalMoviesInLists, recentLists } = useMemo(() => {
		const items = lists ?? [];
		const sorted = [...items].sort(
			(a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
		);

		return {
			listCount: items.length,
			totalMoviesInLists: items.reduce((acc, list) => acc + list.itemCount, 0),
			recentLists: sorted.slice(0, 4),
		};
	}, [lists]);

	return {
		watchedInRangeCount,
		recentWatched,
		activityBars,
		listCount,
		totalMoviesInLists,
		recentLists,
	};
}

function buildActivityBars(
	dailyActivity: DashboardActivityBucket[] | undefined,
	range: DashboardRange,
	now: number,
): DashboardActivityBar[] {
	const visibleBuckets =
		range === "week"
			? (dailyActivity?.slice(-7) ?? [])
			: (dailyActivity ?? []);

	if (visibleBuckets.length === 0) {
		return Array.from({ length: range === "week" ? 7 : 30 }, (_, index) => ({
			key: `placeholder-${range}-${now}-${index}`,
			value: 0,
			label: "",
			showLabel: false,
		}));
	}

	return visibleBuckets.map((bucket, index) => ({
		key: bucket.date,
		value: bucket.count,
		label:
			range === "week"
				? formatDayKey(bucket.date, { weekday: "short" }).slice(0, 3)
				: formatMonthDayLabel(bucket.date),
		showLabel:
			range === "week" ||
			index % 5 === 0 ||
			index === visibleBuckets.length - 1,
	}));
}

function formatDayKey(
	dayKey: string,
	options: Intl.DateTimeFormatOptions,
) {
	const [year, month, day] = dayKey.split("-").map(Number);
	return new Intl.DateTimeFormat(undefined, {
		...options,
		timeZone: "UTC",
	}).format(new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0)));
}

function formatMonthDayLabel(dayKey: string) {
	const day = formatDayKey(dayKey, { day: "numeric" });
	const month = formatDayKey(dayKey, { month: "short" });
	return `${day}\n${month}`;
}
