import type { ReleaseCalendarItemDto } from "@opnshelf/api";
import { showsControllerGetUserReleaseCalendarOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	Calendar as CalendarIcon,
	ChevronLeft,
	ChevronRight,
	Clock,
	Film,
	Loader2,
	Tv,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useUser } from "../lib/auth-context";

export const Route = createFileRoute("/calendar")({
	component: CalendarPage,
});

// Transform API response into date-keyed object for calendar
function transformReleasesToDateMap(
	items: ReleaseCalendarItemDto[],
): Record<string, ReleaseCalendarItemDto[]> {
	const releasesByDate: Record<string, ReleaseCalendarItemDto[]> = {};

	for (const item of items) {
		const dateKey = item.releaseDate.split("T")[0]; // Extract YYYY-MM-DD from ISO date
		if (!releasesByDate[dateKey]) {
			releasesByDate[dateKey] = [];
		}
		releasesByDate[dateKey].push(item);
	}

	return releasesByDate;
}

function CalendarPage() {
	const user = useUser();
	const [currentDate, setCurrentDate] = useState(new Date());
	const [viewMode, setViewMode] = useState<"month" | "week" | "list">("month");

	// Fetch release calendar data
	const { data: calendarData, isLoading } = useQuery({
		...showsControllerGetUserReleaseCalendarOptions({
			path: { userDid: user?.did || "" },
		}),
		enabled: !!user?.did,
	});

	// Transform API data into date-keyed format
	const releases = useMemo(() => {
		if (!calendarData?.items) return {};
		return transformReleasesToDateMap(calendarData.items);
	}, [calendarData]);

	const monthNames = [
		"January",
		"February",
		"March",
		"April",
		"May",
		"June",
		"July",
		"August",
		"September",
		"October",
		"November",
		"December",
	];

	const daysInMonth = new Date(
		currentDate.getFullYear(),
		currentDate.getMonth() + 1,
		0,
	).getDate();

	const firstDayOfMonth = new Date(
		currentDate.getFullYear(),
		currentDate.getMonth(),
		1,
	).getDay();

	const prevMonth = () => {
		setCurrentDate(
			new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
		);
	};

	const nextMonth = () => {
		setCurrentDate(
			new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
		);
	};

	const formatDateKey = (day: number) => {
		const year = currentDate.getFullYear();
		const month = String(currentDate.getMonth() + 1).padStart(2, "0");
		const dayStr = String(day).padStart(2, "0");
		return `${year}-${month}-${dayStr}`;
	};

	const getUpcomingReleases = (): Array<
		ReleaseCalendarItemDto & { date: string }
	> => {
		if (!calendarData?.items) return [];

		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const twoWeeksLater = new Date(today);
		twoWeeksLater.setDate(today.getDate() + 14);

		return calendarData.items
			.filter((item) => {
				const releaseDate = new Date(item.releaseDate);
				return releaseDate >= today && releaseDate <= twoWeeksLater;
			})
			.sort(
				(a, b) =>
					new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime(),
			)
			.slice(0, 10)
			.map((item) => ({ ...item, date: item.releaseDate.split("T")[0] }));
	};

	const getReleaseType = (item: ReleaseCalendarItemDto): "movie" | "show" => {
		return item.mediaType;
	};

	const getEpisodeInfo = (item: ReleaseCalendarItemDto): string | undefined => {
		if (item.releaseKind === "episode" && item.seasonNumber !== undefined) {
			if (item.episodeNumber !== undefined) {
				return `S${item.seasonNumber}E${item.episodeNumber}`;
			}
			return `Season ${item.seasonNumber}`;
		}
		if (item.releaseKind === "show") {
			return "Season Premiere";
		}
		return undefined;
	};

	const upcomingReleases = getUpcomingReleases();

	// Calculate summary stats for current week
	const getThisWeekStats = () => {
		if (!calendarData?.items) {
			return { movies: 0, episodes: 0, premieres: 0 };
		}

		const today = new Date();
		const weekStart = new Date(today);
		weekStart.setDate(today.getDate() - today.getDay());
		const weekEnd = new Date(weekStart);
		weekEnd.setDate(weekStart.getDate() + 7);

		let movies = 0;
		let episodes = 0;
		let premieres = 0;

		for (const item of calendarData.items) {
			const releaseDate = new Date(item.releaseDate);
			if (releaseDate >= weekStart && releaseDate < weekEnd) {
				if (item.mediaType === "movie") {
					movies++;
				} else if (item.releaseKind === "episode") {
					episodes++;
				} else if (item.releaseKind === "show") {
					premieres++;
				}
			}
		}

		return { movies, episodes, premieres };
	};

	const thisWeekStats = getThisWeekStats();

	if (isLoading) {
		return (
			<div className="container-app py-8">
				<div className="mb-8">
					<h1 className="text-display-2 mb-2">Release Calendar</h1>
					<p className="text-[var(--foreground-muted)]">
						Track upcoming movies and TV shows you're following.
					</p>
				</div>
				<div className="flex items-center justify-center py-20">
					<Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
					<span className="ml-3 text-[var(--foreground-muted)]">
						Loading calendar...
					</span>
				</div>
			</div>
		);
	}

	return (
		<div className="container-app py-8">
			{/* Header */}
			<div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-display-2 mb-2">Release Calendar</h1>
					<p className="text-[var(--foreground-muted)]">
						Track upcoming movies and TV shows you're following.
					</p>
				</div>

				{/* View Toggle */}
				<div className="flex items-center gap-2">
					<div className="flex rounded-lg border border-[var(--border)] bg-[var(--background-elevated)] p-1">
						{(["month", "week", "list"] as const).map((mode) => (
							<button
								key={mode}
								type="button"
								onClick={() => setViewMode(mode)}
								className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
									viewMode === mode
										? "bg-[var(--accent)] text-white"
										: "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
								}`}
							>
								{mode.charAt(0).toUpperCase() + mode.slice(1)}
							</button>
						))}
					</div>
				</div>
			</div>

			{/* Calendar Navigation */}
			<div className="mb-6 flex items-center justify-between">
				<button type="button" onClick={prevMonth} className="btn btn-secondary">
					<ChevronLeft className="h-4 w-4" />
					Previous
				</button>

				<h2 className="text-display-3">
					{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
				</h2>

				<button type="button" onClick={nextMonth} className="btn btn-secondary">
					Next
					<ChevronRight className="h-4 w-4" />
				</button>
			</div>

			<div className="grid gap-8 lg:grid-cols-3">
				{/* Calendar Grid */}
				<div className="lg:col-span-2">
					{/* Weekday Headers */}
					<div className="mb-2 grid grid-cols-7 gap-1">
						{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
							<div
								key={day}
								className="py-2 text-center text-sm font-medium text-[var(--foreground-muted)]"
							>
								{day}
							</div>
						))}
					</div>

					{/* Calendar Days */}
					<div className="grid grid-cols-7 gap-1">
						{/* Empty cells for days before the first day of month */}
						{/* biome-ignore lint/suspicious/noArrayIndexKey: Empty calendar placeholder cells */}
						{Array.from({ length: firstDayOfMonth }).map((_, index) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: Empty calendar placeholder cells
								key={`calendar-empty-${index}`}
								className="aspect-square rounded-lg bg-[var(--background-subtle)]"
								aria-hidden="true"
							/>
						))}

						{/* Days of the month */}
						{Array.from({ length: daysInMonth }).map((_, index) => {
							const day = index + 1;
							const dateKey = formatDateKey(day);
							const dayReleases = releases[dateKey] || [];
							const isToday =
								new Date().toDateString() ===
								new Date(
									currentDate.getFullYear(),
									currentDate.getMonth(),
									day,
								).toDateString();

							return (
								<div
									key={day}
									className={`relative aspect-square rounded-lg border p-2 transition-colors ${
										isToday
											? "border-[var(--accent)] bg-[var(--accent-subtle)]"
											: "border-[var(--border)] bg-[var(--background-elevated)] hover:border-[var(--border-strong)]"
									}`}
								>
									<span
										className={`text-sm font-medium ${
											isToday
												? "text-[var(--accent)]"
												: "text-[var(--foreground)]"
										}`}
									>
										{day}
									</span>

									{dayReleases.length > 0 && (
										<div className="absolute bottom-1 right-1 left-1 flex flex-wrap gap-1">
											{dayReleases.slice(0, 3).map((release) => (
												<div
													key={`${release.showId || release.movieId || release.title}-${release.releaseDate}`}
													className={`h-1.5 w-1.5 rounded-full ${
														getReleaseType(release) === "movie"
															? "bg-blue-500"
															: "bg-purple-500"
													}`}
													title={release.title}
												/>
											))}
											{dayReleases.length > 3 && (
												<span className="text-[10px] text-[var(--foreground-muted)]">
													+{dayReleases.length - 3}
												</span>
											)}
										</div>
									)}
								</div>
							);
						})}
					</div>

					{/* Legend */}
					<div className="mt-4 flex items-center gap-4 text-sm">
						<div className="flex items-center gap-2">
							<div className="h-3 w-3 rounded-full bg-blue-500" />
							<span className="text-[var(--foreground-muted)]">Movies</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="h-3 w-3 rounded-full bg-purple-500" />
							<span className="text-[var(--foreground-muted)]">TV Shows</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="h-3 w-3 rounded-full border border-[var(--accent)] bg-[var(--accent-subtle)]" />
							<span className="text-[var(--foreground-muted)]">Today</span>
						</div>
					</div>
				</div>

				{/* Sidebar */}
				<div className="space-y-6">
					{/* Upcoming Releases */}
					<section>
						<h3 className="text-display-3 mb-4 flex items-center gap-2">
							<CalendarIcon className="h-5 w-5" />
							Upcoming
						</h3>
						{upcomingReleases.length === 0 ? (
							<div className="card p-6 text-center">
								<Clock className="mx-auto mb-3 h-8 w-8 text-[var(--foreground-muted)]" />
								<p className="text-[var(--foreground-muted)]">
									No upcoming releases
								</p>
								<p className="mt-1 text-sm text-[var(--foreground-muted)]">
									Add shows and movies to your watchlist to see their release
									dates here.
								</p>
							</div>
						) : (
							<div className="space-y-3">
								{upcomingReleases.map((release) => (
									<div
										key={`${release.showId || release.movieId}-${release.releaseDate}`}
										className="card card-interactive flex items-center gap-3 p-3"
									>
										{release.posterPath ? (
											<img
												src={`https://image.tmdb.org/t/p/w200${release.posterPath}`}
												alt={release.title}
												className="h-16 w-12 rounded object-cover"
											/>
										) : (
											<div className="flex h-16 w-12 items-center justify-center rounded bg-[var(--background-subtle)]">
												{getReleaseType(release) === "movie" ? (
													<Film className="h-6 w-6 text-[var(--foreground-muted)]" />
												) : (
													<Tv className="h-6 w-6 text-[var(--foreground-muted)]" />
												)}
											</div>
										)}
										<div className="flex-1 min-w-0">
											<p className="font-medium text-sm truncate">
												{release.title}
											</p>
											<div className="mt-1 flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
												<span className="flex items-center gap-1">
													{getReleaseType(release) === "movie" ? (
														<Film className="h-3 w-3" />
													) : (
														<Tv className="h-3 w-3" />
													)}
													{release.date}
												</span>
											</div>
											{getEpisodeInfo(release) && (
												<p className="mt-1 text-xs text-[var(--foreground-muted)] truncate">
													{getEpisodeInfo(release)}
												</p>
											)}
										</div>
									</div>
								))}
							</div>
						)}
					</section>

					{/* This Week Summary */}
					<section className="card p-4">
						<h4 className="font-display font-semibold mb-3">This Week</h4>
						<div className="space-y-2 text-sm">
							<div className="flex justify-between">
								<span className="text-[var(--foreground-muted)]">Movies</span>
								<span className="font-medium">
									{thisWeekStats.movies} releases
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-[var(--foreground-muted)]">
									TV Episodes
								</span>
								<span className="font-medium">
									{thisWeekStats.episodes} episodes
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-[var(--foreground-muted)]">
									Season Premieres
								</span>
								<span className="font-medium">
									{thisWeekStats.premieres} shows
								</span>
							</div>
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}
