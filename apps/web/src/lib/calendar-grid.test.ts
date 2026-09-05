import type { ReleaseCalendarItemDto } from "@opnshelf/api";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	formatLocalDateKey,
	formatMonthDateKey,
	formatReleaseDate,
	formatWeekDayLabel,
	formatWeekRange,
	getCalendarDateRange,
	getDisplayTitle,
	getMonthGrid,
	getReleaseType,
	getReleaseUrl,
	getWeekDays,
	getWeekReleases,
	getWeekStart,
	isDateInWeek,
	isSameDay,
	MONTH_NAMES,
	shiftWeek,
	transformReleasesToDateMap,
	WEEKDAY_LABELS,
} from "./calendar-grid";

// Node re-reads TZ on assignment, so each block below pins the browser zone the
// grid maths runs in. Amsterdam has DST transitions (2026-03-29, 2026-10-25);
// the assertions that mention them only hold in that zone.
const originalTZ = process.env.TZ;

function inZone(tz: string) {
	beforeEach(() => {
		process.env.TZ = tz;
	});
	afterEach(() => {
		if (originalTZ === undefined) delete process.env.TZ;
		else process.env.TZ = originalTZ;
	});
}

function release(
	overrides: Partial<ReleaseCalendarItemDto> & { releaseDate: string },
): ReleaseCalendarItemDto {
	return {
		source: "watching",
		mediaType: "show",
		releaseKind: "episode",
		title: "Untitled",
		...overrides,
	};
}

describe("transformReleasesToDateMap", () => {
	it("returns an empty map for no items", () => {
		expect(transformReleasesToDateMap([])).toEqual({});
	});

	it("buckets by the ISO date part and keeps arrival order within a day", () => {
		const first = release({
			releaseDate: "2026-09-10T00:00:00.000Z",
			title: "A",
		});
		const second = release({
			releaseDate: "2026-09-10T23:59:00.000Z",
			title: "B",
		});
		const other = release({ releaseDate: "2026-09-11", title: "C" });

		expect(transformReleasesToDateMap([first, other, second])).toEqual({
			"2026-09-10": [first, second],
			"2026-09-11": [other],
		});
	});
});

describe("getWeekStart", () => {
	inZone("Europe/Amsterdam");

	it("keeps a Monday and zeroes the time", () => {
		const monday = new Date(2026, 8, 7, 15, 30, 12, 500);
		expect(getWeekStart(monday)).toEqual(new Date(2026, 8, 7));
	});

	it("moves a Sunday back to the previous Monday, not forward", () => {
		expect(getWeekStart(new Date(2026, 8, 13, 9))).toEqual(
			new Date(2026, 8, 7),
		);
	});

	it("crosses a month boundary", () => {
		// Wed 2026-09-02 belongs to the week starting Mon 2026-08-31
		expect(getWeekStart(new Date(2026, 8, 2))).toEqual(new Date(2026, 7, 31));
	});

	it("crosses a year boundary", () => {
		// Fri 2027-01-01 belongs to the week starting Mon 2026-12-28
		expect(getWeekStart(new Date(2027, 0, 1))).toEqual(new Date(2026, 11, 28));
	});

	it("stays at local midnight across the spring-forward transition", () => {
		// Sun 2026-03-29 is the DST start day; its Monday is 03-23 at 00:00 CET
		const weekStart = getWeekStart(new Date(2026, 2, 29, 12));
		expect(formatLocalDateKey(weekStart)).toBe("2026-03-23");
		expect(weekStart.getHours()).toBe(0);
	});

	it("does not mutate its input", () => {
		const input = new Date(2026, 8, 13);
		const snapshot = input.getTime();
		getWeekStart(input);
		expect(input.getTime()).toBe(snapshot);
	});
});

