import { describe, expect, it, vi } from "vitest";
import { snapshotLists, writeList } from "./remote-lists";
import { encodeList, listValue, memberKey } from "./list-value";
import type { SyncRecord } from "./reconcile";

const metadata = {
	name: "Weekend",
	description: "Films",
	privacy: "private",
	ids: { trakt: 22 },
	item_count: 1,
	updated_at: "2026-10-15T12:00:00Z",
};
const movie = {
	id: 7,
	rank: 1,
	type: "movie",
	notes: "A note",
	movie: { ids: { trakt: 9, tmdb: 12 } },
};
const response = (data: unknown, count?: number) => ({
	data,
	headers: new Headers(
		count === undefined
			? {}
			: {
					"x-pagination-item-count": String(count),
					"x-pagination-page-count": "1",
				},
	),
});
const record: SyncRecord = {
	key: "list:local",
	kind: "list",
	mediaType: "list",
	mediaId: null,
	season: 0,
	episode: 0,
	title: "Weekend",
	visibility: "private",
	value: encodeList({
		name: "Weekend",
		description: "Films",
		items: [
			{
				mediaType: "movie",
				mediaId: "12",
				season: 0,
				episode: 0,
				notes: "A note",
			},
		],
	}),
};

describe("Trakt Lists transport", () => {
	it("reads private Lists, ordered memberships and notes without publishing them", async () => {
		const request = vi.fn(async (path: string, _token?: string) =>
			path === "/users/me/lists" ? response([metadata]) : response([movie], 1),
		);
		const result = await snapshotLists({ request }, "fixture", { lists: true });
		expect(result).toEqual([
			{ ...record, key: "list:22", traktId: 22, problem: undefined },
		]);
		expect(
			request.mock.calls.every(([path]) => !path.includes("privacy=")),
		).toBe(true);
	});
	it("rejects incomplete pagination before inferring removals", async () => {
		const request = vi.fn(async (path: string, _token?: string) =>
			path === "/users/me/lists" ? response([metadata]) : response([], 1),
		);
		await expect(
			snapshotLists({ request }, "fixture", { lists: true }),
		).rejects.toThrow("incomplete");
	});
	it("rejects a List that changes while reading", async () => {
		let reads = 0;
		const request = vi.fn(async (path: string, _token?: string) =>
			path === "/users/me/lists"
				? response([{ ...metadata, updated_at: String(reads++) }])
				: response([movie], 1),
		);
		await expect(
			snapshotLists({ request }, "fixture", { lists: true }),
		).rejects.toThrow("changed");
	});
	it("keeps unsupported Trakt media visible as an unresolved List", async () => {
		const request = vi.fn(async (path: string, _token?: string) =>
			path === "/users/me/lists"
				? response([metadata])
				: response([{ id: 7, rank: 1, type: "person" }], 1),
		);
		expect(
			(await snapshotLists({ request }, "fixture", { lists: true }))[0].problem,
		).toContain("unsupported");
	});
	it("uses the separate watchlist endpoint, including an empty watchlist", async () => {
		const request = vi.fn(async (path: string) =>
			path === "/users/settings"
				? response({ user: { private: false } })
				: response([], 0),
		);
		const [watchlist] = await snapshotLists({ request }, "fixture", {
			watchlist: true,
		});
		expect(watchlist.kind).toBe("watchlist");
		expect(request).toHaveBeenCalledWith(
			"/sync/watchlist/all/rank/asc?page=1&limit=100",
			"fixture",
		);
	});
	it("rejects overlong notes before making any network writes", async () => {
		const request = vi.fn();
		const oversized = {
			...record,
			value: encodeList({
				name: "Weekend",
				description: "Films",
				items: [
					{
						mediaType: "movie",
						mediaId: "12",
						season: 0,
						episode: 0,
						notes: "x".repeat(501),
					},
				],
			}),
		};
		await expect(
			writeList({ request }, "fixture", oversized, false),
		).rejects.toThrow("500-character");
		expect(request).not.toHaveBeenCalled();
	});
	it("creates a private List and persists its remote identity before adding memberships", async () => {
		let created = false;
		let added = false;
		const onCreated = vi.fn(async () => {
			created = true;
		});
		const request = vi.fn(
			async (
				path: string,
				_token?: string,
				body?: unknown,
				method?: string,
			) => {
				if (path.startsWith("/search/"))
					return response([{ type: "movie", movie: movie.movie }]);
				if (path === "/users/me/lists" && body)
					return response({ ...metadata, item_count: 0 });
				if (path === "/users/me/lists") return response([metadata]);
				if (path.includes("?page="))
					return response(added ? [movie] : [], added ? 1 : 0);
				if (path.endsWith("/items") && body) {
					expect(created).toBe(true);
					added = true;
					return response({ added: { movies: 1 }, not_found: {} });
				}
				if (path.endsWith("/reorder"))
					return response({ updated: 1, skipped_ids: [] });
				if (method === "PUT") return response(null);
				throw new Error(`Unexpected fixture request: ${path}`);
			},
		);
		await writeList({ request }, "fixture", record, false, null, onCreated);
		expect(request).toHaveBeenCalledWith(
			"/users/me/lists",
			"fixture",
			expect.objectContaining({ privacy: "private" }),
		);
		expect(onCreated).toHaveBeenCalledWith(
			expect.objectContaining({ key: "list:22", traktId: 22 }),
		);
		expect(request).toHaveBeenCalledWith(
			"/users/me/lists/22",
			"fixture",
			{ name: "Weekend", description: "Films" },
			"PUT",
		);
	});
	it("refuses to overwrite a destination changed since reconciliation", async () => {
		const request = vi.fn(async (path: string, _token?: string) => {
			if (path.startsWith("/search/"))
				return response([{ type: "movie", movie: movie.movie }]);
			if (path.includes("?page=")) return response([movie], 1);
			return response({ ...metadata, name: "Edited elsewhere" });
		});
		await expect(
			writeList({ request }, "fixture", { ...record, traktId: 22 }, false, {
				...record,
				key: "list:22",
			}),
		).rejects.toThrow("changed before");
		expect(request.mock.calls.every((call) => call.length === 2)).toBe(true);
	});
});

