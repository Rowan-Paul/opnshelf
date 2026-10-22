import { createScenarioServer, sample } from "./ui-scenarios.mjs";
import { readFileSync } from "node:fs";
import { webOrigin, apiOrigin } from "./lighthouse-pages.cjs";

const spec = JSON.parse(
	readFileSync(new URL("../backend/openapi.json", import.meta.url)),
);
const schema = (name) => sample(spec.components.schemas[name]);
const did = "did:plc:bbbbbbbbbbbbbbbbbbbbbbbb";
const poster = "/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg";
const backdrop = "/2u7zbn8EudG6kLlBzUYqP8RyFU4.jpg";
const date = "2026-10-15T12:00:00.000Z";
const paginate = (items) => ({
	items,
	total: items.length,
	page: 1,
	pageSize: 20,
	totalPages: 1,
	hasNextPage: false,
	hasPreviousPage: false,
});
const shelf = Array.from({ length: 12 }, (_, i) => ({
	id: `movie:${i + 1}`,
	type: "movie",
	movieId: String(i + 1),
	title: `Fixture film ${i + 1}`,
	posterPath: poster,
	backdropPath: backdrop,
	releaseYear: 2025,
	overview: "A synthetic film for repeatable signed-in audits.",
	watchCount: 1,
	watchedDate: date,
	createdAt: date,
}));
const upNext = Array.from({ length: 6 }, (_, i) => ({
	showId: String(1399 + i),
	totalEpisodes: 20,
	episodesWatched: 5,
	latestWatchedDate: date,
	lastWatched: { seasonNumber: 1, episodeNumber: 5 },
	nextEpisode: {
		seasonNumber: 1,
		episodeNumber: 6,
		name: `The next chapter ${i + 1}`,
		airDate: "2020-01-01",
		overview: "The story continues with a new discovery.",
	},
	show: {
		showId: String(1399 + i),
		title: `Local fixture show ${i + 1}`,
		posterPath: poster,
		backdropPath: backdrop,
	},
}));
const progress = upNext.map((item) => ({
	showId: item.showId,
	state: "partial",
	hasWatches: true,
	episodesWatched: 5,
	episodesTotal: 20,
	remainingEpisodes: 15,
	percentage: 25,
	seasons: [
		{
			seasonNumber: 1,
			state: "partial",
			episodesWatched: 5,
			episodesTotal: 20,
			remainingEpisodes: 15,
			percentage: 25,
		},
	],
}));
const search = [
	...shelf.map((item) => ({
		id: Number(item.movieId),
		media_type: "movie",
		title: item.title,
		release_date: "2025-01-01",
		poster_path: poster,
		popularity: 10,
		vote_average: 7,
		vote_count: 100,
	})),
	...upNext.map((item) => ({
		id: Number(item.showId),
		media_type: "tv",
		name: item.show.title,
		first_air_date: "2020-01-01",
		poster_path: poster,
		popularity: 10,
		vote_average: 8,
		vote_count: 100,
	})),
];

