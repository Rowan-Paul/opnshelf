import { describe, expect, it } from "vitest";
import {
	formatWatchDateTime,
	latestWatchDate,
	optimisticWatchDate,
} from "./watch-date";

describe("formatWatchDateTime", () => {
	it("includes both the date and time without a dangling at separator", () => {
		expect(
			formatWatchDateTime("2026-08-17T14:05:00.000Z", {
				locale: "en-US",
				timeZone: "UTC",
				hour12: false,
			}),
		).toBe("Aug 17, 2026 · 14:05");
	});

	it("returns undefined for missing or invalid timestamps", () => {
		expect(formatWatchDateTime()).toBeUndefined();
		expect(formatWatchDateTime("not-a-date")).toBeUndefined();
	});
});

describe("optimisticWatchDate", () => {
	const now = "2026-08-18T12:00:00.000Z";

	it("keeps an explicit null Watch undated", () => {
		expect(optimisticWatchDate(null, now)).toBeUndefined();
	});

	it("uses now only when watchedAt is omitted", () => {
		expect(optimisticWatchDate(undefined, now)).toBe(now);
		expect(optimisticWatchDate("2020-01-01T00:00:00.000Z", now)).toBe(
			"2020-01-01T00:00:00.000Z",
		);
	});

	it("finds the latest dated Watch without crashing on undated Watches", () => {
		expect(
			latestWatchDate([
				{},
				{ watchedDate: "2026-08-17T12:00:00.000Z" },
				{},
				{ watchedDate: "2026-08-18T12:00:00.000Z" },
			]),
		).toBe("2026-08-18T12:00:00.000Z");
		expect(latestWatchDate([{}, {}])).toBeUndefined();
	});
});