describe("shiftWeek", () => {
	inZone("Europe/Amsterdam");

	it("moves forward and back by whole weeks at local midnight", () => {
		const monday = new Date(2026, 2, 23);
		expect(formatLocalDateKey(shiftWeek(monday, 1))).toBe("2026-03-30");
		expect(shiftWeek(monday, 1).getHours()).toBe(0);
		expect(formatLocalDateKey(shiftWeek(monday, -1))).toBe("2026-03-16");
	});

	it("crosses the DST end into winter time without drifting a day", () => {
		// Week of Mon 2026-10-19 contains the fall-back Sunday 10-25
		const next = shiftWeek(new Date(2026, 9, 19), 1);
		expect(formatLocalDateKey(next)).toBe("2026-10-26");
		expect(next.getHours()).toBe(0);
	});
});

describe("date keys", () => {
	it("zero-pads month and day", () => {
		expect(formatMonthDateKey(2026, 0, 5)).toBe("2026-01-05");
		expect(formatMonthDateKey(2026, 11, 31)).toBe("2026-12-31");
	});

	it("formats a Date from its local components", () => {
		expect(formatLocalDateKey(new Date(2026, 8, 7, 23, 59))).toBe("2026-09-07");
	});

	it("isSameDay ignores the time of day", () => {
		expect(isSameDay(new Date(2026, 8, 7, 1), new Date(2026, 8, 7, 23))).toBe(
			true,
		);
		expect(isSameDay(new Date(2026, 8, 7), new Date(2026, 8, 8))).toBe(false);
	});
});

describe("getMonthGrid", () => {
	inZone("UTC");

	it("pads a month that starts on a Sunday with six leading cells", () => {
		// February 2026 starts on a Sunday and has 28 days
		expect(getMonthGrid(new Date(2026, 1, 15))).toEqual({
			daysInMonth: 28,
			leadingEmptyCells: 6,
			trailingEmptyCells: 1,
		});
	});

	it("needs no padding for a 28-day month that starts on a Monday", () => {
		// February 2027 is exactly four Monday-first weeks
		expect(getMonthGrid(new Date(2027, 1, 1))).toEqual({
			daysInMonth: 28,
			leadingEmptyCells: 0,
			trailingEmptyCells: 0,
		});
	});

	it("fills the last row to seven cells", () => {
		// June 2026 starts on a Monday, 30 days -> 2 in the last row
		expect(getMonthGrid(new Date(2026, 5, 10))).toEqual({
			daysInMonth: 30,
			leadingEmptyCells: 0,
			trailingEmptyCells: 5,
		});
	});

	it("handles a leap-year February", () => {
		expect(getMonthGrid(new Date(2028, 1, 1)).daysInMonth).toBe(29);
	});

	it("always yields a whole number of rows", () => {
		for (let month = 0; month < 12; month++) {
			const grid = getMonthGrid(new Date(2026, month, 1));
			const cells =
				grid.leadingEmptyCells + grid.daysInMonth + grid.trailingEmptyCells;
			expect(cells % 7).toBe(0);
		}
	});
});

describe("getCalendarDateRange", () => {
	inZone("UTC");

	it("spans the first of the previous month to the last of the next", () => {
		expect(getCalendarDateRange(new Date(2026, 2, 15))).toEqual({
			startDate: "2026-02-01",
			endDate: "2026-04-30",
		});
	});

	it("wraps across the year in both directions", () => {
		expect(getCalendarDateRange(new Date(2026, 0, 20))).toEqual({
			startDate: "2025-12-01",
			endDate: "2026-02-28",
		});
		expect(getCalendarDateRange(new Date(2026, 11, 1))).toEqual({
			startDate: "2026-11-01",
			endDate: "2027-01-31",
		});
	});
});

describe("isDateInWeek", () => {
	inZone("Europe/Amsterdam");

	const weekStart = new Date(2026, 8, 7);

	it("is false without a selected week", () => {
		expect(isDateInWeek(new Date(2026, 8, 7), null)).toBe(false);
	});

	it("includes Monday through Sunday and nothing outside", () => {
		expect(isDateInWeek(new Date(2026, 8, 7), weekStart)).toBe(true);
		expect(isDateInWeek(new Date(2026, 8, 13, 22), weekStart)).toBe(true);
		expect(isDateInWeek(new Date(2026, 8, 6), weekStart)).toBe(false);
		expect(isDateInWeek(new Date(2026, 8, 14), weekStart)).toBe(false);
	});
});

