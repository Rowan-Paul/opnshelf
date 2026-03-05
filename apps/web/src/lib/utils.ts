import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

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
	if (mins === 0) return `${hours} hours`;
	return `${hours} hours ${mins} minutes`;
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

export function buildScopedShowMediaId(
	showId: string,
	seasonNumber?: number,
	episodeNumber?: number,
): string {
	if (typeof seasonNumber === "number" && Number.isFinite(seasonNumber)) {
		if (typeof episodeNumber === "number" && Number.isFinite(episodeNumber)) {
			return `${showId}:season:${seasonNumber}:episode:${episodeNumber}`;
		}
		return `${showId}:season:${seasonNumber}`;
	}
	return showId;
}

export function parseScopedShowMediaId(mediaId: string): {
	showId: string;
	seasonNumber?: number;
	episodeNumber?: number;
} {
	const episodeMatch = mediaId.match(/^([^:]+):season:(\d+):episode:(\d+)$/);
	if (episodeMatch) {
		return {
			showId: episodeMatch[1],
			seasonNumber: Number(episodeMatch[2]),
			episodeNumber: Number(episodeMatch[3]),
		};
	}

	const seasonMatch = mediaId.match(/^([^:]+):season:(\d+)$/);
	if (seasonMatch) {
		return {
			showId: seasonMatch[1],
			seasonNumber: Number(seasonMatch[2]),
		};
	}

	return { showId: mediaId };
}

export interface DateFormatOptions {
	timezone: string;
	is24Hour: boolean;
	includeTime?: boolean;
}

export function getDayKeyInTimezone(
	dateString: string | Date,
	timezone: string,
): string {
	const date =
		typeof dateString === "string" ? new Date(dateString) : dateString;

	try {
		const formatter = new Intl.DateTimeFormat("en-US", {
			timeZone: timezone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		});
		const parts = formatter.formatToParts(date);
		const year = parts.find((part) => part.type === "year")?.value ?? "0000";
		const month = parts.find((part) => part.type === "month")?.value ?? "01";
		const day = parts.find((part) => part.type === "day")?.value ?? "01";
		return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
	} catch {
		return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
	}
}

export function getShelfDayLabel(dayKey: string, timezone: string): string {
	const now = new Date();
	const todayKey = getDayKeyInTimezone(now, timezone);
	const yesterdayKey = getDayKeyInTimezone(
		new Date(now.getTime() - 24 * 60 * 60 * 1000),
		timezone,
	);

	if (dayKey === todayKey) return "Today";
	if (dayKey === yesterdayKey) return "Yesterday";

	const [year, month, day] = dayKey.split("-").map(Number);
	const safeDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
	const currentYear = Number(todayKey.split("-")[0] ?? now.getUTCFullYear());

	return safeDate.toLocaleDateString("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
		...(year !== currentYear ? { year: "numeric" } : {}),
	});
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

export function formatDateOnly(
	dateString: string | Date,
	timezone = "UTC",
): string {
	const date =
		typeof dateString === "string" ? new Date(dateString) : dateString;
	try {
		return date.toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
			timeZone: timezone,
		});
	} catch {
		return date.toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	}
}
