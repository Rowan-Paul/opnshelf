import { describe, expect, it, vi } from "vitest";
import { snapshotContent, writeContent } from "./remote-content";
import { contentValue, encodeContent } from "./content-value";
import { candidates, mediaKey, type SyncRecord } from "./reconcile";
const movie = { title: "Fixture film", ids: { trakt: 9, tmdb: 12 } };
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
const record = (
	kind: "note" | "library" | "review",
	value = encodeContent({ content: "My words", format: "dvd" }),
): SyncRecord => ({
	kind,
	key: `${kind}:local`,
	mediaType: "movie",
	mediaId: "12",
	season: 0,
	episode: 0,
	title: "Fixture film",
	visibility: "private",
	value,
});

describe("Trakt content adapters", () => {
	it("reads private standalone Notes separately from List item notes", async () => {
		const request = vi.fn(async () =>
			response(
				[
					{
						id: 7,
						notes: "Private thoughts",
						privacy: "private",
						spoiler: false,
						item: { type: "movie", movie },
					},
				],
				1,
			),
		);
		const [note] = await snapshotContent({ request }, "fixture", {
			notes: true,
		});
		expect(note).toMatchObject({
			key: "note:7",
			kind: "note",
			mediaId: "12",
			visibility: "private",
		});
		expect(contentValue(note).content).toBe("Private thoughts");
		expect(request).toHaveBeenCalledWith(
			"/users/me/notes/all?page=1&limit=100",
			"fixture",
		);
	});
	it("retains person Notes and spoiler Notes as explicit problems", async () => {
		const request = vi.fn(async (path: string) =>
			path.includes("/item")
				? response({ type: "person", person: { ids: { trakt: 4 } } })
				: response(
						[
							{ id: 7, notes: "Personal", privacy: "private", spoiler: false },
							{
								id: 8,
								notes: "Plot detail",
								privacy: "public",
								spoiler: true,
								item: { type: "movie", movie },
							},
						],
						2,
					),
		);
		const notes = await snapshotContent({ request }, "fixture", {
			notes: true,
		});
		expect(notes).toHaveLength(2);
		expect(notes.every((r) => Boolean(r.problem))).toBe(true);
	});
	it("rejects incomplete pages before treating any content as removed", async () => {
		const request = vi.fn(async () => response([], 1));
		await expect(
			snapshotContent({ request }, "fixture", { notes: true }),
		).rejects.toThrow("incomplete");
	});
	it("keeps short comments visible without publishing them as Reviews and omits replies", async () => {
		const comment = {
			id: 1,
			comment: "[spoiler]This is a plot detail[/spoiler]",
			spoiler: false,
			review: true,
			parent_id: null,
		};
		const request = vi.fn(async () =>
			response(
				[
					{ type: "movie", movie, comment },
					{
						type: "movie",
						movie,
						comment: { ...comment, id: 2, review: false },
					},
					{
						type: "movie",
						movie,
						comment: { ...comment, id: 3, parent_id: 1 },
					},
				],
				3,
			),
		);
		const reviews = await snapshotContent({ request }, "fixture", {
			reviews: true,
		});
		expect(reviews).toHaveLength(2);
		expect(contentValue(reviews[0]).spoiler).toBe(true);
		expect(reviews[1].problem).toContain("short Trakt comment");
	});
	it("does not guess Digital ownership when collection format metadata is absent", async () => {
		const request = vi.fn(async (path: string) =>
			path === "/users/settings"
				? response({ user: { private: true } })
				: response(
						[{ type: "movie", movie, collected_at: "2026-01-01T12:00:00Z" }],
						1,
					),
		);
		const [item] = await snapshotContent({ request }, "fixture", {
			library: true,
		});
		expect(item.problem).toContain("No Digital format was assumed");
		expect(contentValue(item).format).toBe("");
	});
	it("preserves video/audio details as a problem rather than discarding them", async () => {
		const request = vi.fn(async (path: string) =>
			path === "/users/settings"
				? response({ user: { private: false } })
				: response(
						[
							{
								type: "movie",
								movie,
								collected_at: "2026-01-01T12:00:00Z",
								metadata: { media_type: "bluray", audio: "dts" },
							},
						],
						1,
					),
		);
		expect(
			(await snapshotContent({ request }, "fixture", { library: true }))[0]
				.problem,
		).toContain("video/audio metadata");
	});
	it("does not overwrite a destination-only owned format", async () => {
		const request = vi.fn(
			async (path: string, _token?: string, _body?: unknown) => {
				if (path === "/users/settings")
					return response({ user: { private: false } });
				if (path.startsWith("/search/"))
					return response([{ type: "movie", movie }]);
				return response(
					[
						{
							type: "movie",
							movie,
							collected_at: "2026-01-01T12:00:00Z",
							metadata: { media_type: "dvd" },
						},
					],
					1,
				);
			},
		);
		await expect(
			writeContent(
				{ request },
				"fixture",
				{
					...record("library", encodeContent({ format: "bluray" })),
					visibility: "public",
				},
				false,
			),
		).rejects.toThrow("destination collection");
		expect(request.mock.calls.every((call) => call.length === 2)).toBe(true);
	});
	it("does not conflate different owned formats or different Reviews", () => {
		expect(
			mediaKey(record("library", encodeContent({ format: "dvd" }))),
		).not.toBe(
			mediaKey(record("library", encodeContent({ format: "bluray" }))),
		);
		expect(
			candidates(record("review"), [
				record("review", encodeContent({ content: "A separate essay" })),
			]),
		).toEqual([]);
	});
	it("rejects short outbound Reviews without padding or writing them", async () => {
		const request = vi.fn(
			async (_path: string, _token?: string, _body?: unknown) =>
				response([], 0),
		);
		await expect(
			writeContent({ request }, "fixture", record("review"), false),
		).rejects.toThrow("200 words");
		expect(request.mock.calls.every((call) => call.length === 2)).toBe(true);
	});
	it("remembers a created private Note identity before confirmation and preserves its text", async () => {
		let notes: object[] = [];
		const remember = vi.fn();
		const request = vi.fn(
			async (path: string, _token?: string, body?: unknown) => {
				if (path.startsWith("/users/me/notes"))
					return response(notes, notes.length);
				if (path.startsWith("/search/"))
					return response([{ type: "movie", movie }]);
				if (path === "/notes") {
					expect(body).toMatchObject({
						notes: "My words",
						privacy: "private",
						item: { type: "movie", movie: { ids: { trakt: 9 } } },
					});
					notes = [
						{
							id: 7,
							notes: "My words",
							privacy: "private",
							spoiler: false,
							item: { type: "movie", movie },
						},
					];
					return response({ id: 7 });
				}
				throw new Error(`Unexpected request ${path}`);
			},
		);
		await writeContent(
			{ request },
			"fixture",
			record("note", encodeContent({ content: "My words" })),
			false,
			null,
			remember,
		);
		expect(remember).toHaveBeenCalledWith(
			expect.objectContaining({ key: "note:7", traktId: 7 }),
		);
	});
});
