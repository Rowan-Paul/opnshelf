import type { ReleaseCalendarItemDto } from "@opnshelf/api";
import { createTitleSlug, getDayKeyInTimezone } from "@/lib/utils";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type ReleaseCalendarNavigationTarget = {
	pathname:
		| "/movie/[id]"
		| "/show/[id]"
		| "/show/[id]/season/[seasonNumber]/episode/[episodeNumber]";
	params: Record<string, string>;
};

export type ReleaseCalendarEvent = {
	id: string;
	dayKey: string;
	monthKey: string;
	source: ReleaseCalendarItemDto["source"];
	kind: "episode" | "movie" | "show";
	title: string;
	subtitle: string;
	description?: string;
	posterPath?: string | null;
	seasonNumber?: number;
	episodeNumber?: number;
	navigationTarget: ReleaseCalendarNavigationTarget;
};

export type ReleaseCalendarDaySection = {
	dayKey: string;
	label: string;
	items: ReleaseCalendarEvent[];
};

export function buildReleaseCalendarEvents({
	timezone,
	items,
}: {
	timezone: string;
	items: ReleaseCalendarItemDto[];
}) {
	const todayKey = getDayKeyInTimezone(new Date(), timezone);
	const dedupe = new Set<string>();
	const events: ReleaseCalendarEvent[] = [];

	for (const item of items) {
		if (!item.releaseDate) {
			continue;
		}

		const dayKey = getDayKeyInTimezone(
			parseCalendarDateValue(item.releaseDate),
			timezone,
		);
		if (dayKey < todayKey) {
			continue;
		}

		const navigationTarget = getReleaseCalendarNavigationTarget(item);
		const dedupeKey = `${item.source}:${item.mediaType}:${item.movieId ?? item.showId ?? item.title}:${item.seasonNumber ?? ""}:${item.episodeNumber ?? ""}:${dayKey}`;

		if (!navigationTarget || dedupe.has(dedupeKey)) {
			continue;
		}

		dedupe.add(dedupeKey);
		events.push({
			id: dedupeKey,
			dayKey,
			monthKey: dayKey.slice(0, 7),
			source: item.source,
			kind:
				item.releaseKind === "episode"
					? "episode"
					: item.releaseKind === "movie"
						? "movie"
						: "show",
			title: item.title,
			subtitle: item.subtitle ?? "",
			description: item.overview,
			posterPath: item.posterPath,
			seasonNumber: item.seasonNumber,
			episodeNumber: item.episodeNumber,
			navigationTarget,
		});
	}

	return events.sort((left, right) => {
		if (left.dayKey !== right.dayKey) {
			return left.dayKey.localeCompare(right.dayKey);
		}

		return left.title.localeCompare(right.title);
	});
}

export function groupReleaseCalendarEventsByDay({
	events,
	monthKey,
	timezone,
}: {
	events: ReleaseCalendarEvent[];
	monthKey: string;
	timezone: string;
}) {
	const sections = new Map<string, ReleaseCalendarDaySection>();

	for (const event of events) {
		if (event.monthKey !== monthKey) {
			continue;
		}

		const existingSection = sections.get(event.dayKey);
		if (existingSection) {
			existingSection.items.push(event);
			continue;
		}

		sections.set(event.dayKey, {
			dayKey: event.dayKey,
			label: formatDayLabel(event.dayKey, timezone),
			items: [event],
		});
	}

	return Array.from(sections.values());
}

export function formatMonthLabel(monthKey: string) {
	const [year, month] = monthKey.split("-").map(Number);
	return new Date(Date.UTC(year, month - 1, 1, 12, 0, 0)).toLocaleDateString(
		"en-US",
		{
			month: "long",
			year: "numeric",
			timeZone: "UTC",
		},
	);
}

export function getAdjacentMonthKey(monthKey: string, offset: number) {
	const date = getDateFromMonthKey(monthKey);
	date.setUTCMonth(date.getUTCMonth() + offset, 1);
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function formatDayLabel(dayKey: string, timezone: string) {
	const date = getDateFromDayKey(dayKey);
	const currentYear = Number(
		getDayKeyInTimezone(new Date(), timezone).split("-")[0] ?? date.getUTCFullYear(),
	);
	const year = Number(dayKey.split("-")[0] ?? currentYear);

	return date.toLocaleDateString("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
		timeZone: "UTC",
		...(year !== currentYear ? { year: "numeric" } : {}),
	});
}

export function getReleaseSourcePresentation(
	source: ReleaseCalendarItemDto["source"],
) {
	return {
		sourceLabel: source === "watching" ? "Watching" : "Watchlist",
		tone: source === "watching" ? "primary" : "tertiary",
	};
}

export function getCalendarEventEpisodeLabel(event: ReleaseCalendarEvent) {
	if (
		typeof event.seasonNumber === "number" &&
		typeof event.episodeNumber === "number"
	) {
		return `S${event.seasonNumber} E${event.episodeNumber}`;
	}

	if (event.kind === "episode" && event.subtitle) {
		return event.subtitle.split(" · ")[0] ?? event.subtitle;
	}

	return event.subtitle || "Upcoming episode";
}

function getReleaseCalendarNavigationTarget(
	item: ReleaseCalendarItemDto,
): ReleaseCalendarNavigationTarget | null {
	const titleSlug = createTitleSlug(item.title);

	if (item.mediaType === "movie" && item.movieId) {
		return {
			pathname: "/movie/[id]",
			params: {
				id: item.movieId,
				title: titleSlug,
			},
		};
	}

	if (
		item.mediaType === "show" &&
		item.showId &&
		typeof item.seasonNumber === "number" &&
		typeof item.episodeNumber === "number"
	) {
		return {
			pathname: "/show/[id]/season/[seasonNumber]/episode/[episodeNumber]",
			params: {
				id: item.showId,
				seasonNumber: String(item.seasonNumber),
				episodeNumber: String(item.episodeNumber),
				title: titleSlug,
			},
		};
	}

	if (item.mediaType === "show" && item.showId) {
		return {
			pathname: "/show/[id]",
			params: {
				id: item.showId,
				title: titleSlug,
			},
		};
	}

	return null;
}

function parseCalendarDateValue(value: string) {
	if (DATE_ONLY_PATTERN.test(value)) {
		return new Date(`${value}T12:00:00Z`);
	}

	return new Date(value);
}

function getDateFromMonthKey(monthKey: string) {
	const [year, month] = monthKey.split("-").map(Number);
	return new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
}

function getDateFromDayKey(dayKey: string) {
	const [year, month, day] = dayKey.split("-").map(Number);
	return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}
