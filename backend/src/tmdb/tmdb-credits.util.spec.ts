import { describe, expect, it } from "vitest";
import { sortCrewByJob } from "./tmdb-credits.util";

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
// key-job crew, which any truncation would have dropped.
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

describe("sortCrewByJob", () => {
	it("puts the Director first", () => {
		const crew = sortCrewByJob(duneCrew, KEY_JOBS);

		expect(crew[0]).toMatchObject({
			name: "Denis Villeneuve",
			job: "Director",
		});
	});

	it("keeps everyone, non-key jobs included", () => {
		const crew = sortCrewByJob(duneCrew, KEY_JOBS);

		expect(crew).toHaveLength(duneCrew.length);
		expect(crew.at(-1)).toMatchObject({ name: "Some Gaffer" });
	});

	it("ranks by keyJobs order, so shows can put Creator first", () => {
		const crew = sortCrewByJob(
			[
				{ id: 1, name: "Michelle MacLaren", job: "Executive Producer" },
				{ id: 2, name: "Vince Gilligan", job: "Creator" },
			],
			["Creator", "Director", "Executive Producer"],
		);

		expect(crew[0].name).toBe("Vince Gilligan");
	});

	it("keeps TMDB's order within one job and survives missing crew", () => {
		const producers = sortCrewByJob(duneCrew, KEY_JOBS)
			.filter((m) => m.job === "Producer")
			.map((m) => m.name);

		expect(producers).toEqual([
			"Mary Parent",
			"Cale Boyter",
			"Tanya Lapointe",
			"Patrick McCormick",
			"Denis Villeneuve",
		]);
		expect(sortCrewByJob(undefined, KEY_JOBS)).toEqual([]);
	});

	it("does not mutate the input", () => {
		const input = [...duneCrew];
		sortCrewByJob(input, KEY_JOBS);

		expect(input[0]).toMatchObject({ name: "Mary Parent" });
	});
});
