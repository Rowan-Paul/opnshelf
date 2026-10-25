import {
	followedActivityFeedQuery,
	followedActivityGroupCountQuery,
	movieWatchersQuery,
	showWatchersQuery,
} from "./activity-feed.sql";

describe("activity feed SQL", () => {
	it("binds every followed did, the offset and the limit as parameters", () => {
		const query = followedActivityFeedQuery(["did:plc:a", "did:plc:b"], 20, 10);

		// The DID list appears in all three UNION branches, then OFFSET/LIMIT.
		expect(query.values).toEqual([
			"did:plc:a",
			"did:plc:b",
			"did:plc:a",
			"did:plc:b",
			"did:plc:a",
			"did:plc:b",
			20,
			10,
		]);
		const text = query.strings.join(" ");
		expect(text).not.toContain("did:plc:a");
		expect(text).toContain('tm."watchedDate" IS NOT NULL');
		expect(text).toContain('te."watchedDate" IS NOT NULL');
		expect(text).toContain('r.markdown AS "reviewContent"');
		expect(text).toContain("UNION ALL");
	});

	it("paginates whole daily bundles and binds the viewer timezone", () => {
		const query = followedActivityFeedQuery(
			["did:plc:a"],
			1,
			1,
			"America/New_York",
		);
		const sql = query.strings.join(" ");
		expect(query.values).toContain("America/New_York");
		expect(sql).toContain(`AT TIME ZONE 'UTC' AT TIME ZONE`);
		expect(sql).toContain(`activity.type = 'episode'`);
		expect(sql).toContain('INNER JOIN page USING ("groupId")');
		expect(sql.indexOf("OFFSET")).toBeLessThan(sql.indexOf("SELECT keyed.*"));
		const count = followedActivityGroupCountQuery(
			["did:plc:a"],
			"America/New_York",
		);
		expect(count.strings.join(" ")).toContain("COUNT(DISTINCT");
		expect(count.values).toContain("America/New_York");
	});

	it("binds the movie id for movie watchers", () => {
		const query = movieWatchersQuery(["did:plc:a"], "movie-1");

		expect(query.values).toEqual(["did:plc:a", "movie-1"]);
		expect(query.strings.join(" ")).toContain('tm."movieId" = ');
	});

	it("adds season and episode conditions only when scoped", () => {
		const show = showWatchersQuery(["did:plc:a"], { showId: "show-1" });
		expect(show.values).toEqual(["did:plc:a", "show-1"]);
		expect(show.strings.join(" ")).not.toContain('te."seasonNumber" = ');

		const season = showWatchersQuery(["did:plc:a"], {
			showId: "show-1",
			seasonNumber: 2,
		});
		expect(season.values).toEqual(["did:plc:a", "show-1", 2]);
		const seasonText = season.strings.join(" ");
		expect(seasonText).toContain('te."seasonNumber" = ');
		expect(seasonText).not.toContain('te."episodeNumber" = ');

		const episode = showWatchersQuery(["did:plc:a"], {
			showId: "show-1",
			seasonNumber: 2,
			episodeNumber: 4,
		});
		expect(episode.values).toEqual(["did:plc:a", "show-1", 2, 4]);
		expect(episode.strings.join(" ")).toContain('te."episodeNumber" = ');
	});
});
