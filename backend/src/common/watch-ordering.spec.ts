import { describe, expect, it } from "vitest";
import { watchDateOrderBy } from "./watch-ordering";

describe("watchDateOrderBy", () => {
	it("puts undated Watches last when sorting newest first", () => {
		expect(watchDateOrderBy()).toEqual([
			{ watchedDate: { sort: "desc", nulls: "last" } },
			{ createdAt: "desc" },
		]);
	});

	it("puts undated Watches last when sorting oldest first too", () => {
		// The rule is "after every dated Watch", not "at the end of a descending
		// list" — flipping direction must not float undated Watches to the top.
		expect(watchDateOrderBy("asc")).toEqual([
			{ watchedDate: { sort: "asc", nulls: "last" } },
			{ createdAt: "desc" },
		]);
	});

	it("returns a fresh array so callers can append tie-breakers", () => {
		const first = watchDateOrderBy();
		const second = watchDateOrderBy();

		expect(first).not.toBe(second);

		const withTieBreakers = [...first, { seasonNumber: "desc" as const }];
		expect(first).toHaveLength(2);
		expect(withTieBreakers).toHaveLength(3);
	});
});
