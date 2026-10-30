import { describe, expect, it } from "vitest";
import { contentValue } from "../integrations/content-value";
import { listValue } from "../integrations/list-value";
import {
	popfeedRecords,
	reviewMarkdown,
	watchDate,
	type PopfeedRepository,
} from "./popfeed-records";

const repo = "at://did:plc:fixture";
const all = {
	watches: true,
	ratings: true,
	lists: true,
	watchlist: true,
	reviews: true,
};
const movieItem = (rkey: string, value: Record<string, unknown>) => ({
	uri: `${repo}/social.popfeed.feed.listItem/${rkey}`,
	value: {
		$type: "social.popfeed.feed.listItem",
		creativeWorkType: "movie",
		identifiers: { tmdbId: "120", imdbId: "tt0120737" },
		title: "Fixture Movie",
		mainCreditRole: "Directed by",
		poster: { $type: "blob", ref: { $link: "bafy" } },
		...value,
	},
});
const review = (rkey: string, value: Record<string, unknown>) => ({
	uri: `${repo}/social.popfeed.feed.review/${rkey}`,
	value: {
		$type: "social.popfeed.feed.review",
		creativeWorkType: "movie",
		identifiers: { tmdbId: "120" },
		title: "Fixture Movie",
		text: "",
		facets: [],
		tags: [],
		isRevisit: false,
		containsSpoilers: false,
		...value,
	},
});
const empty: PopfeedRepository = { listItems: [], reviews: [], lists: [] };

describe("Popfeed watch dates", () => {
	it("keeps a precise log time", () => {
		expect(watchDate("2026-10-30T09:47:00.366Z", "Europe/Amsterdam")).toEqual({
			value: "2026-10-30T09:47:00.366Z",
			dateOnly: false,
		});
	});
	it("keeps the calendar date of a backdated midnight-UTC log", () => {
		// Converting the instant would put this on 17 September in New York.
		expect(watchDate("2026-09-18T00:00:00.000Z", "America/New_York")).toEqual({
			value: "2026-09-18T16:00:00.000Z",
			dateOnly: true,
		});
		expect(watchDate("2026-01-18T00:00:00.000Z", "Europe/Amsterdam")).toEqual({
			value: "2026-01-18T11:00:00.000Z",
			dateOnly: true,
		});
	});
	it("rejects an invalid date", () => {
		expect(watchDate("yesterday", "UTC")).toBeNull();
	});
});