describe("getDisplayTitle / getReleaseType / getReleaseUrl", () => {
	it("prefixes episodes with SxE", () => {
		expect(
			getDisplayTitle(
				release({
					releaseDate: "2026-09-10",
					title: "Pilot",
					seasonNumber: 2,
					episodeNumber: 5,
				}),
			),
		).toBe("2x5 Pilot");
	});

	it("falls back to a season prefix without an episode number", () => {
		expect(
			getDisplayTitle(
				release({
					releaseDate: "2026-09-10",
					title: "Finale",
					seasonNumber: 3,
				}),
			),
		).toBe("S3 Finale");
	});

	it("leaves movies, whole-show releases, and season-less episodes alone", () => {
		expect(
			getDisplayTitle(
				release({
					releaseDate: "2026-09-10",
					mediaType: "movie",
					releaseKind: "movie",
					title: "Dune",
					seasonNumber: 1,
					episodeNumber: 1,
				}),
			),
		).toBe("Dune");
		expect(
			getDisplayTitle(
				release({
					releaseDate: "2026-09-10",
					releaseKind: "show",
					title: "Severance",
					seasonNumber: 1,
				}),
			),
		).toBe("Severance");
		expect(
			getDisplayTitle(release({ releaseDate: "2026-09-10", title: "Loose" })),
		).toBe("Loose");
	});

	it("reports the media type as the release type", () => {
		expect(
			getReleaseType(
				release({ releaseDate: "2026-09-10", mediaType: "movie" }),
			),
		).toBe("movie");
		expect(getReleaseType(release({ releaseDate: "2026-09-10" }))).toBe("show");
	});

	it("links movies, episodes, and shows to their detail pages", () => {
		expect(
			getReleaseUrl(
				release({
					releaseDate: "2026-09-10",
					mediaType: "movie",
					releaseKind: "movie",
					movieId: "42",
					title: "Dune: Part Three",
				}),
			),
		).toBe("/movies/42/dune-part-three");
		expect(
			getReleaseUrl(
				release({
					releaseDate: "2026-09-10",
					showId: "7",
					title: "Severance",
					seasonNumber: 3,
					episodeNumber: 1,
				}),
			),
		).toBe("/shows/7/severance/seasons/3/episodes/1");
		expect(
			getReleaseUrl(
				release({
					releaseDate: "2026-09-10",
					releaseKind: "show",
					showId: "7",
					title: "Severance",
				}),
			),
		).toBe("/shows/7/severance");
	});

	it("falls back to the show page when an episode lacks its numbers", () => {
		expect(
			getReleaseUrl(
				release({
					releaseDate: "2026-09-10",
					showId: "7",
					title: "Severance",
					seasonNumber: 3,
				}),
			),
		).toBe("/shows/7/severance");
	});

	it("returns a dead link when the id is missing", () => {
		expect(
			getReleaseUrl(
				release({
					releaseDate: "2026-09-10",
					mediaType: "movie",
					releaseKind: "movie",
					title: "Dune",
				}),
			),
		).toBe("#");
		expect(getReleaseUrl(release({ releaseDate: "2026-09-10" }))).toBe("#");
	});
});

