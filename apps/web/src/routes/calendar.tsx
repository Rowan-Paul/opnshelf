import type { ReleaseCalendarItemDto } from "@opnshelf/api";
import { showsControllerGetUserReleaseCalendarOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	Calendar as CalendarIcon,
	ChevronLeft,
	ChevronRight,
	Clock,
	Film,
	Tv,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "#/lib/auth-context";
import { withUserLocale } from "#/lib/date-utils";
import { buildEpisodeUrl, buildMovieUrl, buildShowUrl } from "#/lib/url-utils";

export const Route = createFileRoute("/calendar")({
	head: () => ({
		meta: [{ title: "Release Calendar | OpnShelf" }],
	}),
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

// Shape-matched loading placeholder for the calendar page — mirrors both the
// mobile week list and the desktop grid + sidebar so nothing jumps once the
// real data lands.
const CAL_IDX = (n: number) => Array.from({ length: n }, (_, i) => i);
const CAL_PULSE = "animate-pulse rounded bg-(--background-subtle)";

function CalendarSkeleton() {
	return (
		<>
			{/* Mobile: Week Navigation */}
			<div className="mb-6 flex items-center justify-between lg:hidden">
				<div className={`size-12 rounded-lg ${CAL_PULSE}`} />
				<div className={`h-6 w-32 ${CAL_PULSE}`} />
				<div className={`size-12 rounded-lg ${CAL_PULSE}`} />
			</div>

			{/* Mobile: Week List View */}
			<div className="space-y-6 lg:hidden">
				{CAL_IDX(3).map((i) => (
					<section key={i}>
						<div className={`mb-3 h-5 w-24 ${CAL_PULSE}`} />
						<div className="space-y-3">
							{CAL_IDX(2).map((j) => (
								<div
									key={j}
									className="flex items-center gap-3 rounded-xl border border-(--border) p-3"
								>
									<div
										className={`h-24 w-16 shrink-0 rounded-md ${CAL_PULSE}`}
									/>
									<div className="min-w-0 flex-1 space-y-2">
										<div className={`h-3.5 w-3/4 ${CAL_PULSE}`} />
										<div className={`h-3 w-1/3 ${CAL_PULSE}`} />
									</div>
								</div>
							))}
						</div>
					</section>
				))}
			</div>

			{/* Desktop: Calendar Grid + Sidebar */}
			<div className="hidden gap-8 lg:grid lg:grid-cols-3">
				<div className="lg:col-span-2">
					<div className="mb-2 grid grid-cols-7 gap-1">
						{CAL_IDX(7).map((i) => (
							<div key={i} className={`h-5 ${CAL_PULSE}`} />
						))}
					</div>
					<div className="grid grid-cols-7 gap-1">
						{CAL_IDX(35).map((i) => (
							<div key={i} className={`h-24 rounded-lg ${CAL_PULSE}`} />
						))}
					</div>
				</div>

				<div className="space-y-3">
					<div className={`mb-4 h-6 w-40 ${CAL_PULSE}`} />
					{CAL_IDX(4).map((i) => (
						<div
							key={i}
							className="flex items-center gap-3 rounded-xl border border-(--border) p-3"
						>
							<div className={`h-16 w-12 shrink-0 rounded-md ${CAL_PULSE}`} />
							<div className="min-w-0 flex-1 space-y-2">
								<div className={`h-3 w-2/3 ${CAL_PULSE}`} />
								<div className={`h-2.5 w-1/3 ${CAL_PULSE}`} />
							</div>
						</div>
					))}
				</div>
			</div>
		</>
	);
}

// Get the start of the week (Monday) for a given date
function getWeekStart(date: Date): Date {
	const d = new Date(date);
	const day = d.getDay();
	// Adjust for Monday start (0 = Sunday, so Monday is 1)
	const diff = day === 0 ? 6 : day - 1;
	d.setDate(d.getDate() - diff);
	d.setHours(0, 0, 0, 0);
	return d;
}

function CalendarPage() {
	const {
		user,
		userSettings,
		isAuthenticated,
		isLoading: authLoading,
	} = useAuth();
	const navigate = useNavigate();
	const userTimezone = userSettings?.timezone;

	// Redirect to login if not authenticated
	useEffect(() => {
		if (!authLoading && !isAuthenticated) {
			navigate({ to: "/login" });
		}
	}, [authLoading, isAuthenticated, navigate]);

	const [currentDate, setCurrentDate] = useState(new Date());
	const [selectedWeekStart, setSelectedWeekStart] = useState<Date | null>(null);

	// Initialize selected week to current week on mount
	useEffect(() => {
		setSelectedWeekStart((current) => {
			if (!current) {
				return getWeekStart(new Date());
			}
			return current;
		});
	}, []);

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
			return buildMovieUrl(item.movieId, item.title);
		}
		if (
			item.mediaType === "show" &&
			item.releaseKind === "episode" &&
			item.showId &&
			item.seasonNumber !== undefined &&
			item.episodeNumber !== undefined
		) {
			return buildEpisodeUrl(
				item.showId,
				item.title,
				item.seasonNumber,
				item.episodeNumber,
			);
		}
		if (item.mediaType === "show" && item.showId) {
			return buildShowUrl(item.showId, item.title);
		}
		return "#";
	};

	const formatWeekRange = (): string => {
		if (!selectedWeekStart) return "";
		const weekEnd = new Date(selectedWeekStart);
		weekEnd.setDate(selectedWeekStart.getDate() + 6);
		return `${selectedWeekStart.toLocaleDateString("en-US", withUserLocale({ month: "short", day: "numeric" }, userTimezone))} - ${weekEnd.toLocaleDateString("en-US", withUserLocale({ month: "short", day: "numeric" }, userTimezone))}`;
	};

	// Mobile week navigation functions
	const goToPrevWeek = () => {
		if (!selectedWeekStart) return;
		const newWeekStart = new Date(selectedWeekStart);
		newWeekStart.setDate(selectedWeekStart.getDate() - 7);
		setSelectedWeekStart(newWeekStart);
		setCurrentDate(newWeekStart);
	};

	const goToNextWeek = () => {
		if (!selectedWeekStart) return;
		const newWeekStart = new Date(selectedWeekStart);
		newWeekStart.setDate(selectedWeekStart.getDate() + 7);
		setSelectedWeekStart(newWeekStart);
		setCurrentDate(newWeekStart);
	};

	// Group releases by day for mobile list view
	const getMobileWeekReleases = useMemo(() => {
		if (!selectedWeekStart) return [];

		const days: Array<{
			date: Date;
			dateKey: string;
			releases: Array<ReleaseCalendarItemDto>;
			isToday: boolean;
		}> = [];

		for (let i = 0; i < 7; i++) {
			const date = new Date(selectedWeekStart);
			date.setDate(selectedWeekStart.getDate() + i);
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, "0");
			const day = String(date.getDate()).padStart(2, "0");
			const dateKey = `${year}-${month}-${day}`;
			const dayReleases = releases[dateKey] || [];

			const today = new Date();
			const isToday =
				date.getFullYear() === today.getFullYear() &&
				date.getMonth() === today.getMonth() &&
				date.getDate() === today.getDate();

			days.push({
				date,
				dateKey,
				releases: dayReleases,
				isToday,
			});
		}

		return days;
	}, [selectedWeekStart, releases]);

	// Format date for mobile view (e.g., "Mon, Jan 15")
	const formatMobileDate = (date: Date): string => {
		const today = new Date();
		const isToday =
			date.getFullYear() === today.getFullYear() &&
			date.getMonth() === today.getMonth() &&
			date.getDate() === today.getDate();

		if (isToday) return "Today";

		return date.toLocaleDateString(
			"en-US",
			withUserLocale(
				{ weekday: "short", month: "short", day: "numeric" },
				userTimezone,
			),
		);
	};

	if (isLoading) {
		return (
			<div className="container-app py-8">
				<div className="mb-8">
					<h1 className="mb-2 text-display-2">Release Calendar</h1>
					<p className="text-(--foreground-muted)">
						Track upcoming movies and TV shows you're following.
					</p>
				</div>
				<CalendarSkeleton />
			</div>
		);
	}

	return (
		<div className="container-app py-8">
			{/* Header */}
			<div className="mb-8">
				<h1 className="mb-2 text-display-2">Release Calendar</h1>
				<p className="text-(--foreground-muted)">
					Track upcoming movies and TV shows you're following.
				</p>
			</div>

			{/* Desktop: Calendar Navigation */}
			<div className="mb-6 hidden items-center justify-between lg:flex">
				<button type="button" onClick={prevMonth} className="btn btn-secondary">
					<ChevronLeft className="size-4" />
					Previous
				</button>

				<div className="flex flex-col items-center">
					<h2 className="text-display-3">
						{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
					</h2>
					<button
						type="button"
						onClick={goToToday}
						className="mt-1 text-(--foreground-muted) text-sm transition-colors hover:text-(--foreground)"
					>
						Go to today
					</button>
				</div>

				<button type="button" onClick={nextMonth} className="btn btn-secondary">
					Next
					<ChevronRight className="size-4" />
				</button>
			</div>

			{/* Mobile: Week Navigation */}
			<div className="mb-6 flex items-center justify-between lg:hidden">
				<button
					type="button"
					onClick={goToPrevWeek}
					className="btn btn-secondary h-12 w-12 p-0"
					aria-label="Previous week"
				>
					<ChevronLeft className="size-6" />
				</button>

				<div className="flex flex-col items-center px-4">
					<h2 className="text-center text-display-3">
						{selectedWeekStart ? formatWeekRange() : "Select a week"}
					</h2>
					<button
						type="button"
						onClick={goToToday}
						className="mt-1 text-(--foreground-muted) text-sm transition-colors hover:text-(--foreground)"
					>
						Go to today
					</button>
				</div>

				<button
					type="button"
					onClick={goToNextWeek}
					className="btn btn-secondary h-12 w-12 p-0"
					aria-label="Next week"
				>
					<ChevronRight className="size-6" />
				</button>
			</div>

			{/* Mobile: Week List View */}
			<div className="space-y-6 lg:hidden">
				{getMobileWeekReleases.map((day, _index) => (
					<section key={day.dateKey} className={day.isToday ? "relative" : ""}>
						{day.isToday && (
							<div className="absolute top-0 bottom-0 -left-3 w-1 rounded-full bg-(--accent)" />
						)}
						<h3
							className={`mb-3 text-display-3 ${
								day.isToday ? "text-(--accent)" : ""
							}`}
						>
							{formatMobileDate(day.date)}
						</h3>

						{day.releases.length === 0 ? (
							<div className="card p-4">
								<p className="text-(--foreground-muted) text-sm">No releases</p>
							</div>
						) : (
							<div className="space-y-3">
								{day.releases.map((release) => (
									<Link
										key={`${release.showId || release.movieId}-${day.dateKey}-${release.seasonNumber}-${release.episodeNumber}`}
										to={getItemUrl(release)}
										className="card card-interactive flex items-center gap-3 p-3"
									>
										{release.posterPath ? (
											<img
												src={`https://image.tmdb.org/t/p/w200${release.posterPath}`}
												alt={release.title}
												className="h-24 w-16 rounded object-cover"
												loading="lazy"
											/>
										) : (
											<div className="flex h-24 w-16 shrink-0 items-center justify-center rounded bg-(--background-subtle)">
												{getReleaseType(release) === "movie" ? (
													<Film className="size-10 text-(--foreground-muted)" />
												) : (
													<Tv className="size-10 text-(--foreground-muted)" />
												)}
											</div>
										)}
										<div className="min-w-0 flex-1">
											<p
												title={getDisplayTitle(release)}
												className="truncate font-medium"
											>
												{getDisplayTitle(release)}
											</p>
											<div className="mt-1 flex items-center gap-2 text-(--foreground-muted) text-sm">
												<span className="flex items-center gap-1">
													{getReleaseType(release) === "movie" ? (
														<>
															<Film className="size-4" />
															Movie
														</>
													) : (
														<>
															<Tv className="size-4" />
															TV
														</>
													)}
												</span>
											</div>
										</div>
										<ChevronRight className="size-6 shrink-0 text-(--foreground-muted)" />
									</Link>
								))}
							</div>
						)}
					</section>
				))}
			</div>

			{/* Desktop View */}
			<div className="hidden gap-8 lg:grid lg:grid-cols-3">
				{/* Calendar Grid */}
				<div className="lg:col-span-2">
					{/* Weekday Headers */}
					<div className="mb-2 grid grid-cols-7 gap-1">
						{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
							<div
								key={day}
								className="py-2 text-center font-medium text-(--foreground-muted) text-sm"
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
								className="h-24 rounded-lg bg-(--background-subtle)"
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
									className={`relative flex h-24 flex-col items-start rounded-lg border p-1.5 text-left transition-all ${
										inSelectedWeek
											? "border-(--border) bg-(--background-elevated)"
											: isToday
												? "border-(--accent) bg-(--accent-subtle)"
												: "border-(--border) bg-(--background-elevated) hover:border-(--border-strong)"
									} ${isDimmed ? "opacity-40" : ""}`}
								>
									<span
										className={`font-medium text-sm ${
											isToday ? "text-(--accent)" : "text-(--foreground)"
										}`}
									>
										{day}
									</span>

									{dayReleases.length > 0 && (
										<div className="mt-1 flex w-full flex-col gap-0.5">
											{dayReleases.slice(0, 2).map((release) => (
												<div
													key={`${release.showId || release.movieId || release.title}-${release.releaseDate}-${release.seasonNumber}-${release.episodeNumber}`}
													className="flex items-center gap-1.5 overflow-hidden"
												>
													<div
														className={`h-1.5 w-1.5 shrink-0 rounded-full ${
															getReleaseType(release) === "movie"
																? "bg-blue-500"
																: "bg-purple-500"
														}`}
													/>
													<span
														title={getDisplayTitle(release)}
														className="truncate text-(--foreground) text-[10px] leading-tight"
													>
														{getDisplayTitle(release)}
													</span>
												</div>
											))}
											{dayReleases.length > 2 && (
												<span className="text-(--foreground-muted) text-[10px] leading-tight">
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
								className="h-24 rounded-lg bg-(--background-subtle)"
								aria-hidden="true"
							/>
						))}
					</div>
				</div>

				{/* Sidebar */}
				<div className="space-y-6">
					{/* Selected Week Releases */}
					<section>
						<h3 className="mb-4 flex items-center gap-2 text-display-3">
							<CalendarIcon className="h-5 w-5" />
							{selectedWeekStart ? formatWeekRange() : "Select a week"}
						</h3>
						{selectedWeekReleases.length === 0 ? (
							<div className="card p-6 text-center">
								{selectedWeekStart ? (
									<>
										<Clock className="mx-auto mb-3 size-8 text-(--foreground-muted)" />
										<p className="text-(--foreground-muted)">
											No releases this week
										</p>
									</>
								) : (
									<>
										<CalendarIcon className="mx-auto mb-3 h-8 w-8 text-(--foreground-muted)" />
										<p className="text-(--foreground-muted)">
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
											<div className="flex h-16 w-12 items-center justify-center rounded bg-(--background-subtle)">
												{getReleaseType(release) === "movie" ? (
													<Film className="size-6 text-(--foreground-muted)" />
												) : (
													<Tv className="size-6 text-(--foreground-muted)" />
												)}
											</div>
										)}
										<div className="min-w-0 flex-1">
											<p
												title={getDisplayTitle(release)}
												className="truncate font-medium text-sm"
											>
												{getDisplayTitle(release)}
											</p>
											<div className="mt-1 flex items-center gap-2 text-(--foreground-muted) text-xs">
												<span className="flex items-center gap-1">
													{getReleaseType(release) === "movie" ? (
														<Film className="size-3" />
													) : (
														<Tv className="size-3" />
													)}
													{new Date(release.date).toLocaleDateString(
														"en-US",
														withUserLocale(
															{ month: "short", day: "numeric" },
															userTimezone,
														),
													)}
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
