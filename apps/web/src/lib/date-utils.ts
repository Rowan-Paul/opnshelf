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
