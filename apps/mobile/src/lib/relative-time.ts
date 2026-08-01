/**
 * "3 hours ago" for past timestamps. Plain arithmetic rather than
 * Intl.RelativeTimeFormat: Hermes ships only part of Intl, and the app already
 * limits itself to Intl.DateTimeFormat elsewhere.
 */
const UNITS: [label: string, ms: number][] = [
	["year", 365 * 24 * 60 * 60 * 1000],
	["month", 30 * 24 * 60 * 60 * 1000],
	["day", 24 * 60 * 60 * 1000],
	["hour", 60 * 60 * 1000],
	["minute", 60 * 1000],
];

export function formatRelativeTime(isoString: string): string {
	const time = new Date(isoString).getTime();
	if (Number.isNaN(time)) return "";
	const elapsed = Date.now() - time;
	// A device whose clock runs ahead reports a future lastUsedAt; "just now"
	// beats "in -2 minutes".
	if (elapsed < 60_000) return "just now";
	for (const [label, ms] of UNITS) {
		const value = Math.floor(elapsed / ms);
		if (value >= 1) {
			return `${value} ${label}${value === 1 ? "" : "s"} ago`;
		}
	}
	return "just now";
}
