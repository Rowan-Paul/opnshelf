import { describe, expect, it } from "vitest";
import { pickKeyCrew } from "./tmdb-credits.util";

const KEY_JOBS = [
	"Director",
	"Producer",
	"Executive Producer",
	"Screenplay",
	"Writer",
	"Director of Photography",
	"Original Music Composer",
	"Composer",
];

// TMDB's real ordering for Dune: Part Two — Director sits at index 17 of the
// key-job crew, well past a naive slice(0, 10).
const duneCrew = [
	{ id: 1, name: "Mary Parent", job: "Producer" },
	{ id: 2, name: "Cale Boyter", job: "Producer" },
	{ id: 3, name: "Hans Zimmer", job: "Original Music Composer" },
	{ id: 4, name: "Greig Fraser", job: "Director of Photography" },
	{ id: 5, name: "Byron Merritt", job: "Executive Producer" },
	{ id: 6, name: "Jon Spaihts", job: "Executive Producer" },
	{ id: 7, name: "Brian Herbert", job: "Executive Producer" },
	{ id: 8, name: "Kim Herbert", job: "Executive Producer" },
	{ id: 9, name: "Herb Gains", job: "Executive Producer" },
	{ id: 10, name: "Joshua Grode", job: "Executive Producer" },
	{ id: 11, name: "Thomas Tull", job: "Executive Producer" },
	{ id: 12, name: "Denis Villeneuve", job: "Screenplay" },
	{ id: 13, name: "Tanya Lapointe", job: "Producer" },
	{ id: 14, name: "John Harrison", job: "Executive Producer" },
	{ id: 15, name: "Richard P. Rubinstein", job: "Executive Producer" },
	{ id: 16, name: "Patrick McCormick", job: "Producer" },
	{ id: 12, name: "Denis Villeneuve", job: "Director" },
	{ id: 6, name: "Jon Spaihts", job: "Screenplay" },
	{ id: 12, name: "Denis Villeneuve", job: "Producer" },
	{ id: 99, name: "Some Gaffer", job: "Gaffer" },
];

describe("pickKeyCrew", () => {
	it("keeps the Director first", () => {
		const crew = pickKeyCrew(duneCrew, KEY_JOBS);

		expect(crew[0]).toMatchObject({
			name: "Denis Villeneuve",
			job: "Director",
		});
	});

	it("credits each person once and caps people per job", () => {
		const crew = pickKeyCrew(duneCrew, KEY_JOBS);

		expect(crew.filter((m) => m.id === 12)).toHaveLength(1);
		for (const job of new Set(crew.map((m) => m.job))) {
			expect(crew.filter((m) => m.job === job).length).toBeLessThanOrEqual(2);
		}
	});

	it("drops non-key jobs and survives missing crew", () => {
		expect(pickKeyCrew(duneCrew, KEY_JOBS).map((m) => m.job)).not.toContain(
			"Gaffer",
		);
		expect(pickKeyCrew(undefined, KEY_JOBS)).toEqual([]);
	});
});