export function createLighthouseServer() {
	const errors = [];
	const responses = new Map([
		[`/users/${did}/shelf`, paginate(shelf)],
		[
			`/users/${did}/shelf/sync-status`,
			{ isSyncing: false, trackedMovieCount: 12, trackedEpisodeCount: 30 },
		],
		[
			"/users/synthetic.test/profile",
			{
				...schema("PublicUserProfileDto"),
				did,
				handle: "synthetic.test",
				displayName: "Local scenario",
				watchesPublic: true,
				watchedThisYear: 42,
				reviewsCount: 3,
				activityLast30Days: Array.from({ length: 30 }, (_, i) => ({
					date: new Date(Date.now() - (29 - i) * 86400000)
						.toISOString()
						.slice(0, 10),
					count: i % 4,
				})),
			},
		],
		[`/shows/user/${did}/up-next`, paginate(upNext)],
		[
			`/shows/user/${did}/release-calendar`,
			{
				items: upNext.map((item) => ({
					source: "watching",
					mediaType: "show",
					releaseKind: "episode",
					releaseDate: new Date(Date.now() + 86400000)
						.toISOString()
						.slice(0, 10),
					title: item.show.title,
					showId: item.showId,
					seasonNumber: 1,
					episodeNumber: 6,
					posterPath: poster,
				})),
				total: 6,
			},
		],
		[
			"/social/feed",
			paginate(
				shelf.slice(0, 4).map((item) => ({
					...item,
					actor: {
						did: "did:plc:friend",
						handle: "friend.test",
						displayName: "Fixture friend",
						avatar: null,
					},
					activityAt: date,
				})),
			),
		],
		["/shows/progress", { items: progress }],
		["/search/all", paginate(search)],
		["/social/search", paginate([])],
		[
			"/streaming-services",
			{ country: "NL", services: [{ id: 8, name: "Netflix", logoPath: null }] },
		],
		[
			"/shows/tmdb/1399",
			{
				id: 1399,
				name: "Local fixture show",
				first_air_date: "2020-01-01",
				poster_path: poster,
				backdrop_path: backdrop,
				overview:
					"A synthetic show with personal progress for repeatable Lighthouse audits.",
				genres: [{ id: 18, name: "Drama" }],
				vote_average: 8,
				number_of_seasons: 1,
				number_of_episodes: 20,
				seasons: [
					{
						id: 1,
						season_number: 1,
						name: "Season 1",
						episode_count: 20,
						poster_path: poster,
					},
				],
				credits: { cast: [], crew: [], cast_total: 0, crew_total: 0 },
			},
		],
		[
			"/shows/tmdb/1399/recommendations",
			{
				...schema("SearchShowsResultsDto"),
				items: search.filter((item) => item.media_type === "tv"),
			},
		],
		[
			"/shows/tmdb/1399/watch-providers",
			{ ...schema("WatchProvidersResponseDto"), results: {} },
		],
		["/ratings/media", { averageRating: 8, ratingCount: 4 }],
		[
			"/ratings/batch",
			{
				items: search.map((item) => ({
					mediaId: String(item.id),
					averageRating: 8,
					ratingCount: 4,
				})),
			},
		],
		[`/ratings/user/${did}`, null],
		[`/notes/user/${did}`, null],
		["/library/for-item/show/1399", []],
		["/lists/for-item/show/1399", []],
		["/lists/items/memberships", []],
		[`/lists/user/${did}`, []],
		["/lists", []],
		["/reviews/media", { ...schema("MediaReviewsResponseDto"), items: [] }],
		["/social/watchers", { items: [] }],
		["/users/me/release-notes", { readThrough: "2099-01-01T00:00:00.000Z" }],
		[
			`/movies/user/${did}/watch-counts`,
			shelf.map((item) => ({ movieId: item.movieId, watchCount: 1 })),
		],
		...upNext.map((item) => [
			`/shows/user/${did}/show/${item.showId}/history`,
			Array.from({ length: 5 }, (_, i) => ({
				id: `episode:${item.showId}:${i + 1}`,
				watchedDate: date,
				seasonNumber: 1,
				episodeNumber: i + 1,
			})),
		]),
		["/at-store-review/prompt", { eligible: false, permissionGranted: false }],
		["/featured", { items: [] }],
	]);
	// These shared scenario responses intentionally represent absent optional state.
	const shared = new Set([
		"/auth/me",
		"/users/me/settings",
		"/users/me/account-deletion",
		"/trakt-sync",
		"/notifications/settings",
	]);
	const server = createScenarioServer("issue-fixes", {
		webOrigin,
		respond({ req, url, json }) {
			const path = decodeURIComponent(url.pathname);
			if (path === "/__health") {
				json({ errors });
				return true;
			}
			if (req.method !== "GET") {
				errors.push(`${req.method} ${path}`);
				json({ message: "Unexpected fixture write" }, 405);
				return true;
			}
			// Public SSR data reads have no API cookie; browser session checks must have one.
			if (
				path === "/auth/me" &&
				!req.headers.cookie
					?.split(";")
					.some(
						(pair) =>
							pair.trim() === "opnshelf_session=lighthouse-fixture-only",
					)
			) {
				json({ message: "Fixture session required" }, 401);
				return true;
			}
			if (responses.has(path)) {
				json(responses.get(path));
				return true;
			}
			if (shared.has(path)) return false;
			errors.push(`${req.method} ${path}`);
			json({ message: `Missing Lighthouse fixture: ${path}` }, 404);
			return true;
		},
	});
	return { server, errors };
}

export { apiOrigin };