it("preserves legacy scoped show identities when encoding Lists and pairing members", () => {
	const legacy = {
		mediaType: "show" as const,
		mediaId: "12:season:2:episode:3",
		season: 0,
		episode: 0,
		notes: "Preserve this note",
	};
	const value = JSON.parse(
		encodeList({ name: "Legacy", description: "", items: [legacy] }),
	);
	expect(value.items).toEqual([
		{ ...legacy, mediaType: "episode", mediaId: "12", season: 2, episode: 3 },
	]);
	expect(memberKey(legacy)).toBe("episode:12:2:3");
});

describe("Trakt Favorites transport", () => {
	const favorite = (items = listValue(record).items): SyncRecord => ({
		...record,
		kind: "favorites",
		key: "favorites:local",
		title: "Favorites",
		visibility: "public",
		value: encodeList({ name: "Favorites", description: "", items }),
	});
	it("reads Favorites separately from personal Lists and watchlist", async () => {
		const request = vi.fn(async (path: string, _token?: string) =>
			path === "/users/settings"
				? response({ user: { private: true } })
				: response([movie], 1),
		);
		const [result] = await snapshotLists({ request }, "fixture", {
			favorites: true,
		});
		expect(result).toMatchObject({
			kind: "favorites",
			key: "favorites:trakt",
			visibility: "private",
			value: favorite().value,
		});
		expect(request).toHaveBeenCalledWith(
			"/sync/favorites/all/rank/asc?page=1&limit=100",
			"fixture",
		);
		expect(request).not.toHaveBeenCalledWith("/users/me/lists", "fixture");
	});
	it("holds private outbound Favorites without publishing them", async () => {
		const request = vi.fn();
		await expect(
			writeList(
				{ request },
				"fixture",
				{ ...favorite(), visibility: "private" },
				false,
			),
		).rejects.toThrow("privacy behavior is verified");
		expect(request).not.toHaveBeenCalled();
	});
	it("preserves seasons and episodes rather than substituting parent shows", async () => {
		const request = vi.fn();
		await expect(
			writeList(
				{ request },
				"fixture",
				favorite([
					{
						mediaType: "episode",
						mediaId: "12",
						season: 1,
						episode: 2,
						notes: "",
					},
				]),
				false,
			),
		).rejects.toThrow("movies and shows only");
		expect(request).not.toHaveBeenCalled();
	});
	it("checks the account capacity before any writes or removals", async () => {
		const request = vi.fn(async (path: string, _token?: string) => {
			if (path.startsWith("/search/"))
				return response([{ type: "movie", movie: movie.movie }]);
			if (path === "/users/settings")
				return response({ limits: { favorites: { item_count: 0 } } });
			return response([], 0);
		});
		await expect(
			writeList({ request }, "fixture", favorite(), false),
		).rejects.toThrow("Favorites limit");
		expect(request.mock.calls.every((call) => call.length === 2)).toBe(true);
	});
	it("adds, updates notes and reorders Favorites through their dedicated endpoints", async () => {
		let rows: (typeof movie)[] = [];
		const request = vi.fn(
			async (
				path: string,
				_token?: string,
				body?: unknown,
				method?: string,
			) => {
				if (path.startsWith("/search/"))
					return response([{ type: "movie", movie: movie.movie }]);
				if (path === "/users/settings")
					return response({
						user: { private: false },
						limits: { favorites: { item_count: 100 } },
					});
				if (path.includes("?page=")) return response(rows, rows.length);
				if (path === "/sync/favorites" && body) {
					expect(body).toEqual({ movies: [{ ids: { trakt: 9 } }] });
					rows = [{ ...movie, notes: "" }];
					return response({ added: { movies: 1 }, not_found: {} });
				}
				if (path === "/sync/favorites/7" && method === "PUT") {
					rows = [movie];
					return response(null);
				}
				if (path === "/sync/favorites/reorder")
					return response({ updated: 1, skipped_ids: [] });
				throw new Error(`Unexpected request ${path}`);
			},
		);
		await writeList({ request }, "fixture", favorite(), false);
		expect(request).toHaveBeenCalledWith(
			"/sync/favorites/7",
			"fixture",
			{ notes: "A note" },
			"PUT",
		);
		expect(request).toHaveBeenCalledWith("/sync/favorites/reorder", "fixture", {
			rank: [7],
		});
	});
});
