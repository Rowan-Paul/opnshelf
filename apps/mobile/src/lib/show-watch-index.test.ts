import { describe, expect, it } from "vitest";
import { getShowWatchIndex } from "./show-watch-index";

describe("show Watch index", () => {
	it("shares work across rows and rebuilds after a history update", () => {
		const history = [
			{ seasonNumber: 1, episodeNumber: 1, watchedDate: null },
			{
				seasonNumber: 1,
				episodeNumber: 1,
				watchedDate: "2026-09-01T00:00:00.000Z",
			},
			{
				seasonNumber: 2,
				episodeNumber: 1,
				watchedDate: "2026-08-01T00:00:00.000Z",
			},
		];
		const index = getShowWatchIndex(history);
		expect(getShowWatchIndex(history)).toBe(index);
		expect(index.episodes.get("1-1")).toBe(2);
		expect(index.episodes.size).toBe(2);
		expect(index.latestWatchedDate).toBe("2026-09-01T00:00:00.000Z");
		const updated = getShowWatchIndex(history.slice(1));
		expect(updated.episodes.get("1-1")).toBe(1);
		expect(index.episodes.get("1-1")).toBe(2);
	});
});
