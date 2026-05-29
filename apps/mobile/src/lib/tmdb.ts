/**
 * TMDB image URL helpers. The API returns bare `*_path` fragments
 * (e.g. `/abc.jpg`); these resolve them to fully-qualified CDN URLs at the
 * sizes the mobile UI needs. Returns `undefined` when the path is missing so
 * callers can render a placeholder.
 */
const IMAGE_BASE = "https://image.tmdb.org/t/p";

export function posterUrl(
	path: string | null | undefined,
	size: "w185" | "w342" | "w500" = "w342",
): string | undefined {
	return path ? `${IMAGE_BASE}/${size}${path}` : undefined;
}

export function backdropUrl(
	path: string | null | undefined,
	size: "w780" | "w1280" | "original" = "w1280",
): string | undefined {
	return path ? `${IMAGE_BASE}/${size}${path}` : undefined;
}

export function profileUrl(
	path: string | null | undefined,
	size: "w185" | "h632" = "w185",
): string | undefined {
	return path ? `${IMAGE_BASE}/${size}${path}` : undefined;
}

export function stillUrl(
	path: string | null | undefined,
	size: "w300" | "w780" = "w300",
): string | undefined {
	return path ? `${IMAGE_BASE}/${size}${path}` : undefined;
}

/** Extract a 4-digit year from a TMDB date string (YYYY-MM-DD). */
export function yearFromDate(
	date: string | null | undefined,
): string | undefined {
	if (!date) return undefined;
	const year = date.slice(0, 4);
	return /^\d{4}$/.test(year) ? year : undefined;
}

/** Format a runtime in minutes as `1h 42m` / `42m`. */
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
