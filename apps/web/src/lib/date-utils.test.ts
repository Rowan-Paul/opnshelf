import { describe, expect, it } from "vitest";
import { datetimeLocalToISO, formatRelativeTime } from "./date-utils";

describe("datetimeLocalToISO", () => {
	it("converts Amsterdam summer time (CEST, +2) to UTC", () => {
		expect(datetimeLocalToISO("2026-07-04T20:15", "Europe/Amsterdam")).toBe(
			"2026-07-04T18:15:00.000Z",
		);
	});

	it("converts Amsterdam winter time (CET, +1) to UTC", () => {
		expect(datetimeLocalToISO("2026-01-15T20:15", "Europe/Amsterdam")).toBe(
			"2026-01-15T19:15:00.000Z",
		);
	});

	it("handles a wall clock just after the spring-forward transition", () => {
		// DST starts 2026-03-29 02:00 CET -> 03:00 CEST
		expect(datetimeLocalToISO("2026-03-29T03:30", "Europe/Amsterdam")).toBe(
			"2026-03-29T01:30:00.000Z",
		);
	});

	it("is a no-op for UTC", () => {
		expect(datetimeLocalToISO("2026-07-04T20:15", "UTC")).toBe(
			"2026-07-04T20:15:00.000Z",
		);
	});

	it("handles a negative-offset zone", () => {
		expect(datetimeLocalToISO("2026-07-04T20:15", "America/New_York")).toBe(
			"2026-07-05T00:15:00.000Z",
		);
	});
});

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const DAY = 24 * 60 * 60_000;

// Keep these cases in step with apps/mobile/src/lib/relative-time.test.ts —
// the two helpers must render the same instant identically on both clients.
describe("formatRelativeTime", () => {
	it("uses the largest fitting unit and pluralises", () => {
		expect(formatRelativeTime(ago(5 * 60_000))).toBe("5 minutes ago");
		expect(formatRelativeTime(ago(60 * 60_000))).toBe("1 hour ago");
		expect(formatRelativeTime(ago(3 * DAY))).toBe("3 days ago");
		expect(formatRelativeTime(ago(10 * DAY))).toBe("1 week ago");
	});

	it("rounds to the nearest unit rather than truncating", () => {
		expect(formatRelativeTime(ago(48 * DAY))).toBe("2 months ago");
		expect(formatRelativeTime(ago(40 * DAY))).toBe("1 month ago");
	});

	it("collapses anything under a minute, including a clock ahead of ours", () => {
		expect(formatRelativeTime(ago(10_000))).toBe("just now");
		expect(formatRelativeTime(ago(-60_000))).toBe("just now");
	});

	it("returns empty for a missing or unparseable value", () => {
		expect(formatRelativeTime("not a date")).toBe("");
		expect(formatRelativeTime("")).toBe("");
	});
});
