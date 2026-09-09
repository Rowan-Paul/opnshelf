import {
	type FollowedActivityRow,
	parseScopedShowMediaId,
	toFollowedActivityItem,
	toFollowedWatcherItem,
} from "./activity-feed.mapping";

describe("parseScopedShowMediaId", () => {
	it("parses bare show, season and episode scopes", () => {
		expect(parseScopedShowMediaId("show-1")).toEqual({ showId: "show-1" });
		expect(parseScopedShowMediaId("show-1:season:2")).toEqual({
			showId: "show-1",
			seasonNumber: 2,
		});
		expect(parseScopedShowMediaId("show-1:season:2:episode:4")).toEqual({
			showId: "show-1",
			seasonNumber: 2,
			episodeNumber: 4,
		});
	});

	it("treats malformed scopes as a bare show id", () => {
		expect(parseScopedShowMediaId("show-1:season:x")).toEqual({
			showId: "show-1:season:x",
		});
	});
});

describe("toFollowedActivityItem", () => {
	const baseRow: FollowedActivityRow = {
		actorDid: "did:plc:friend",
		id: "movie:1",
		type: "movie",
		activityAt: new Date("2026-03-02T12:00:00.000Z"),
		watchedDate: new Date("2026-03-02T12:00:00.000Z"),
		createdAt: new Date("2026-03-02T11:00:00.000Z"),
		movieId: "movie-1",
		title: "Past Lives",
		showId: null,
		showTitle: null,
		seasonNumber: null,
		episodeNumber: null,
		episodeName: null,
		episodeOverview: null,
		stillPath: null,
		posterPath: null,
		backdropPath: null,
		releaseYear: 2023,
		firstAirYear: null,
		overview: null,
		rating: null,
		reviewContent: null,
		reviewSpoiler: null,
		reviewId: null,
	};
	const colorMap = {
		movies: new Map<string, unknown>([["movie-1", { primary: "#111111" }]]),
		shows: new Map<string, unknown>([["show-1", { primary: "#333333" }]]),
	};

	it("falls back to a did-only actor when the user row is missing", () => {
		const item = toFollowedActivityItem(baseRow, null, colorMap);

		expect(item.actor).toEqual({
			did: "did:plc:friend",
			handle: "did:plc:friend",
			displayName: null,
			avatar: null,
			followersCount: 0,
			followingCount: 0,
		});
		expect(item).toMatchObject({
			id: "movie:1",
			type: "movie",
			activityAt: "2026-03-02T12:00:00.000Z",
			watchedDate: "2026-03-02T12:00:00.000Z",
			createdAt: "2026-03-02T11:00:00.000Z",
			movieId: "movie-1",
			title: "Past Lives",
			releaseYear: 2023,
			colors: { primary: "#111111" },
		});
		expect(item.showId).toBeUndefined();
		expect(item.rating).toBeUndefined();
	});

	it("picks show colors for episode and review rows and leaves them unset for unknown media", () => {
		const episode = toFollowedActivityItem(
			{
				...baseRow,
				id: "episode:1",
				type: "episode",
				movieId: null,
				showId: "show-1",
			},
			null,
			colorMap,
		);
		expect(episode.colors).toEqual({ primary: "#333333" });

		const review = toFollowedActivityItem(
			{
				...baseRow,
				id: "review:1",
				type: "review",
				movieId: null,
				showId: "show-unknown",
				watchedDate: null,
				rating: 8,
				reviewContent: "Great",
				reviewSpoiler: false,
				reviewId: "review-1",
			},
			null,
			colorMap,
		);
		expect(review.colors).toBeUndefined();
		expect(review.watchedDate).toBeUndefined();
		expect(review).toMatchObject({
			rating: 8,
			reviewContent: "Great",
			reviewSpoiler: false,
			reviewId: "review-1",
		});
	});
});

describe("toFollowedWatcherItem", () => {
	it("uses the actor when present and a did-only placeholder otherwise", () => {
		const row = {
			actorDid: "did:plc:friend",
			activityAt: new Date("2026-03-03T12:00:00.000Z"),
			createdAt: new Date("2026-03-03T12:00:00.000Z"),
		};
		const actor = {
			did: "did:plc:friend",
			handle: "friend",
			displayName: "Friend",
			avatar: null,
		};

		expect(toFollowedWatcherItem(row, actor)).toEqual({
			actor,
			activityAt: "2026-03-03T12:00:00.000Z",
		});
		expect(toFollowedWatcherItem(row, null).actor).toEqual({
			did: "did:plc:friend",
			handle: "did:plc:friend",
			displayName: null,
			avatar: null,
		});
	});
});
