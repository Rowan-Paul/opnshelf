import type { LibraryItemDto } from "./generated/types.gen";

export const LIBRARY_SORT_OPTIONS = [
	{ value: "added", label: "Date added" },
	{ value: "title", label: "Title A–Z" },
	{ value: "year", label: "Release year" },
] as const;

export type LibrarySort = (typeof LIBRARY_SORT_OPTIONS)[number]["value"];

export function libraryItemTitle(item: LibraryItemDto): string {
	const { title, name } = item.media;
	if (typeof title === "string" && title) return title;
	if (typeof name === "string" && name) return name;
	return "Unknown";
}

function releaseYear(item: LibraryItemDto): number {
	const year = item.media.releaseYear;
	return typeof year === "number" ? year : -Infinity;
}

export function filterLibraryItems(
	items: LibraryItemDto[],
	{
		format,
		search,
		sort,
	}: {
		format: LibraryItemDto["format"] | "all";
		search: string;
		sort: LibrarySort;
	},
): LibraryItemDto[] {
	const query = search.trim().toLowerCase();
	const matches = items.filter(
		(item) =>
			(format === "all" || item.format === format) &&
			(!query ||
				libraryItemTitle(item).toLowerCase().includes(query) ||
				item.episodeName?.toLowerCase().includes(query) ||
				item.boxSet?.toLowerCase().includes(query)),
	);
	if (sort === "added") return matches;
	return matches.sort((a, b) => {
		if (sort === "year") {
			const byYear = releaseYear(b) - releaseYear(a);
			if (byYear) return byYear;
		}
		return libraryItemTitle(a).localeCompare(libraryItemTitle(b), undefined, {
			sensitivity: "base",
		});
	});
}
