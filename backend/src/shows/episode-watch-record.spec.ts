vi.mock("../lexicons/xyz/opnshelf/episode", () => ({
	main: {
		build: vi.fn((data: Record<string, unknown>) => ({
			$type: "xyz.opnshelf.episode",
			...data,
		})),
	},
	$nsid: "xyz.opnshelf.episode",
}));

import {
	buildEpisodeWatchRecord,
	eligibleEpisodes,
	resolveWatchedAt,
} from "./episode-watch-record";

describe("resolveWatchedAt", () => {
	it("defaults an omitted date to now", () => {
		const before = Date.now();
		const resolved = resolveWatchedAt(undefined);
		expect(resolved).toBeDefined();
		expect(new Date(resolved as string).getTime()).toBeGreaterThanOrEqual(
			before,
		);
	});

	it("keeps an undated Watch undated", () => {
		expect(resolveWatchedAt(null)).toBeUndefined();
	});

	it("normalizes an explicit date to ISO", () => {
		expect(resolveWatchedAt("2024-01-10")).toBe("2024-01-10T00:00:00.000Z");
	});
});

describe("eligibleEpisodes", () => {
	it("keeps only episodes that have already aired", () => {
		const season = {
			id: 1,
			name: "Season 1",
			season_number: 1,
			episodes: [
				{ id: 1, name: "Aired", episode_number: 1, air_date: "2020-01-01" },
				{ id: 2, name: "Undated", episode_number: 2 },
				{ id: 3, name: "Future", episode_number: 3, air_date: "2099-01-01" },
				{ id: 4, name: "Garbage", episode_number: 4, air_date: "not-a-date" },
			].map((episode) => ({ ...episode, season_number: 1 })),
		};

		expect(eligibleEpisodes(season).map((e) => e.episode_number)).toEqual([1]);
	});
});

describe("buildEpisodeWatchRecord", () => {
	it("reuses a deterministic rkey and dates the Watch", () => {
		const built = buildEpisodeWatchRecord(
			"123",
			1,
			2,
			"2024-01-10T00:00:00.000Z",
			"import-rkey",
		);

		expect(built.rkey).toBe("import-rkey");
		expect(built.collection).toBe("xyz.opnshelf.episode");
		expect(built.record).toMatchObject({
			showId: "123",
			seasonNumber: 1,
			episodeNumber: 2,
			source: "tmdb",
			watchedAt: "2024-01-10T00:00:00.000Z",
		});
	});

	it("mints a fresh rkey and omits watchedAt for an undated Watch", () => {
		const built = buildEpisodeWatchRecord("123", 1, 2, null);

		expect(built.rkey).toEqual(expect.any(String));
		expect(built.record).not.toHaveProperty("watchedAt");
		expect(built.record).toHaveProperty("createdAt");
	});
});
