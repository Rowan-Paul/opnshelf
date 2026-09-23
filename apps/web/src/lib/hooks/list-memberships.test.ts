import { describe, expect, it } from "vitest";
import { listsForItem, withMembership } from "./list-memberships";

const lists = [
	{ id: "w", name: "Watchlist", slug: "watchlist", isDefault: true },
	{ id: "f", name: "Favorites", slug: "favorites", isDefault: true },
	{ id: "c", name: "Cosy", slug: "cosy", isDefault: false },
];
const memberships = [
	{
		mediaType: "movie" as const,
		mediaId: "550",
		seasonNumber: 0,
		episodeNumber: 0,
		listIds: ["w", "c"],
	},
	{
		mediaType: "episode" as const,
		mediaId: "1399",
		seasonNumber: 1,
		episodeNumber: 2,
		listIds: ["f"],
	},
];

describe("listsForItem", () => {
	it("marks the lists that hold the item, in the viewer's list order", () => {
		expect(
			listsForItem(memberships, lists, {
				mediaType: "movie",
				mediaId: "550",
			}).map((list) => [list.listSlug, list.isInList]),
		).toEqual([
			["watchlist", true],
			["favorites", false],
			["cosy", true],
		]);
	});

	it("tells an episode apart from its show and from other episodes", () => {
		const episode = listsForItem(memberships, lists, {
			mediaType: "episode",
			mediaId: "1399",
			seasonNumber: 1,
			episodeNumber: 2,
		});
		expect(
			episode.filter((list) => list.isInList).map((list) => list.listId),
		).toEqual(["f"]);
		expect(
			listsForItem(memberships, lists, {
				mediaType: "show",
				mediaId: "1399",
			}).some((list) => list.isInList),
		).toBe(false);
	});
});

describe("withMembership", () => {
	it("adds a list to an item, creating the item when it had none", () => {
		const added = withMembership(
			memberships,
			{ mediaType: "show", mediaId: "1" },
			"w",
			true,
		);
		expect(added.at(-1)).toEqual({
			mediaType: "show",
			mediaId: "1",
			seasonNumber: 0,
			episodeNumber: 0,
			listIds: ["w"],
		});
		expect(
			withMembership(
				memberships,
				{ mediaType: "movie", mediaId: "550" },
				"f",
				true,
			)[0].listIds,
		).toEqual(["w", "c", "f"]);
	});

	it("removes a list from an item and leaves the rest untouched", () => {
		const removed = withMembership(
			memberships,
			{ mediaType: "movie", mediaId: "550" },
			"w",
			false,
		);
		expect(removed[0].listIds).toEqual(["c"]);
		expect(removed[1]).toBe(memberships[1]);
	});
});
