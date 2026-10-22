const RELATIVE_UNITS: [label: string, ms: number][] = [
	["year", 365 * 24 * 60 * 60 * 1000],
	["month", 30 * 24 * 60 * 60 * 1000],
	["week", 7 * 24 * 60 * 60 * 1000],
	["day", 24 * 60 * 60 * 1000],
	["hour", 60 * 60 * 1000],
	["minute", 60 * 1000],
];

/**
 * "3 hours ago" for past timestamps, shared by Web and Mobile.
 * Plain arithmetic keeps this compatible with Hermes without relying on
 * Intl.RelativeTimeFormat.
 *
 * Units round rather than truncate, so 45 days reads "2 months ago" — the
 * nearest unit, not the floor.
 */
export function formatRelativeTime(isoString: string): string {
	if (!isoString) return "";
	const time = new Date(isoString).getTime();
	if (Number.isNaN(time)) return "";
	const elapsed = Date.now() - time;
	// A device whose clock runs ahead reports a future lastUsedAt; "just now"
	// beats "in -2 minutes".
	if (elapsed < 60_000) return "just now";
	for (const [label, ms] of RELATIVE_UNITS) {
		const value = Math.round(elapsed / ms);
		if (value >= 1) {
			return `${value} ${label}${value === 1 ? "" : "s"} ago`;
		}
	}
	return "just now";
}
