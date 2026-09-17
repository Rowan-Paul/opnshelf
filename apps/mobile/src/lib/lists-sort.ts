import type { ListSummaryDto } from "@opnshelf/api";

/**
 * Sorting the lists themselves, as opposed to `ListSort`, which orders the
 * items inside one list. Same options as Web's Lists overview.
 *
 * Pure, and kept out of the sheet component so it can be tested without a
 * React Native environment.
 */
export type ListsSort = "default" | "updated" | "name" | "items";

export const LISTS_SORT_OPTIONS: { key: ListsSort; label: string }[] = [
	{ key: "default", label: "Default order" },
	{ key: "updated", label: "Recently updated" },
	{ key: "name", label: "Name" },
	{ key: "items", label: "Most items" },
];

export function listsSortLabel(sort: ListsSort): string {
	return (
		LISTS_SORT_OPTIONS.find((o) => o.key === sort)?.label ?? "Default order"
	);
}

/**
 * `default` is the server's own order — default lists first, then by name — so
 * it stays what you see until you ask otherwise. The rest sort client-side:
 * every list is already loaded, so this needs no request and no new query key.
 *
 * Always returns every list it was given, and never mutates the input.
 */
export function sortLists(
	lists: ListSummaryDto[],
	sort: ListsSort,
): ListSummaryDto[] {
	if (sort === "default") return lists;
	const sorted = [...lists];
	if (sort === "updated") {
		sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
	} else if (sort === "name") {
		sorted.sort((a, b) => a.name.localeCompare(b.name));
	} else {
		// Ties keep a stable, readable order rather than whatever the API sent.
		sorted.sort(
			(a, b) => b.itemCount - a.itemCount || a.name.localeCompare(b.name),
		);
	}
	return sorted;
}
