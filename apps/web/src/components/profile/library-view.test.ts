import { filterLibraryItems, type LibraryItemDto } from "@opnshelf/api";
import { expect, it } from "vitest";

it("combines title and Box Set search with Format and preserves the loaded order by default", () => {
	const entries: LibraryItemDto[] = [
		{
			id: "1",
			rkey: "1",
			mediaType: "movie",
			mediaId: "1",
			format: "dvd",
			createdAt: "2026-10-02",
			media: { title: "Zebra" },
			boxSet: "Studio Archive",
		},
		{
			id: "2",
			rkey: "2",
			mediaType: "movie",
			mediaId: "2",
			format: "dvd",
			createdAt: "2026-10-01",
			media: { title: "Archive Road", releaseYear: 1998 },
		},
		{
			id: "3",
			rkey: "3",
			mediaType: "movie",
			mediaId: "3",
			format: "bluray",
			createdAt: "2026-09-30",
			media: { title: "A Studio Archive", releaseYear: 2022 },
		},
		{
			id: "4",
			rkey: "4",
			mediaType: "movie",
			mediaId: "4",
			format: "dvd",
			createdAt: "2026-09-29",
			media: { name: "River Archive", releaseYear: 2010 },
		},
	];
	const filters = { format: "dvd", search: "  ARCHIVE " } as const;
	expect(
		filterLibraryItems(entries, { ...filters, sort: "added" }).map(
			({ id }) => id,
		),
	).toEqual(["1", "2", "4"]);
	expect(
		filterLibraryItems(entries, { ...filters, sort: "title" }).map(
			({ id }) => id,
		),
	).toEqual(["2", "4", "1"]);
	expect(
		filterLibraryItems(entries, { ...filters, sort: "year" }).map(
			({ id }) => id,
		),
	).toEqual(["4", "2", "1"]);
	expect(
		filterLibraryItems(entries, {
			...filters,
			search: "no match",
			sort: "added",
		}),
	).toEqual([]);
	expect(entries.map(({ id }) => id)).toEqual(["1", "2", "3", "4"]);
});

it("matches an episode Library Item by its episode name", () => {
	const episode: LibraryItemDto = {
		id: "1",
		rkey: "1",
		mediaType: "episode",
		mediaId: "1",
		format: "digital",
		createdAt: "2026-10-02",
		media: { name: "Harbour Lights" },
		episodeName: "Pilot",
	};
	expect(
		filterLibraryItems([episode], {
			format: "all",
			search: "pilot",
			sort: "added",
		}),
	).toEqual([episode]);
});
