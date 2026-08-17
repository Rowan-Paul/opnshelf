import { describe, expect, it } from "vitest";
import { formatWatchDateTime } from "./watch-date";

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
