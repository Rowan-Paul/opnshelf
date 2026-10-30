import { beforeEach, describe, expect, it, vi } from "vitest";
import { encodeContent } from "../integrations/content-value";
import { IntegrationError } from "../integrations/integration-error";
import { encodeList } from "../integrations/list-value";
import { equivalent, type SyncRecord } from "../integrations/reconcile";
import { LIST, LIST_ITEM, type PopfeedRecord, REVIEW } from "./popfeed-records";
import { PopfeedWriter } from "./popfeed-writer";

const did = "did:plc:writer-fixture";
let records: Map<string, Record<string, unknown>>;
let serial = 0;
const collectionOf = (uri: string) => uri.split("/")[3];
const repo = {
	read: vi.fn(async () => {
		const of = (collection: string): PopfeedRecord[] =>
			[...records]
				.filter(([uri]) => collectionOf(uri) === collection)
				.map(([uri, value]) => ({ uri, value: structuredClone(value) }));
		return {
			listItems: of(LIST_ITEM),
			reviews: of(REVIEW),
			lists: of(LIST),
		};
	}),
	create: vi.fn(async (collection: string, record: Record<string, unknown>) => {
		const uri = `at://${did}/${collection}/r${++serial}`;
		records.set(uri, structuredClone(record));
		return uri;
	}),
	put: vi.fn(async (uri: string, record: Record<string, unknown>) => {
		records.set(uri, structuredClone(record));
	}),
	remove: vi.fn(async (uri: string) => {
		records.delete(uri);
	}),
	poster: vi.fn(async () => ({ $type: "blob", ref: { $link: "bafy" } })),
};
const lookup = {
	media: vi.fn(async (type: "movie" | "show", id: string) => ({
		title: type === "movie" ? `Movie ${id}` : `Show ${id}`,
		releaseDate: "2001-12-18",
		genres: ["Adventure"],
		mainCredit: "Fixture Director",
		posterPath: "/poster.jpg",
		backdropPath: "/backdrop.jpg",
	})),
};
const writer = new PopfeedWriter(
	repo,
	lookup,
	"Europe/Amsterdam",
	() => new Date("2026-10-30T12:00:00.000Z"),
);
const base = {
	mediaId: "120",
	season: 0,
	episode: 0,
	title: "Fixture",
};
const movieWatch = (value: string | null = "2026-10-30T09:47:00.000Z") =>
	({
		...base,
		key: "watch:local",
		kind: "watch",
		mediaType: "movie",
		value,
	}) as SyncRecord;
const values = () => [...records.values()];
/** Every write must read back as an equivalent record, or the sync loop rejects it. */
async function confirms(record: SyncRecord) {
	const read = await writer.read(record.kind);
	expect(read.filter((r) => equivalent(record, r))).toHaveLength(1);
	return read;
}

beforeEach(() => {
	records = new Map();
	serial = 0;
	vi.clearAllMocks();
});

describe("Popfeed Watches", () => {
	it("writes a watched movie in the shape Popfeed writes, creating its list", async () => {
		await writer.write(movieWatch());
		const [list, item] = values();
		expect(list).toMatchObject({
			listType: "watched_movies",
			name: "Watched Movies",
		});
		expect(item).toMatchObject({
			$type: LIST_ITEM,
			creativeWorkType: "movie",
			listType: "watched_movies",
			listUri: `at://${did}/${LIST}/r1`,
			addedAt: "2026-10-30T09:47:00.000Z",
			identifiers: { tmdbId: "120" },
			title: "Movie 120",
			mainCreditRole: "director",
			releaseDate: "2001-12-18T00:00:00.000Z",
			posterUrl: "https://image.tmdb.org/t/p/w500/poster.jpg",
			poster: { $type: "blob" },
		});
		await confirms(movieWatch());
	});
	it("reuses the role's list on older accounts that have items but no list record", async () => {
		records.set(`at://${did}/${LIST_ITEM}/old`, {
			creativeWorkType: "movie",
			listType: "watched_movies",
			listUri: `at://${did}/${LIST}/legacy`,
			addedAt: "2026-01-01T00:00:00.000Z",
			identifiers: { tmdbId: "550" },
		});
		await writer.write(movieWatch());
		expect(repo.create).toHaveBeenCalledTimes(1);
		expect(records.get(`at://${did}/${LIST_ITEM}/r1`)?.listUri).toBe(
			`at://${did}/${LIST}/legacy`,
		);
	});
	it("keeps a Watch at exactly midnight UTC a time, not a Popfeed date", async () => {
		const midnight = movieWatch("2026-10-30T00:00:00.000Z");
		await writer.write(midnight);
		await confirms(midnight);
	});
	it.each([
		[
			"a rewatch",
			() =>
				writer
					.write(movieWatch())
					.then(() => writer.write(movieWatch("2026-10-31T20:00:00.000Z"))),
		],
		["a No date Watch", () => writer.write(movieWatch(null))],
		[
			"an unmatched title",
			() => writer.write({ ...movieWatch(), mediaId: null }),
		],
	])("reports %s as something Popfeed cannot hold", async (_name, run) => {
		await expect(run()).rejects.toSatisfy(
			(error: unknown) =>
				error instanceof IntegrationError && error.status === 422,
		);
	});
	it("removes only the watched marker it was linked to", async () => {
		await writer.write(movieWatch());
		const [remote] = await writer.read("watch");
		await writer.write(remote, true);
		expect(values().map((v) => v.listType)).toEqual(["watched_movies"]);
		expect(values()).toHaveLength(1);
	});
	it("adds, confirms and removes episodes on one show entry", async () => {
		const episode = (n: number) =>
			({
				...base,
				key: `watch:local-${n}`,
				kind: "watch",
				mediaType: "episode",
				mediaId: "1920",
				season: 1,
				episode: n,
				value: "2026-10-30T20:00:00.000Z",
			}) as SyncRecord;
		await writer.write(episode(1));
		await writer.write(episode(2));
		const shows = values().filter((v) => v.creativeWorkType === "tv_show");
		expect(shows).toHaveLength(1);
		expect(shows[0]).toMatchObject({
			mainCreditRole: "creator",
			watchedEpisodes: [
				{ seasonNumber: 1, episodeNumber: 1 },
				{ seasonNumber: 1, episodeNumber: 2 },
			],
		});
		// Popfeed stores no episode dates; the undated read still confirms.
		await confirms(episode(2));
		await expect(writer.write(episode(2))).rejects.toThrow("rewatch");
		await writer.write(episode(1), true);
		expect(
			values().find((v) => v.creativeWorkType === "tv_show")?.watchedEpisodes,
		).toEqual([{ seasonNumber: 1, episodeNumber: 2 }]);
	});
});