describe("Popfeed record mapping", () => {
	it("maps watched movies, including backdated logs", () => {
		const records = popfeedRecords(
			{
				...empty,
				listItems: [
					movieItem("a", {
						listType: "watched_movies",
						listUri: `${repo}/social.popfeed.feed.list/w`,
						addedAt: "2026-10-30T09:47:00.366Z",
					}),
					movieItem("b", {
						listType: "watched_movies",
						listUri: `${repo}/social.popfeed.feed.list/w`,
						addedAt: "2026-09-18T00:00:00.000Z",
						identifiers: { imdbId: "tt1" },
					}),
				],
			},
			all,
			"UTC",
		).filter((r) => r.kind === "watch");
		expect(records).toEqual([
			expect.objectContaining({
				key: `watch:${repo}/social.popfeed.feed.listItem/a`,
				mediaType: "movie",
				mediaId: "120",
				value: "2026-10-30T09:47:00.366Z",
			}),
			expect.objectContaining({
				mediaId: null,
				value: "2026-09-18T12:00:00.000Z",
				dateOnly: true,
			}),
		]);
		expect(records[0]).not.toHaveProperty("dateOnly");
	});
	it("maps watched episodes as No date Watches, once per episode", () => {
		const show = (rkey: string, listUri: string) => ({
			uri: `${repo}/social.popfeed.feed.listItem/${rkey}`,
			value: {
				creativeWorkType: "tv_show",
				listUri,
				addedAt: "2026-02-19T12:10:44.729Z",
				identifiers: { tmdbId: "1920" },
				title: "Fixture Show",
				position: null,
				watchedEpisodes: [
					{ tmdbId: "1", seasonNumber: 1, episodeNumber: 1 },
					{ tmdbId: "2", seasonNumber: 1, episodeNumber: 2 },
				],
			},
		});
		const records = popfeedRecords(
			{
				...empty,
				listItems: [
					show("s", `${repo}/social.popfeed.feed.list/current`),
					show("t", `${repo}/social.popfeed.feed.list/other`),
				],
			},
			all,
			"UTC",
		).filter((r) => r.kind === "watch");
		expect(records).toEqual([
			expect.objectContaining({
				key: "watch:episode:1920:1:1",
				mediaType: "episode",
				mediaId: "1920",
				season: 1,
				episode: 1,
				value: null,
			}),
			expect.objectContaining({ season: 1, episode: 2, value: null }),
		]);
	});
	it("maps the watchlist and custom Lists, flagging items Opnshelf cannot hold", () => {
		const listUri = `${repo}/social.popfeed.feed.list/l`;
		const records = popfeedRecords(
			{
				listItems: [
					movieItem("w", {
						listType: "movie_watchlist",
						listUri: `${repo}/social.popfeed.feed.list/wl`,
						addedAt: "2026-01-01T10:00:00.000Z",
					}),
					movieItem("m", {
						listType: "default",
						listUri,
						addedAt: "2026-01-01T10:00:00.000Z",
					}),
					{
						uri: `${repo}/social.popfeed.feed.listItem/book`,
						value: {
							creativeWorkType: "book",
							listType: "default",
							listUri,
							addedAt: "2026-01-01T10:00:00.000Z",
							identifiers: { isbn13: "9780000000000" },
						},
					},
				],
				reviews: [],
				lists: [
					{
						uri: listUri,
						// Newer list records omit ordered and tags.
						value: { name: "Favourites", listType: "default", createdAt: "x" },
					},
					{
						uri: `${repo}/social.popfeed.feed.list/w`,
						value: { name: "Watched Movies", listType: "watched_movies" },
					},
				],
			},
			all,
			"UTC",
		);
		const watchlist = records.find((r) => r.kind === "watchlist");
		expect(watchlist && listValue(watchlist).items).toEqual([
			{ mediaType: "movie", mediaId: "120", season: 0, episode: 0, notes: "" },
		]);
		const lists = records.filter((r) => r.kind === "list");
		expect(lists).toHaveLength(1);
		expect(lists[0]).toMatchObject({
			key: `list:${listUri}`,
			title: "Favourites",
			problem: expect.stringContaining("books or games"),
		});
		expect(listValue(lists[0]).items).toHaveLength(1);
	});
	it("keeps the latest Rating per title and turns text into a Review", () => {
		const records = popfeedRecords(
			{
				...empty,
				reviews: [
					review("old", { rating: 7, createdAt: "2026-01-01T00:00:00.000Z" }),
					review("new", {
						rating: 10,
						createdAt: "2026-10-30T09:47:02.635Z",
						text: "Loved it",
						containsSpoilers: true,
					}),
					review("zero", {
						identifiers: { tmdbId: "550" },
						rating: 0,
						createdAt: "2026-10-01T00:00:00.000Z",
					}),
				],
			},
			all,
			"UTC",
		);
		expect(records.filter((r) => r.kind === "rating")).toEqual([
			expect.objectContaining({
				key: "rating:movie:120:0:0",
				mediaId: "120",
				value: 10,
			}),
		]);
		const reviews = records.filter((r) => r.kind === "review");
		expect(reviews).toHaveLength(1);
		expect(reviews[0].title).toBe("");
		expect(contentValue(reviews[0])).toMatchObject({
			content: "Loved it",
			spoiler: true,
		});
	});
	it("reads only enabled record types", () => {
		const records = popfeedRecords(
			{
				...empty,
				listItems: [
					movieItem("a", {
						listType: "watched_movies",
						listUri: "x",
						addedAt: "2026-10-30T09:47:00.366Z",
					}),
				],
				reviews: [
					review("r", { rating: 8, createdAt: "2026-01-01T00:00:00Z" }),
				],
			},
			{ ratings: true },
			"UTC",
		);
		expect(records.map((r) => r.kind)).toEqual(["rating"]);
	});
	it("skips records that do not match the observed shape", () => {
		expect(
			popfeedRecords(
				{
					listItems: [{ uri: "bad", value: { title: "No list" } }],
					reviews: [{ uri: "bad", value: { rating: "ten" } }],
					lists: [],
				},
				all,
				"UTC",
			).filter((r) => r.kind !== "watchlist"),
		).toEqual([]);
	});
});

describe("Popfeed review facets", () => {
	it("turns link facets into Markdown links by byte range", () => {
		const text = "Read más here";
		expect(
			reviewMarkdown(text, [
				{
					index: { byteStart: 5, byteEnd: 9 },
					features: [
						{ $type: "app.bsky.richtext.facet#link", uri: "https://x.test" },
					],
				},
				{ index: { byteStart: 0, byteEnd: 4 }, features: [{ $type: "tag" }] },
			]),
		).toBe("Read [más](https://x.test) here");
	});
});
