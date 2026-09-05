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
import { CalendarSkeleton } from "#/components/skeletons";
import { useAuth } from "#/lib/auth-context";
import {
	formatMonthDateKey,
	formatReleaseDate,
	formatWeekDayLabel,
	formatWeekRange,
	getCalendarDateRange,
	getDisplayTitle,
	getMonthGrid,
	getReleaseType,
	getReleaseUrl,
	getWeekDays,
	getWeekReleases,
	getWeekStart,
	isDateInWeek,
	MONTH_NAMES,
	shiftWeek,
	transformReleasesToDateMap,
	WEEKDAY_LABELS,
} from "#/lib/calendar-grid";

export const Route = createFileRoute("/calendar")({
	head: () => ({
		meta: [{ title: "Release Calendar | Opnshelf" }],
	}),
	component: CalendarPage,
});

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
	const dateRange = useMemo(
		() => getCalendarDateRange(currentDate),
		[currentDate],
	);

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

	const { daysInMonth, leadingEmptyCells, trailingEmptyCells } =
		getMonthGrid(currentDate);

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

	const dateInCurrentMonth = (day: number) =>
		new Date(currentDate.getFullYear(), currentDate.getMonth(), day);

	const selectedWeekReleases = getWeekReleases(selectedWeekStart, releases);

	// Mobile week navigation functions
	const goToPrevWeek = () => {
		if (!selectedWeekStart) return;
		const newWeekStart = shiftWeek(selectedWeekStart, -1);
		setSelectedWeekStart(newWeekStart);
		setCurrentDate(newWeekStart);
	};

	const goToNextWeek = () => {
		if (!selectedWeekStart) return;
		const newWeekStart = shiftWeek(selectedWeekStart, 1);
		setSelectedWeekStart(newWeekStart);
		setCurrentDate(newWeekStart);
	};

	// Group releases by day for mobile list view
	const mobileWeekDays = useMemo(
		() => getWeekDays(selectedWeekStart, releases),
		[selectedWeekStart, releases],
	);

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
						{MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
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
						{selectedWeekStart
							? formatWeekRange(selectedWeekStart, userTimezone)
							: "Select a week"}
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
				{mobileWeekDays.map((day) => (
					<section key={day.dateKey} className={day.isToday ? "relative" : ""}>
						{day.isToday && (
							<div className="absolute top-0 bottom-0 -left-3 w-1 rounded-full bg-(--accent)" />
						)}
						<h3
							className={`mb-3 text-display-3 ${
								day.isToday ? "text-(--accent)" : ""
							}`}
						>
							{formatWeekDayLabel(day.date, userTimezone)}
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
										to={getReleaseUrl(release)}
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
						{WEEKDAY_LABELS.map((day) => (
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
						{Array.from({ length: leadingEmptyCells }).map((_, index) => (
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
							const dateKey = formatMonthDateKey(
								currentDate.getFullYear(),
								currentDate.getMonth(),
								day,
							);
							const dayReleases = releases[dateKey] || [];
							const isToday =
								new Date().toDateString() ===
								dateInCurrentMonth(day).toDateString();
							const inSelectedWeek = isDateInWeek(
								dateInCurrentMonth(day),
								selectedWeekStart,
							);
							const isDimmed = selectedWeekStart && !inSelectedWeek;

							return (
								<button
									key={day}
									type="button"
									onClick={() => {
										setSelectedWeekStart(getWeekStart(dateInCurrentMonth(day)));
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
						{Array.from({ length: trailingEmptyCells }).map((_, index) => (
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
							{selectedWeekStart
								? formatWeekRange(selectedWeekStart, userTimezone)
								: "Select a week"}
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
										to={getReleaseUrl(release)}
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
													{formatReleaseDate(release.date, userTimezone)}
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