describe("Popfeed Ratings and Reviews", () => {
	const rating = (value: number) =>
		({
			...base,
			key: "rating:local",
			kind: "rating",
			mediaType: "movie",
			value,
		}) as SyncRecord;
	const review = (content: string) =>
		({
			...base,
			key: "review:local",
			kind: "review",
			mediaType: "movie",
			title: "",
			value: encodeContent({ content, spoiler: true }),
			createdAt: "2026-10-30T10:00:00.000Z",
		}) as SyncRecord;
	it("creates, updates and removes a rating-only Popfeed review", async () => {
		await writer.write(rating(8));
		await confirms(rating(8));
		await writer.write(rating(10));
		expect(values()).toHaveLength(1);
		await confirms(rating(10));
		await writer.write(rating(10), true);
		expect(values()).toHaveLength(0);
	});
	it("writes Review text, reports the new record and keeps the rating when the text goes", async () => {
		await writer.write(rating(9));
		const created = vi.fn(async (_record: SyncRecord) => undefined);
		await writer.write(review("Loved it"), false, null, created);
		const key = created.mock.calls[0][0].key;
		expect(key).toMatch(/^review:at:\/\//);
		const written = await confirms(review("Loved it"));
		expect(written.find((r) => r.key === key)).toBeDefined();
		// The new review carries the title's current rating, so it stays the latest.
		expect(records.get(key.slice("review:".length))).toMatchObject({
			rating: 9,
			text: "Loved it",
			containsSpoilers: true,
		});
		await writer.write({ ...review("Loved it"), key }, true);
		expect(records.get(key.slice("review:".length))).toMatchObject({
			rating: 9,
			text: "",
		});
		await confirms(rating(9));
	});
	it("does not send season or episode Ratings", async () => {
		await expect(
			writer.write({
				...rating(7),
				mediaType: "episode",
				season: 1,
				episode: 1,
			}),
		).rejects.toThrow("movies and shows only");
	});
});

describe("Popfeed Lists", () => {
	const member = (mediaId: string, mediaType: "movie" | "show" = "movie") => ({
		mediaType,
		mediaId,
		season: 0,
		episode: 0,
		notes: "",
	});
	const list = (items: ReturnType<typeof member>[], key = "list:local") =>
		({
			key,
			kind: "list",
			mediaType: "list",
			mediaId: null,
			season: 0,
			episode: 0,
			title: "Favourites",
			value: encodeList({ name: "Favourites", description: "Best", items }),
			visibility: "public",
		}) as SyncRecord;
	it("creates a List, reports it, and keeps its items in step", async () => {
		const created = vi.fn(async (_record: SyncRecord) => undefined);
		await writer.write(
			list([member("1"), member("2", "show")]),
			false,
			null,
			created,
		);
		const key = created.mock.calls[0][0].key;
		await confirms(list([member("1"), member("2", "show")]));
		await writer.write(list([member("2", "show"), member("3")], key));
		const [read] = await writer.read("list");
		expect(read.key).toBe(key);
		expect(
			JSON.parse(String(read.value))
				.items.map((i: { mediaId: string }) => i.mediaId)
				.sort(),
		).toEqual(["2", "3"]);
		await writer.write(list([], key), true);
		expect(values()).toHaveLength(0);
	});
	it("refuses items and notes Popfeed cannot hold, without writing", async () => {
		await expect(
			writer.write(
				list([
					{
						...member("1"),
						mediaType: "episode" as "movie",
						season: 1,
						episode: 1,
					},
				]),
			),
		).rejects.toThrow("cannot be sent");
		await expect(
			writer.write(list([{ ...member("1"), notes: "Rewatch soon" }])),
		).rejects.toThrow("no notes");
		expect(repo.create).not.toHaveBeenCalled();
	});
	it("keeps the movie watchlist in step and refuses shows", async () => {
		const watchlist = (items: ReturnType<typeof member>[]) =>
			({
				...list(items, "watchlist:popfeed"),
				kind: "watchlist",
				title: "Watchlist",
				value: encodeList({ name: "Watchlist", description: "", items }),
			}) as SyncRecord;
		await writer.write(watchlist([member("1")]));
		await confirms(watchlist([member("1")]));
		await expect(
			writer.write(watchlist([member("2", "show")])),
		).rejects.toThrow("movies only");
	});
});
