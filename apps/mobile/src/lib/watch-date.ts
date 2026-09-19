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

/**
 * Place an optimistic Watch where the server will put it: dated entries newest
 * first, undated entries after all dated ones (ADR 0037).
 *
 * Prepending unconditionally would show a Watch logged for 2019 above one from
 * last week until the refetch lands, and an optimistic row that jumps on settle
 * is worse than one that arrives a moment later.
 */
export function insertWatchEntry<T extends { watchedDate?: string | null }>(
	entries: readonly T[],
	entry: T,
): T[] {
	const next = [...entries];
	const watchedDate = entry.watchedDate;

	// The server orders by watchedDate (nulls last) then createdAt descending,
	// and a Watch being logged right now has the newest createdAt. So it leads
	// its equals: before existing entries with the same date, and before
	// existing undated entries.
	const at = next.findIndex((existing) => {
		if (!watchedDate) return !existing.watchedDate;
		if (!existing.watchedDate) return true;
		return existing.watchedDate.localeCompare(watchedDate) <= 0;
	});
	if (at === -1) next.push(entry);
	else next.splice(at, 0, entry);
	return next;
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
