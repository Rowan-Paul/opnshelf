import { describe, expect, it } from "vitest";
import {
	rankMovieMatchCandidates,
	rankShowMatchCandidates,
} from "./match-candidates";

const movies = Object.freeze(
	Array.from({ length: 12 }, (_, id) => ({
		id,
		title: `Movie ${id}`,
		release_date: id % 2 === 0 ? "2020-01-01" : "2021-01-01",
		popularity: 0,
		vote_average: 0,
		vote_count: 0,
	})),
);
const shows = Object.freeze(
	movies.map(({ title, release_date, ...movie }) => ({
		...movie,
		name: title,
		first_air_date: release_date,
	})),
);

describe("Integration match ranking", () => {
	it("prioritizes same-year titles stably without mutating TMDB results", () => {
		const expected = [1, 3, 5, 7, 9, 11, 0, 2, 4, 6].map(String);
		expect(rankMovieMatchCandidates(movies, 2021).map((m) => m.tmdbId)).toEqual(
			expected,
		);
		expect(rankShowMatchCandidates(shows, 2021).map((s) => s.tmdbId)).toEqual(
			expected,
		);
	});

	it("keeps TMDB order and the ten-result cap without a source year", () => {
		const expected = movies.slice(0, 10).map((m) => String(m.id));
		expect(rankMovieMatchCandidates(movies, null).map((m) => m.tmdbId)).toEqual(
			expected,
		);
		expect(rankShowMatchCandidates(shows, null).map((s) => s.tmdbId)).toEqual(
			expected,
		);
	});
});
