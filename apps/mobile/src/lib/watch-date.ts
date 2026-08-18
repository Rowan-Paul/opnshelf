type WatchDateFormatOptions = {
	locale?: string;
	timeZone?: string;
	hour12?: boolean;
};

/** Resolve an optimistic date without turning an explicit undated Watch into now. */
export function optimisticWatchDate(
	watchedAt: string | null | undefined,
	now: string,
): string | undefined {
	return watchedAt === null ? undefined : (watchedAt ?? now);
}

/** Return the newest dated Watch while ignoring undated Watches. */
export function latestWatchDate(
	watches: ReadonlyArray<{ watchedDate?: string | null }>,
): string | undefined {
	return watches.reduce<string | undefined>((latest, watch) => {
		if (!watch.watchedDate) return latest;
		if (!latest || watch.watchedDate.localeCompare(latest) > 0) {
			return watch.watchedDate;
		}
		return latest;
	}, undefined);
}

/**
 * Format a logged watch as a compact date and time. Formatting the two parts
 * separately keeps narrow poster cards from leaving a dangling locale-provided
 * "at" at the end of a truncated line.
 */
export function formatWatchDateTime(
	iso?: string,
	options: WatchDateFormatOptions = {},
): string | undefined {
	if (!iso) return undefined;
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return undefined;

	const { locale, timeZone, hour12 } = options;
	const datePart = date.toLocaleDateString(locale, {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone,
	});
	const timePart = date.toLocaleTimeString(locale, {
		hour: "numeric",
		minute: "2-digit",
		timeZone,
		hour12,
	});

	return `${datePart} · ${timePart}`;
}
