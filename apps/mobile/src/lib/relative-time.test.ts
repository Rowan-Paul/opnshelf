import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./relative-time";

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const DAY = 24 * 60 * 60_000;

// Keep these cases in step with apps/web/src/lib/date-utils.test.ts — the two
// helpers must render the same instant identically on both clients.
describe("formatRelativeTime", () => {
	it("uses the largest fitting unit and pluralises", () => {
		expect(formatRelativeTime(ago(5 * 60_000))).toBe("5 minutes ago");
		expect(formatRelativeTime(ago(60 * 60_000))).toBe("1 hour ago");
		expect(formatRelativeTime(ago(3 * DAY))).toBe("3 days ago");
		expect(formatRelativeTime(ago(10 * DAY))).toBe("1 week ago");
	});

	it("rounds to the nearest unit rather than truncating", () => {
		// 48 days is nearer two months than one; truncating read "1 month ago"
		// on Mobile while Web said "2 months ago" for the same list.
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
