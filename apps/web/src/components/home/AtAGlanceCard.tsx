import type {
	ShelfActivityBucketDto,
	ShelfActivitySummaryDto,
} from "@opnshelf/api";
import { Flame, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { M3Button } from "@/components/ui/m3-button";
import {
	M3Card,
	M3CardContent,
	M3CardHeader,
	M3CardTitle,
} from "@/components/ui/m3-card";

type DashboardRange = "week" | "month";

interface AtAGlanceCardProps {
	activitySummary: ShelfActivitySummaryDto | undefined;
}

export function AtAGlanceCard({ activitySummary }: AtAGlanceCardProps) {
	const [range, setRange] = useState<DashboardRange>("week");

	const bars = useMemo(
		() => buildActivityBars(activitySummary?.dailyActivity, range),
		[activitySummary?.dailyActivity, range],
	);

	const stats = useMemo(
		() => deriveStats(activitySummary, range),
		[activitySummary, range],
	);

	const maxValue = Math.max(...bars.map((b) => b.value), 1);

	return (
		<M3Card
			variant="elevated"
			className="h-full rounded-xl border"
			style={{ borderColor: "var(--md-sys-color-outline-variant)" }}
		>
			<M3CardHeader className="flex-row items-center justify-between gap-3">
				<M3CardTitle className="md-title-large">At a glance</M3CardTitle>
				<div
					className="inline-flex gap-1 rounded-full border p-0.5"
					style={{
						backgroundColor: "var(--md-sys-color-surface-container)",
						borderColor: "var(--md-sys-color-outline-variant)",
					}}
				>
					<M3Button
						size="xs"
						variant={range === "week" ? "filled-tonal" : "text"}
						className="min-w-16 rounded-full"
						onClick={() => setRange("week")}
					>
						Week
					</M3Button>
					<M3Button
						size="xs"
						variant={range === "month" ? "filled-tonal" : "text"}
						className="min-w-16 rounded-full"
						onClick={() => setRange("month")}
					>
						Month
					</M3Button>
				</div>
			</M3CardHeader>

			<M3CardContent className="space-y-4">
				{/* --- Stats strip --- */}
				<div className="grid grid-cols-3 gap-2">
					<StatTile label="Watched" value={stats.watched} />
					<StatTile label="Daily avg" value={stats.dailyAvg} />
					<StatTile
						label="Streak"
						value={stats.streak}
						suffix="d"
						icon={
							stats.streak > 0 ? (
								<Flame className="size-3.5 text-(--md-sys-color-tertiary)" />
							) : undefined
						}
					/>
				</div>

				{/* --- Activity chart --- */}
				<div
					className="rounded-xl p-3"
					style={{
						backgroundColor: "var(--md-sys-color-surface-container)",
					}}
				>
					<div className="mb-2 flex items-baseline justify-between">
						<p className="text-xs font-medium text-(--md-sys-color-on-surface-variant)">
							{range === "week" ? "Last 7 days" : "Past 30 days"}
						</p>
						{stats.trend !== 0 && (
							<span className="flex items-center gap-1 text-xs text-(--md-sys-color-on-surface-variant)">
								<TrendingUp
									className={`size-3 ${stats.trend < 0 ? "rotate-180" : ""}`}
								/>
								{stats.trend > 0 ? "+" : ""}
								{stats.trend}%
							</span>
						)}
					</div>

					{/* Chart area */}
					<div>
						{/* Bars */}
						<div className="relative flex gap-px" style={{ height: "6rem" }}>
							{/* Average line */}
							{stats.dailyAvgRaw > 0 && (
								<div
									className="pointer-events-none absolute right-0 left-0 border-t border-dashed"
									style={{
										borderColor: "var(--md-sys-color-outline)",
										bottom: `${(stats.dailyAvgRaw / maxValue) * 100}%`,
									}}
								/>
							)}
							{bars.map((bar) => {
								const pct =
									bar.value > 0
										? Math.max((bar.value / maxValue) * 100, 14)
										: 4;

								return (
									<div
										key={bar.key}
										className="group/bar relative flex flex-1 items-end justify-center"
									>
										<div
											className={`w-full rounded-t transition-opacity duration-150 group-hover/bar:opacity-100 ${bar.isToday ? "opacity-100" : bar.value > 0 ? "opacity-70" : "opacity-20"}`}
											style={{
												height: `${pct}%`,
												backgroundColor: "var(--md-sys-color-primary)",
												minWidth: "2px",
											}}
										/>

										{bar.value > 0 && (
											<div
												className="pointer-events-none absolute -top-7 z-10 rounded-md px-2 py-0.5 text-xs font-bold opacity-0 transition-opacity duration-100 group-hover/bar:opacity-100"
												style={{
													backgroundColor:
														"var(--md-sys-color-inverse-surface)",
													color: "var(--md-sys-color-surface)",
												}}
											>
												{bar.value} items
											</div>
										)}
									</div>
								);
							})}
						</div>

						{/* X-axis labels */}
						<div className="mt-1.5 flex">
							{bars.map((bar) => (
								<span
									key={`label-${bar.key}`}
									className="flex-1 text-center text-[10px] leading-tight text-(--md-sys-color-on-surface-variant)"
								>
									{bar.showLabel ? bar.label : ""}
								</span>
							))}
						</div>
					</div>
				</div>
			</M3CardContent>
		</M3Card>
	);
}

function StatTile({
	label,
	value,
	suffix,
	icon,
}: {
	label: string;
	value: number | string;
	suffix?: string;
	icon?: React.ReactNode;
}) {
	return (
		<div
			className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-2"
			style={{
				backgroundColor: "var(--md-sys-color-surface-container)",
			}}
		>
			<span className="flex items-center gap-1 text-lg font-bold tabular-nums text-(--md-sys-color-on-surface)">
				{value}
				{suffix && (
					<span className="text-xs font-medium text-(--md-sys-color-on-surface-variant)">
						{suffix}
					</span>
				)}
				{icon}
			</span>
			<span className="text-[11px] font-medium text-(--md-sys-color-on-surface-variant)">
				{label}
			</span>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveStats(
	summary: ShelfActivitySummaryDto | undefined,
	range: DashboardRange,
) {
	const watched =
		range === "week"
			? (summary?.watchedLast7Days ?? 0)
			: (summary?.watchedLast30Days ?? 0);

	const days = range === "week" ? 7 : 30;
	const dailyAvgRaw = days > 0 ? watched / days : 0;
	const dailyAvg =
		dailyAvgRaw % 1 === 0 ? dailyAvgRaw.toString() : dailyAvgRaw.toFixed(1);

	const streak = computeStreak(summary?.dailyActivity);

	const trend = computeTrend(summary?.dailyActivity, range);

	return { watched, dailyAvg, dailyAvgRaw, streak, trend };
}

function computeStreak(
	daily: ShelfActivitySummaryDto["dailyActivity"] | undefined,
): number {
	if (!daily || daily.length === 0) return 0;

	let streak = 0;
	for (let i = daily.length - 1; i >= 0; i--) {
		if (daily[i].count > 0) {
			streak++;
		} else {
			break;
		}
	}
	return streak;
}

function computeTrend(
	daily: ShelfActivitySummaryDto["dailyActivity"] | undefined,
	range: DashboardRange,
): number {
	if (!daily || daily.length === 0) return 0;

	const days = range === "week" ? 7 : 30;
	const recent = daily.slice(-days);
	const prior = daily.slice(-days * 2, -days);

	if (prior.length === 0) return 0;

	const recentTotal = recent.reduce((s, b) => s + b.count, 0);
	const priorTotal = prior.reduce((s, b) => s + b.count, 0);

	if (priorTotal === 0) return recentTotal > 0 ? 100 : 0;
	return Math.round(((recentTotal - priorTotal) / priorTotal) * 100);
}

function buildActivityBars(
	dailyActivity: ShelfActivitySummaryDto["dailyActivity"] | undefined,
	range: DashboardRange,
) {
	const visibleBuckets =
		range === "week" ? (dailyActivity?.slice(-7) ?? []) : (dailyActivity ?? []);

	const todayStr = todayDateKey();

	if (visibleBuckets.length === 0) {
		return Array.from({ length: range === "week" ? 7 : 30 }, (_, index) => ({
			key: `placeholder-${range}-${index}`,
			value: 0,
			label: "",
			showLabel: false,
			isToday: false,
		}));
	}

	return visibleBuckets.map((bucket, index) => ({
		key: bucket.date,
		value: bucket.count,
		isToday: bucket.date === todayStr,
		label:
			range === "week"
				? formatDayKey(bucket, { weekday: "short" }).slice(0, 3)
				: formatDayKey(bucket, { day: "numeric" }),
		showLabel:
			range === "week" ||
			index === 0 ||
			index % 7 === 0 ||
			index === visibleBuckets.length - 1,
	}));
}

function formatDayKey(
	bucket: ShelfActivityBucketDto,
	options: Intl.DateTimeFormatOptions,
) {
	const [year, month, day] = bucket.date.split("-").map(Number);
	return new Intl.DateTimeFormat(undefined, {
		...options,
		timeZone: "UTC",
	}).format(new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0)));
}

function todayDateKey() {
	const d = new Date();
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}`;
}
