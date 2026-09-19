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

/** Thrown when a datetime-local value is empty or cannot be parsed. */
export class InvalidDatetimeLocalError extends Error {
	constructor(readonly value: string) {
		super(`Not a valid datetime-local value: ${JSON.stringify(value)}`);
		this.name = "InvalidDatetimeLocalError";
	}
}

/** datetime-local omits seconds; `Date.parse` wants them. */
function normalizeDatetimeLocal(value: string): string {
	return value.length === 16 ? `${value}:00` : value;
}

/**
 * The current wall-clock time in `timezone` (browser timezone if omitted),
 * formatted for a `datetime-local` input.
 */
export function nowAsDatetimeLocal(timezone?: string): string {
	const parts = new Intl.DateTimeFormat("en-US", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		// h23, not hour12:false — en-US renders midnight as "24" under the
		// latter, which is not a value a datetime-local input accepts.
		hourCycle: "h23",
		timeZone: timezone,
	}).formatToParts(new Date());
	const part = (type: string) =>
		parts.find((p) => p.type === type)?.value ?? "00";
	return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

/**
 * Convert a datetime-local input value ("2026-07-04T20:15"), interpreted as
 * wall-clock time in the given IANA timezone (browser timezone if omitted),
 * to a UTC ISO string. Sending the bare string to the backend makes the
 * server parse it as UTC, shifting the stored time by the zone offset.
 */
export function datetimeLocalToISO(value: string, timezone?: string): string {
	// An empty or unparseable field is a caller bug, not a way to express an
	// undated Watch — that is `watchedAt: null`, chosen via "No date". Throwing
	// a typed error keeps a cleared input from taking down a click handler with
	// a bare RangeError from deep inside the conversion.
	if (!value || Number.isNaN(Date.parse(normalizeDatetimeLocal(value)))) {
		throw new InvalidDatetimeLocalError(value);
	}
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

const RELATIVE_UNITS: [label: string, ms: number][] = [
	["year", 365 * 24 * 60 * 60 * 1000],
	["month", 30 * 24 * 60 * 60 * 1000],
	["week", 7 * 24 * 60 * 60 * 1000],
	["day", 24 * 60 * 60 * 1000],
	["hour", 60 * 60 * 1000],
	["minute", 60 * 1000],
];

/**
 * "3 hours ago" for past timestamps. Byte-for-byte identical to Mobile's
 * `apps/mobile/src/lib/relative-time.ts`: the list info card and the devices
 * row render on both clients, so the same instant has to read the same on
 * both. Plain arithmetic rather than Intl.RelativeTimeFormat because Hermes
 * ships only part of Intl, so the Mobile copy cannot use it and this one has
 * to match. Change both together, or the clients drift apart again.
 *
 * Units round rather than truncate, so 45 days reads "2 months ago" — the
 * nearest unit, not the floor.
 */
export function formatRelativeTime(dateString: string): string {
	if (!dateString) return "";
	const time = new Date(dateString).getTime();
	if (Number.isNaN(time)) return "";
	const elapsed = Date.now() - time;
	// A clock running ahead reports a future timestamp; "just now" beats
	// "in -2 minutes".
	if (elapsed < 60_000) return "just now";
	for (const [label, ms] of RELATIVE_UNITS) {
		const value = Math.round(elapsed / ms);
		if (value >= 1) {
			return `${value} ${label}${value === 1 ? "" : "s"} ago`;
		}
	}
	return "just now";
}
