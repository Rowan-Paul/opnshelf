export function createTitleSlug(title: string): string {
	return title
		.replace(/[^a-zA-Z0-9\s-]/g, "")
		.trim()
		.replace(/\s+/g, "-");
}

export function formatRuntime(minutes: number, useHours: boolean): string {
	if (!useHours) return `${minutes} min`;
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	if (mins === 0) return `${hours}h`;
	return `${hours}h ${mins}m`;
}

export function getTmdbPosterUrl(
	path: string | null | undefined,
	size: "w342" | "w500" | "w780" = "w342",
): string | null {
	if (!path) return null;
	return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function getTmdbBackdropUrl(
	path: string | null | undefined,
): string | null {
	if (!path) return null;
	return `https://image.tmdb.org/t/p/w1280${path}`;
}

export function getTmdbProfileUrl(
	path: string | null | undefined,
): string | null {
	if (!path) return null;
	return `https://image.tmdb.org/t/p/w185${path}`;
}

export interface DateFormatOptions {
	timezone: string;
	is24Hour: boolean;
	includeTime?: boolean;
}

export function formatDateWithTimezone(
	dateString: string | Date,
	options: DateFormatOptions,
): string {
	const { timezone, is24Hour, includeTime = true } = options;
	const date =
		typeof dateString === "string" ? new Date(dateString) : dateString;

	try {
		return date.toLocaleString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
			...(includeTime && {
				hour: "2-digit",
				minute: "2-digit",
				hour12: !is24Hour,
			}),
			timeZone: timezone,
		});
	} catch {
		return date.toLocaleString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
			...(includeTime && {
				hour: "2-digit",
				minute: "2-digit",
				hour12: !is24Hour,
			}),
		});
	}
}

export function getReleaseYear(
	dateString: string | null | undefined,
): number | null {
	if (!dateString) return null;
	try {
		return new Date(dateString).getFullYear();
	} catch {
		return null;
	}
}
