import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./relative-time";

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

describe("formatRelativeTime", () => {
	it("uses the largest fitting unit and pluralises", () => {
		expect(formatRelativeTime(ago(5 * 60_000))).toBe("5 minutes ago");
		expect(formatRelativeTime(ago(60 * 60_000))).toBe("1 hour ago");
		expect(formatRelativeTime(ago(3 * 24 * 60 * 60_000))).toBe("3 days ago");
	});

	it("collapses anything under a minute, including a clock ahead of ours", () => {
		expect(formatRelativeTime(ago(10_000))).toBe("just now");
		expect(formatRelativeTime(ago(-60_000))).toBe("just now");
	});

	it("returns empty for an unparseable value", () => {
		expect(formatRelativeTime("not a date")).toBe("");
	});
});
