import type { MostWatchedShowDto, ProfileActivityDayDto } from "@opnshelf/api";
import { slugifyName } from "@opnshelf/api";
import { Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { useState } from "react";

/** Format a "YYYY-MM-DD" calendar day as e.g. "Thu, Jun 20" (UTC, no drift). */
function formatDayLabel(date: string): string {
	const [year, month, day] = date.split("-").map(Number);
	return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(
		undefined,
		{
			weekday: "short",
			month: "short",
			day: "numeric",
			timeZone: "UTC",
		},
	);
}

/**
 * The profile/dashboard stats strip: a 30-day watch-activity graph plus a few
 * headline stats. Purely presentational — both the public profile and the
 * authenticated dashboard feed it from the same `PublicUserProfileDto`, so the
 * numbers (timezone-aware, watched-only) stay identical across surfaces.
 */
export function StatsStrip({
	activity,
	mostWatchedShow,
	watchedThisYear,
	reviewsCount,
	isLoading,
}: {
	activity?: ProfileActivityDayDto[];
	mostWatchedShow: MostWatchedShowDto | null;
	watchedThisYear: number;
	reviewsCount: number;
	isLoading: boolean;
}) {
	if (isLoading) {
		return <div className="card h-32 animate-pulse" />;
	}

	const days = activity ?? [];
	const last30Total = days.reduce((sum, d) => sum + d.count, 0);

	return (
		<div className="card flex flex-col gap-6 p-5 lg:flex-row">
			{/* Activity graph */}
			<div className="min-w-0 flex-1">
				<div className="mb-3 flex items-baseline justify-between">
					<h2 className="flex items-center gap-2 font-medium text-(--foreground-muted) text-sm">
						<Clock className="size-4 text-(--accent)" />
						Last 30 days
					</h2>
					<span className="text-(--foreground-muted) text-xs">
						{last30Total} watched
					</span>
				</div>
				<ActivityGraph data={days} />
			</div>

			{/* Headline stats */}
			<div className="flex items-center gap-6 lg:gap-8 lg:border-(--border) lg:border-l lg:pl-8">
				{mostWatchedShow && <MostWatchedShowStat show={mostWatchedShow} />}
				<NumberStat label="This year" value={watchedThisYear} />
				<NumberStat label="Reviews" value={reviewsCount} />
			</div>
		</div>
	);
}

function ActivityGraph({ data }: { data: ProfileActivityDayDto[] }) {
	const [active, setActive] = useState<number | null>(null);
	const max = Math.max(1, ...data.map((d) => d.count));
	const activeDay = active != null ? data[active] : null;
	// Clamp toward the centre so edge tooltips don't overflow the card.
	const tooltipLeft =
		active != null
			? Math.min(94, Math.max(6, ((active + 0.5) / data.length) * 100))
			: 0;

	return (
		<div className="relative">
			{activeDay && (
				<div
					className="pointer-events-none absolute bottom-full z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-(--border) bg-(--background) px-2 py-1 text-xs shadow-md"
					style={{ left: `${tooltipLeft}%` }}
				>
					<span className="font-medium">{formatDayLabel(activeDay.date)}</span>
					<span className="text-(--foreground-muted)">
						{" · "}
						{activeDay.count} watched
					</span>
				</div>
			)}
			<div className="flex h-20 items-end gap-[3px]">
				{data.map((d, i) => {
					const pct = (d.count / max) * 100;
					return (
						<button
							type="button"
							key={d.date}
							aria-label={`${formatDayLabel(d.date)}: ${d.count} watched`}
							onMouseEnter={() => setActive(i)}
							onMouseLeave={() => setActive(null)}
							onFocus={() => setActive(i)}
							onBlur={() => setActive(null)}
							onClick={() => setActive((cur) => (cur === i ? null : i))}
							className="flex h-full flex-1 items-end"
						>
							<span
								className={`w-full rounded-sm transition-opacity ${
									d.count > 0 ? "bg-(--accent)" : "bg-(--background-subtle)"
								} ${active != null && active !== i ? "opacity-50" : "opacity-100"}`}
								style={{
									height: d.count > 0 ? `${Math.max(12, pct)}%` : "3px",
								}}
							/>
						</button>
					);
				})}
			</div>
		</div>
	);
}

function NumberStat({ label, value }: { label: string; value: number }) {
	return (
		<div className="flex flex-col justify-center">
			<p className="font-semibold text-2xl tabular-nums">{value}</p>
			<p className="text-(--foreground-muted) text-xs">{label}</p>
		</div>
	);
}

function MostWatchedShowStat({ show }: { show: MostWatchedShowDto }) {
	return (
		<Link
			to="/shows/$showId/$showName"
			params={{ showId: show.showId, showName: slugifyName(show.title) }}
			className="flex items-center gap-3"
		>
			{show.posterPath ? (
				<img
					src={`https://image.tmdb.org/t/p/w200${show.posterPath}`}
					alt={show.title}
					className="h-14 w-10 shrink-0 rounded object-cover"
				/>
			) : (
				<div className="h-14 w-10 shrink-0 rounded bg-(--background-subtle)" />
			)}
			<div className="min-w-0">
				<p className="text-(--foreground-muted) text-xs">Most watched</p>
				<p className="line-clamp-2 font-semibold text-sm">{show.title}</p>
				<p className="text-(--foreground-muted) text-xs">
					{show.episodeWatchCount} episodes
				</p>
			</div>
		</Link>
	);
}
