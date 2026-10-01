import { describe, expect, it } from "vitest";
import { buildWatchRecap } from "./watch-recap";
import { notificationEmail, watchRecap } from "./notification-content";

const movie = {
	mediaId: "42",
	mediaType: "movie" as const,
	title: "A <Movie>",
	posterPath: null,
	watchedDate: new Date("2026-09-06T20:04:00Z"),
};
const episode = {
	mediaId: "24",
	mediaType: "show" as const,
	title: "A Show",
	posterPath: "/show.jpg",
	seasonNumber: 2,
	episodeNumber: 4,
	watchedDate: new Date("2026-09-26T17:24:00Z"),
};
describe("Watch recaps", () => {
	it("counts rewatches, ignores undated Watches and ranks ties by the latest Watch", () => {
		const result = buildWatchRecap(
			[
				episode,
				movie,
				movie,
				{ ...movie, watchedDate: null },
				{
					...episode,
					mediaId: "25",
					title: "Later",
					watchedDate: new Date("2026-09-27T00:00:00Z"),
				},
			],
			"Europe/Amsterdam",
		);
		expect(result.recap).toMatchObject({
			movieWatches: 2,
			episodeWatches: 2,
			firstWatch: { title: "A <Movie>" },
			lastWatch: { path: "/shows/25/later/seasons/2/episodes/4" },
		});
		expect(result.items.map((i) => [i.mediaId, i.watchCount])).toEqual([
			["25", 1],
			["24", 1],
			["42", 2],
		]);
	});
	it("renders the same saved highlights and counts in both email formats", () => {
		const { recap, items } = buildWatchRecap(
			[movie, episode],
			"Europe/Amsterdam",
		);
		const result = notificationEmail({
			title: "September",
			body: "Your highlights",
			url: "/discover/collections/saved",
			baseUrl: "https://opnshelf.xyz",
			collection: {
				heading: "Your September 2026 in review",
				periodStart: "2026-09-01",
				periodEnd: "2026-09-30",
				recap: {
					...recap,
					firstWatch: recap.firstWatch ? { ...recap.firstWatch } : null,
					lastWatch: recap.lastWatch ? { ...recap.lastWatch } : null,
				},
				items: items.map((i) => ({ ...i })),
			},
		});
		for (const content of [result.html, result.text]) {
			expect(content).toContain("See your recap");
			expect(content).toContain("First Watch");
			expect(content).toContain("Last Watch");
			expect(content).toContain("1 episode Watch");
			expect(content).toContain(
				"https://opnshelf.xyz/shows/24/a-show/seasons/2/episodes/4",
			);
			expect(content).not.toContain("Release date unavailable");
		}
		expect(result.html).toContain("A &lt;Movie&gt;");
		expect(result.html).toContain("19:24");
	});
	it("keeps an empty recap useful and rejects unsafe saved highlights", () => {
		const { recap, items } = buildWatchRecap([], "invalid");
		expect(recap).toEqual({
			movieWatches: 0,
			episodeWatches: 0,
			timezone: "UTC",
			firstWatch: null,
			lastWatch: null,
		});
		expect(items).toEqual([]);
		expect(() =>
			watchRecap({
				...recap,
				lastWatch: null,
				firstWatch: {
					title: "bad",
					path: "//evil.test",
					watchedAt: "2026-09-01T00:00:00Z",
				},
			}),
		).toThrow();
	});
});
