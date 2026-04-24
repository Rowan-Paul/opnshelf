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
