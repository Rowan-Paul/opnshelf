/**
 * Format a runtime in minutes as `1h 42m` / `42m` / `2h`, matching the Mobile
 * App's `formatRuntime`. Returns undefined for a missing or zero runtime so
 * callers hide it rather than printing "0h 0m".
 */
export function formatRuntime(
	minutes: number | null | undefined,
): string | undefined {
	if (!minutes || minutes <= 0) return undefined;
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	if (hours === 0) return `${mins}m`;
	if (mins === 0) return `${hours}h`;
	return `${hours}h ${mins}m`;
}
