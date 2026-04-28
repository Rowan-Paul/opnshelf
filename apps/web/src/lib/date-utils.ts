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
