import type { ReleaseCalendarItemDto } from "@opnshelf/api";
import { showsControllerGetUserReleaseCalendarOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
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
	const [selectedWeekStart, setSelectedWeekStart] = useState<Date | null>(null);

	// Calculate date range for 3 months (prev, current, next)
	const dateRange = useMemo(() => {
		const year = currentDate.getFullYear();
		const month = currentDate.getMonth();

		// Previous month
		const prevMonth = new Date(year, month - 1, 1);
		// Next month
		const nextMonth = new Date(year, month + 2, 0); // Last day of next month

		const startDate = prevMonth.toISOString().split("T")[0];
		const endDate = nextMonth.toISOString().split("T")[0];

		return { startDate, endDate };
	}, [currentDate]);

	// Fetch release calendar data with date range
	const { data: calendarData, isLoading } = useQuery({
		...showsControllerGetUserReleaseCalendarOptions({
			path: { userDid: user?.did || "" },
			query: dateRange,
		}),
		enabled: !!user?.did,
		// Keep previous data while fetching new data for smooth transitions
		placeholderData: (previousData) => previousData,
		staleTime: 5 * 60 * 1000, // 5 minutes
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

	const firstDayOfMonth =
		(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() +
			6) %
		7; // Shift so Monday = 0, Sunday = 6

	const prevMonth = () => {
		setCurrentDate(
			new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
		);
		setSelectedWeekStart(null);
	};

	const nextMonth = () => {
		setCurrentDate(
			new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
		);
		setSelectedWeekStart(null);
	};

	const goToToday = () => {
		const today = new Date();
		setCurrentDate(today);
		setSelectedWeekStart(getWeekStart(today));
	};

	const formatDateKey = (day: number) => {
		const year = currentDate.getFullYear();
		const month = String(currentDate.getMonth() + 1).padStart(2, "0");
		const dayStr = String(day).padStart(2, "0");
		return `${year}-${month}-${dayStr}`;
	};

	const getWeekStart = (date: Date): Date => {
		const d = new Date(date);
		const day = d.getDay();
		// Adjust for Monday start (0 = Sunday, so Monday is 1)
		const diff = day === 0 ? 6 : day - 1;
		d.setDate(d.getDate() - diff);
		d.setHours(0, 0, 0, 0);
		return d;
	};

	const isSameDay = (d1: Date, d2: Date): boolean => {
		return (
			d1.getFullYear() === d2.getFullYear() &&
			d1.getMonth() === d2.getMonth() &&
			d1.getDate() === d2.getDate()
		);
	};

	const isInSelectedWeek = (day: number): boolean => {
		if (!selectedWeekStart) return false;
		const dayDate = new Date(
			currentDate.getFullYear(),
			currentDate.getMonth(),
			day,
		);
		const dayWeekStart = getWeekStart(dayDate);
		return isSameDay(dayWeekStart, selectedWeekStart);
	};

	const getDisplayTitle = (item: ReleaseCalendarItemDto): string => {
		// For TV episodes, show "SxE Title" format
		if (
			item.mediaType === "show" &&
			item.releaseKind === "episode" &&
			item.seasonNumber !== undefined
		) {
			if (item.episodeNumber !== undefined) {
				return `${item.seasonNumber}x${item.episodeNumber} ${item.title}`;
			}
			return `S${item.seasonNumber} ${item.title}`;
		}
		return item.title;
	};

	const getReleaseType = (item: ReleaseCalendarItemDto): "movie" | "show" => {
		return item.mediaType;
	};

	const _getEpisodeInfo = (
		item: ReleaseCalendarItemDto,
	): string | undefined => {
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

	const getSelectedWeekReleases = (): Array<
		ReleaseCalendarItemDto & { date: string }
	> => {
		if (!selectedWeekStart) return [];

		const weekReleases: Array<ReleaseCalendarItemDto & { date: string }> = [];

		for (let i = 0; i < 7; i++) {
			const date = new Date(selectedWeekStart);
			date.setDate(selectedWeekStart.getDate() + i);
			// Use local date components to match the formatDateKey function
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, "0");
			const day = String(date.getDate()).padStart(2, "0");
			const dateKey = `${year}-${month}-${day}`;
			const dayReleases = releases[dateKey] || [];
			for (const release of dayReleases) {
				weekReleases.push({ ...release, date: dateKey });
			}
		}

		// Sort by date
		return weekReleases.sort(
			(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
		);
	};

	const selectedWeekReleases = getSelectedWeekReleases();

	const getItemUrl = (item: ReleaseCalendarItemDto) => {
		if (item.mediaType === "movie" && item.movieId) {
			return `/movies/${item.movieId}`;
		}
		if (item.mediaType === "show" && item.showId) {
			return `/shows/${item.showId}`;
		}
		return "#";
	};

	const formatWeekRange = (): string => {
		if (!selectedWeekStart) return "";
		const weekEnd = new Date(selectedWeekStart);
		weekEnd.setDate(selectedWeekStart.getDate() + 6);
		return `${selectedWeekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
	};

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
			<div className="mb-8">
				<h1 className="text-display-2 mb-2">Release Calendar</h1>
				<p className="text-[var(--foreground-muted)]">
					Track upcoming movies and TV shows you're following.
				</p>
			</div>

			{/* Calendar Navigation */}
			<div className="mb-6 flex items-center justify-between">
				<button type="button" onClick={prevMonth} className="btn btn-secondary">
					<ChevronLeft className="h-4 w-4" />
					Previous
				</button>

				<div className="flex flex-col items-center">
					<h2 className="text-display-3">
						{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
					</h2>
					<button
						type="button"
						onClick={goToToday}
						className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors mt-1"
					>
						Go to today
					</button>
				</div>

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
						{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
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
						{Array.from({ length: firstDayOfMonth }).map((_, index) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: Empty calendar placeholder cells
								key={`calendar-empty-${index}`}
								className="h-24 rounded-lg bg-[var(--background-subtle)]"
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
							const inSelectedWeek = isInSelectedWeek(day);
							const isDimmed = selectedWeekStart && !inSelectedWeek;

							return (
								<button
									key={day}
									type="button"
									onClick={() => {
										const clickedDate = new Date(
											currentDate.getFullYear(),
											currentDate.getMonth(),
											day,
										);
										setSelectedWeekStart(getWeekStart(clickedDate));
									}}
									className={`relative h-24 flex flex-col items-start rounded-lg border p-1.5 text-left transition-all ${
										inSelectedWeek
											? "border-[var(--border)] bg-[var(--background-elevated)]"
											: isToday
												? "border-[var(--accent)] bg-[var(--accent-subtle)]"
												: "border-[var(--border)] bg-[var(--background-elevated)] hover:border-[var(--border-strong)]"
									} ${isDimmed ? "opacity-40" : ""}`}
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
										<div className="mt-1 flex flex-col gap-0.5 w-full">
											{dayReleases.slice(0, 2).map((release) => (
												<div
													key={`${release.showId || release.movieId || release.title}-${release.releaseDate}-${release.seasonNumber}-${release.episodeNumber}`}
													className="flex items-center gap-1.5 overflow-hidden"
												>
													<div
														className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
															getReleaseType(release) === "movie"
																? "bg-blue-500"
																: "bg-purple-500"
														}`}
													/>
													<span className="text-[10px] text-[var(--foreground)] truncate leading-tight">
														{getDisplayTitle(release)}
													</span>
												</div>
											))}
											{dayReleases.length > 2 && (
												<span className="text-[10px] text-[var(--foreground-muted)] leading-tight">
													+{dayReleases.length - 2} more
												</span>
											)}
										</div>
									)}
								</button>
							);
						})}

						{/* Empty cells for days after the last day of month to complete the grid */}
						{Array.from({
							length: (7 - ((firstDayOfMonth + daysInMonth) % 7)) % 7,
						}).map((_, index) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: Empty calendar placeholder cells
								key={`calendar-end-empty-${index}`}
								className="h-24 rounded-lg bg-[var(--background-subtle)]"
								aria-hidden="true"
							/>
						))}
					</div>
				</div>

				{/* Sidebar */}
				<div className="space-y-6">
					{/* Selected Week Releases */}
					<section>
						<h3 className="text-display-3 mb-4 flex items-center gap-2">
							<CalendarIcon className="h-5 w-5" />
							{selectedWeekStart ? formatWeekRange() : "Select a week"}
						</h3>
						{selectedWeekReleases.length === 0 ? (
							<div className="card p-6 text-center">
								{selectedWeekStart ? (
									<>
										<Clock className="mx-auto mb-3 h-8 w-8 text-[var(--foreground-muted)]" />
										<p className="text-[var(--foreground-muted)]">
											No releases this week
										</p>
									</>
								) : (
									<>
										<CalendarIcon className="mx-auto mb-3 h-8 w-8 text-[var(--foreground-muted)]" />
										<p className="text-[var(--foreground-muted)]">
											Click any day to see the week&apos;s releases
										</p>
									</>
								)}
							</div>
						) : (
							<div className="space-y-3">
								{selectedWeekReleases.map((release) => (
									<Link
										key={`${release.showId || release.movieId}-${release.releaseDate}-${release.date}-${release.seasonNumber}-${release.episodeNumber}`}
										to={getItemUrl(release)}
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
												{getDisplayTitle(release)}
											</p>
											<div className="mt-1 flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
												<span className="flex items-center gap-1">
													{getReleaseType(release) === "movie" ? (
														<Film className="h-3 w-3" />
													) : (
														<Tv className="h-3 w-3" />
													)}
													{new Date(release.date).toLocaleDateString("en-US", {
														month: "short",
														day: "numeric",
													})}
												</span>
											</div>
										</div>
									</Link>
								))}
							</div>
						)}
					</section>
				</div>
			</div>
		</div>
	);
}
