import type { ListSummaryDto } from "@opnshelf/api";
import { describe, expect, it } from "vitest";
import { type ListsSort, sortLists } from "./lists-sort";

const list = (
	name: string,
	itemCount: number,
	updatedAt: string,
): ListSummaryDto => ({
	id: name,
	rkey: name,
	name,
	slug: name.toLowerCase().replace(/\s+/g, "-"),
	isDefault: false,
	itemCount,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt,
});

// Mirrors the local data that surfaced the bug: a default-ordered set where
// every sort moves something.
const lists = [
	list("Favorites", 1, "2026-03-01T00:00:00.000Z"),
	list("Watchlist", 3, "2026-05-01T00:00:00.000Z"),
	list("A custom lister", 5, "2026-04-01T00:00:00.000Z"),
];

describe("sortLists", () => {
	it("keeps every list whichever sort is applied", () => {
		for (const sort of [
			"default",
			"updated",
			"name",
			"items",
		] satisfies ListsSort[]) {
			const sorted = sortLists(lists, sort);
			expect(sorted).toHaveLength(lists.length);
			expect([...sorted].map((l) => l.name).sort()).toEqual(
				[...lists].map((l) => l.name).sort(),
			);
		}
	});

	it("leaves the server's order alone by default", () => {
		expect(sortLists(lists, "default").map((l) => l.name)).toEqual([
			"Favorites",
			"Watchlist",
			"A custom lister",
		]);
	});

	it("orders by name, recency and size", () => {
		expect(sortLists(lists, "name").map((l) => l.name)).toEqual([
			"A custom lister",
			"Favorites",
			"Watchlist",
		]);
		expect(sortLists(lists, "updated").map((l) => l.name)).toEqual([
			"Watchlist",
			"A custom lister",
			"Favorites",
		]);
		expect(sortLists(lists, "items").map((l) => l.name)).toEqual([
			"A custom lister",
			"Watchlist",
			"Favorites",
		]);
	});

	it.each<ListsSort>([
		"default",
		"updated",
		"name",
		"items",
	])("does not mutate the input when sorting by %s", (sort) => {
		const input = lists.map((item) => ({ ...item }));
		const original = structuredClone(input);
		for (const item of input) Object.freeze(item);
		Object.freeze(input);

		sortLists(input, sort);

		expect(input).toEqual(original);
	});

	it("breaks item-count ties by name", () => {
		const input = [
			list("Zebra", 3, "2026-03-01T00:00:00.000Z"),
			list("Alpha", 3, "2026-03-01T00:00:00.000Z"),
			list("Largest", 5, "2026-03-01T00:00:00.000Z"),
		];

		expect(sortLists(input, "items").map((item) => item.name)).toEqual([
			"Largest",
			"Alpha",
			"Zebra",
		]);
	});
});
