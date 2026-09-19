import { describe, expect, it } from "vitest";
import {
	formatWatchDateTime,
	insertWatchEntry,
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

describe("insertWatchEntry", () => {
	type Entry = { watchedDate?: string | null };
	const dated = (watchedDate: string): Entry => ({ watchedDate });

	it("places a newer Watch above older ones", () => {
		const list = [
			dated("2026-05-01T00:00:00.000Z"),
			dated("2024-01-01T00:00:00.000Z"),
		];

		expect(insertWatchEntry(list, dated("2026-09-01T00:00:00.000Z"))).toEqual([
			dated("2026-09-01T00:00:00.000Z"),
			dated("2026-05-01T00:00:00.000Z"),
			dated("2024-01-01T00:00:00.000Z"),
		]);
	});

	it("slots a backdated Watch into place instead of jumping to the top", () => {
		// Logging a 2025 rewatch must not sit above a 2026 Watch until refetch.
		const list = [
			dated("2026-05-01T00:00:00.000Z"),
			dated("2024-01-01T00:00:00.000Z"),
		];

		expect(insertWatchEntry(list, dated("2025-03-01T00:00:00.000Z"))).toEqual([
			dated("2026-05-01T00:00:00.000Z"),
			dated("2025-03-01T00:00:00.000Z"),
			dated("2024-01-01T00:00:00.000Z"),
		]);
	});

	it("puts an undated Watch after every dated one", () => {
		const list: Entry[] = [dated("2026-05-01T00:00:00.000Z")];

		expect(insertWatchEntry(list, { watchedDate: undefined })).toEqual([
			dated("2026-05-01T00:00:00.000Z"),
			{ watchedDate: undefined },
		]);
	});

	it("keeps a dated Watch ahead of existing undated ones", () => {
		const list: Entry[] = [{ watchedDate: null }];

		expect(insertWatchEntry(list, dated("2024-01-01T00:00:00.000Z"))).toEqual([
			dated("2024-01-01T00:00:00.000Z"),
			{ watchedDate: null },
		]);
	});

	it("does not mutate the list it was given", () => {
		const list = [dated("2026-05-01T00:00:00.000Z")];
		insertWatchEntry(list, dated("2024-01-01T00:00:00.000Z"));

		expect(list).toHaveLength(1);
	});
});
