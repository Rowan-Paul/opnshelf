import type { ReleaseCalendarItemDto } from "@opnshelf/api";
import { withUserLocale } from "./date-utils";
import { buildEpisodeUrl, buildMovieUrl, buildShowUrl } from "./url-utils";

/**
 * Pure date bucketing and grid maths for the Release Calendar route. Every
 * function here works on local-time `Date` values (the browser's zone), which
 * is what the route renders; nothing touches React or the network.
 */

export type ReleasesByDate = Record<string, ReleaseCalendarItemDto[]>;

export type DatedRelease = ReleaseCalendarItemDto & { date: string };

export type CalendarWeekDay = {
	date: Date;
	dateKey: string;
	releases: ReleaseCalendarItemDto[];
	isToday: boolean;
};

export const MONTH_NAMES = [
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
] as const;

export const WEEKDAY_LABELS = [
	"Mon",
	"Tue",
	"Wed",
	"Thu",
	"Fri",
	"Sat",
	"Sun",
] as const;

/** Group API items by the calendar day of their ISO release date. */
export function transformReleasesToDateMap(
	items: ReleaseCalendarItemDto[],
): ReleasesByDate {
	const releasesByDate: ReleasesByDate = {};

	for (const item of items) {
		const dateKey = item.releaseDate.split("T")[0]; // Extract YYYY-MM-DD from ISO date
		if (!releasesByDate[dateKey]) {
			releasesByDate[dateKey] = [];
		}
		releasesByDate[dateKey].push(item);
	}

	return releasesByDate;
}

/** Local midnight of the Monday that starts the week containing `date`. */
export function getWeekStart(date: Date): Date {
	const d = new Date(date);
	const day = d.getDay();
	// Adjust for Monday start (0 = Sunday, so Monday is 1)
	const diff = day === 0 ? 6 : day - 1;
	d.setDate(d.getDate() - diff);
	d.setHours(0, 0, 0, 0);
	return d;
}

/** The same weekday `weeks` weeks away (negative moves back). */
export function shiftWeek(weekStart: Date, weeks: number): Date {
	const shifted = new Date(weekStart);
	shifted.setDate(weekStart.getDate() + weeks * 7);
	return shifted;
}

export function isSameDay(d1: Date, d2: Date): boolean {
	return (
		d1.getFullYear() === d2.getFullYear() &&
		d1.getMonth() === d2.getMonth() &&
		d1.getDate() === d2.getDate()
	);
}

/** `YYYY-MM-DD` from a year, zero-based month index, and day of month. */
export function formatMonthDateKey(
	year: number,
	monthIndex: number,
	day: number,
): string {
	const month = String(monthIndex + 1).padStart(2, "0");
	const dayStr = String(day).padStart(2, "0");
	return `${year}-${month}-${dayStr}`;
}

/** `YYYY-MM-DD` from the local calendar components of a Date. */
export function formatLocalDateKey(date: Date): string {
	return formatMonthDateKey(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
	);
}

/**
 * The API window for a visible month: first day of the previous month through
 * the last day of the next month, as ISO date strings.
 */
export function getCalendarDateRange(currentDate: Date): {
	startDate: string;
	endDate: string;
} {
	const year = currentDate.getFullYear();
	const month = currentDate.getMonth();

	// Previous month
	const prevMonth = new Date(year, month - 1, 1);
	// Next month
	const nextMonth = new Date(year, month + 2, 0); // Last day of next month

	const startDate = prevMonth.toISOString().split("T")[0];
	const endDate = nextMonth.toISOString().split("T")[0];

	return { startDate, endDate };
}

/** Cell counts for a Monday-first month grid. */
export function getMonthGrid(currentDate: Date): {
	daysInMonth: number;
	leadingEmptyCells: number;
	trailingEmptyCells: number;
} {
	const year = currentDate.getFullYear();
	const month = currentDate.getMonth();

	const daysInMonth = new Date(year, month + 1, 0).getDate();
	// Shift so Monday = 0, Sunday = 6
	const leadingEmptyCells = (new Date(year, month, 1).getDay() + 6) % 7;
	const trailingEmptyCells = (7 - ((leadingEmptyCells + daysInMonth) % 7)) % 7;

	return { daysInMonth, leadingEmptyCells, trailingEmptyCells };
}

/** Whether `date` falls in the Monday-first week that starts on `weekStart`. */
export function isDateInWeek(date: Date, weekStart: Date | null): boolean {
	if (!weekStart) return false;
	return isSameDay(getWeekStart(date), weekStart);
}

/** For TV episodes, show "SxE Title" format. */
export function getDisplayTitle(item: ReleaseCalendarItemDto): string {
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
}

export function getReleaseType(item: ReleaseCalendarItemDto): "movie" | "show" {
	return item.mediaType;
}

export function getReleaseUrl(item: ReleaseCalendarItemDto): string {
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
}

function eachDayOfWeek(weekStart: Date): Date[] {
	const days: Date[] = [];
	for (let i = 0; i < 7; i++) {
		const date = new Date(weekStart);
		date.setDate(weekStart.getDate() + i);
		days.push(date);
	}
	return days;
}

/** Every release in the selected week, flattened and tagged with its day key. */
export function getWeekReleases(
	weekStart: Date | null,
	releases: ReleasesByDate,
): DatedRelease[] {
	if (!weekStart) return [];

	const weekReleases: DatedRelease[] = [];

	for (const date of eachDayOfWeek(weekStart)) {
		// Use local date components to match the month grid's day keys
		const dateKey = formatLocalDateKey(date);
		const dayReleases = releases[dateKey] || [];
		for (const release of dayReleases) {
			weekReleases.push({ ...release, date: dateKey });
		}
	}

	// Sort by date
	return weekReleases.sort(
		(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
	);
}

/** The seven days of the selected week with their releases (Mobile list view). */
export function getWeekDays(
	weekStart: Date | null,
	releases: ReleasesByDate,
	today: Date = new Date(),
): CalendarWeekDay[] {
	if (!weekStart) return [];

	return eachDayOfWeek(weekStart).map((date) => {
		const dateKey = formatLocalDateKey(date);
		return {
			date,
			dateKey,
			releases: releases[dateKey] || [],
			isToday: isSameDay(date, today),
		};
	});
}

/** e.g. "Mar 23 - Mar 29" */
export function formatWeekRange(
	weekStart: Date | null,
	timezone?: string,
): string {
	if (!weekStart) return "";
	const weekEnd = new Date(weekStart);
	weekEnd.setDate(weekStart.getDate() + 6);
	const options = withUserLocale({ month: "short", day: "numeric" }, timezone);
	return `${weekStart.toLocaleDateString("en-US", options)} - ${weekEnd.toLocaleDateString("en-US", options)}`;
}

/** "Today", or e.g. "Mon, Jan 15". */
export function formatWeekDayLabel(
	date: Date,
	timezone?: string,
	today: Date = new Date(),
): string {
	if (isSameDay(date, today)) return "Today";

	return date.toLocaleDateString(
		"en-US",
		withUserLocale(
			{ weekday: "short", month: "short", day: "numeric" },
			timezone,
		),
	);
}

/** e.g. "Jan 15" for a `YYYY-MM-DD` day key. */
export function formatReleaseDate(dateKey: string, timezone?: string): string {
	return new Date(dateKey).toLocaleDateString(
		"en-US",
		withUserLocale({ month: "short", day: "numeric" }, timezone),
	);
}
