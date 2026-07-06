/**
 * Merge user timezone / time-format preferences into Intl.DateTimeFormat options.
 * Keeps the existing locale and formatting options; only injects the
 * user's timezone and (optionally) forces 24-hour clock.
 */
export function withUserLocale(
	options: Intl.DateTimeFormatOptions,
	timezone?: string,
	timeFormat?: "12h" | "24h",
): Intl.DateTimeFormatOptions {
	const merged: Intl.DateTimeFormatOptions = { ...options };

	if (timezone) {
		merged.timeZone = timezone;
	}

	if (timeFormat === "24h") {
		merged.hour12 = false;
	}

	return merged;
}

/**
 * Format a date-time string into a human-readable date and time.
 * Respects user timezone and 12/24-hour format preferences.
 * Falls back to the raw string if parsing fails.
 */
export function formatDateTime(
	dateString: string,
	timezone?: string,
	timeFormat?: "12h" | "24h",
): string {
	if (!dateString) return "Unknown";
	try {
		return new Date(dateString).toLocaleString(
			"en-US",
			withUserLocale(
				{
					month: "short",
					day: "numeric",
					year: "numeric",
					hour: "numeric",
					minute: "2-digit",
				},
				timezone,
				timeFormat,
			),
		);
	} catch {
		return dateString;
	}
}

/**
 * Format a date string into a human-readable date.
 * Falls back to the raw string if parsing fails.
 */
export function formatDate(dateString: string, timezone?: string): string {
	if (!dateString) return "Unknown";
	try {
		return new Date(dateString).toLocaleDateString(
			"en-US",
			withUserLocale(
				{ month: "long", day: "numeric", year: "numeric" },
				timezone,
			),
		);
	} catch {
		return dateString;
	}
}

/**
 * Convert a datetime-local input value ("2026-07-04T20:15"), interpreted as
 * wall-clock time in the given IANA timezone (browser timezone if omitted),
 * to a UTC ISO string. Sending the bare string to the backend makes the
 * server parse it as UTC, shifting the stored time by the zone offset.
 */
export function datetimeLocalToISO(value: string, timezone?: string): string {
	if (!timezone) return new Date(value).toISOString();
	const withSeconds = value.length === 16 ? `${value}:00` : value;
	const wallAsUTC = Date.parse(`${withSeconds}Z`);
	// Guess the instant by treating the wall clock as UTC, then correct by the
	// zone offset at that instant; recompute once in case the guess lands on
	// the other side of a DST transition.
	// ponytail: the skipped/ambiguous DST hour itself resolves to the later
	// offset — fine for a watch log.
	let utc = wallAsUTC;
	for (let i = 0; i < 2; i++) {
		utc = wallAsUTC - wallClockOffsetMs(utc, timezone);
	}
	return new Date(utc).toISOString();
}

/** Offset (ms) between the wall clock in `timezone` and UTC at instant atMs. */
function wallClockOffsetMs(atMs: number, timezone: string): number {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23",
	}).formatToParts(new Date(atMs));
	const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
	const wall = Date.parse(
		`${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`,
	);
	return wall - atMs;
}

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", {
	numeric: "auto",
});

const timeUnits: [Intl.RelativeTimeFormatUnit, number][] = [
	["year", 31536000000],
	["month", 2592000000],
	["week", 604800000],
	["day", 86400000],
	["hour", 3600000],
	["minute", 60000],
	["second", 1000],
];

export function formatRelativeTime(dateString: string): string {
	if (!dateString) return "";
	try {
		const date = new Date(dateString);
		const now = new Date();
		const diff = date.getTime() - now.getTime();
		for (const [unit, ms] of timeUnits) {
			const value = Math.round(diff / ms);
			if (Math.abs(value) >= 1) {
				return relativeTimeFormatter.format(value, unit);
			}
		}

		return "just now";
	} catch {
		return dateString;
	}
}