describe("getWeekReleases", () => {
	inZone("Europe/Amsterdam");

	it("returns nothing without a selected week", () => {
		expect(
			getWeekReleases(null, {
				"2026-09-07": [release({ releaseDate: "2026-09-07" })],
			}),
		).toEqual([]);
	});

	it("flattens the week in day order, tagging each release with its day key", () => {
		const monday = release({ releaseDate: "2026-09-07", title: "Mon" });
		const sundayA = release({ releaseDate: "2026-09-13", title: "Sun A" });
		const sundayB = release({ releaseDate: "2026-09-13", title: "Sun B" });
		const outside = release({ releaseDate: "2026-09-14", title: "Next Mon" });
		const releases = transformReleasesToDateMap([
			sundayA,
			outside,
			monday,
			sundayB,
		]);

		expect(getWeekReleases(new Date(2026, 8, 7), releases)).toEqual([
			{ ...monday, date: "2026-09-07" },
			{ ...sundayA, date: "2026-09-13" },
			{ ...sundayB, date: "2026-09-13" },
		]);
	});

	it("covers all seven days when the week spans a month and a DST change", () => {
		// Week of Mon 2026-03-23 ends on the spring-forward Sunday 03-29
		const releases = transformReleasesToDateMap(
			["23", "24", "25", "26", "27", "28", "29"].map((d) =>
				release({ releaseDate: `2026-03-${d}`, title: d }),
			),
		);
		expect(
			getWeekReleases(new Date(2026, 2, 23), releases).map((r) => r.date),
		).toEqual([
			"2026-03-23",
			"2026-03-24",
			"2026-03-25",
			"2026-03-26",
			"2026-03-27",
			"2026-03-28",
			"2026-03-29",
		]);

		// Week of Mon 2026-08-31 runs into September
		const spill = transformReleasesToDateMap([
			release({ releaseDate: "2026-08-31" }),
			release({ releaseDate: "2026-09-06" }),
		]);
		expect(
			getWeekReleases(new Date(2026, 7, 31), spill).map((r) => r.date),
		).toEqual(["2026-08-31", "2026-09-06"]);
	});
});

describe("getWeekDays", () => {
	inZone("Europe/Amsterdam");

	it("returns nothing without a selected week", () => {
		expect(getWeekDays(null, {})).toEqual([]);
	});

	it("lists seven consecutive local days with their releases and today flag", () => {
		const item = release({ releaseDate: "2026-10-22" });
		const days = getWeekDays(
			new Date(2026, 9, 19),
			{ "2026-10-22": [item] },
			new Date(2026, 9, 25, 18),
		);

		expect(days.map((d) => d.dateKey)).toEqual([
			"2026-10-19",
			"2026-10-20",
			"2026-10-21",
			"2026-10-22",
			"2026-10-23",
			"2026-10-24",
			"2026-10-25",
		]);
		expect(days.map((d) => d.releases)).toEqual([
			[],
			[],
			[],
			[item],
			[],
			[],
			[],
		]);
		expect(days.map((d) => d.isToday)).toEqual([
			false,
			false,
			false,
			false,
			false,
			false,
			true,
		]);
		// Every day keeps local midnight even across the fall-back Sunday.
		expect(days.every((d) => d.date.getHours() === 0)).toBe(true);
	});

	it("marks no day when today is outside the week", () => {
		const days = getWeekDays(new Date(2026, 8, 7), {}, new Date(2026, 8, 20));
		expect(days.some((d) => d.isToday)).toBe(false);
	});
});

describe("formatting", () => {
	inZone("Europe/Amsterdam");

	it("formats the week range from Monday to Sunday", () => {
		expect(formatWeekRange(new Date(2026, 8, 7))).toBe("Sep 7 - Sep 13");
		expect(formatWeekRange(new Date(2026, 7, 31))).toBe("Aug 31 - Sep 6");
	});

	it("formats an empty range without a selected week", () => {
		expect(formatWeekRange(null)).toBe("");
	});

	it("labels today and other days", () => {
		const today = new Date(2026, 8, 7, 12);
		expect(formatWeekDayLabel(new Date(2026, 8, 7), undefined, today)).toBe(
			"Today",
		);
		expect(formatWeekDayLabel(new Date(2026, 8, 8), undefined, today)).toBe(
			"Tue, Sep 8",
		);
	});

	it("formats a day key as a short date", () => {
		expect(formatReleaseDate("2026-09-07", "Europe/Amsterdam")).toBe("Sep 7");
	});

	it("exposes Monday-first weekday labels and twelve month names", () => {
		expect(WEEKDAY_LABELS[0]).toBe("Mon");
		expect(WEEKDAY_LABELS[6]).toBe("Sun");
		expect(MONTH_NAMES).toHaveLength(12);
		expect(MONTH_NAMES[new Date(2026, 8, 1).getMonth()]).toBe("September");
	});
});
