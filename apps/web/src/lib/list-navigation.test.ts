import { describe, expect, it } from "vitest";
import { nextIndex } from "./list-navigation";

describe("nextIndex", () => {
	it("enters the list from nothing highlighted", () => {
		expect(nextIndex(-1, 3, 1)).toBe(0);
		expect(nextIndex(-1, 3, -1)).toBe(2);
	});

	it("steps through the list", () => {
		expect(nextIndex(0, 3, 1)).toBe(1);
		expect(nextIndex(2, 3, -1)).toBe(1);
	});

	it("wraps at both ends", () => {
		expect(nextIndex(2, 3, 1)).toBe(0);
		expect(nextIndex(0, 3, -1)).toBe(2);
	});

	it("highlights nothing in an empty list", () => {
		expect(nextIndex(-1, 0, 1)).toBe(-1);
		expect(nextIndex(1, 0, -1)).toBe(-1);
	});
});
