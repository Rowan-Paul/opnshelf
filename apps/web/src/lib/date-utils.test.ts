import { describe, expect, it } from "vitest";
import { datetimeLocalToISO } from "./date-utils";

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
