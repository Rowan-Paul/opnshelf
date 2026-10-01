import {
	choosePickerItem,
	initialPickerFilters,
	restorePickerFilters,
} from "@opnshelf/api";
import { afterEach, describe, expect, it, vi } from "vitest";

const items = ["a", "b", "c"].map((id) => ({
	id,
	mediaType: "movie" as const,
	mediaId: id,
	title: id,
	minutes: 90,
	estimated: false,
	episodes: [],
	services: [],
}));
afterEach(() => vi.restoreAllMocks());
describe("picker session choices", () => {
	it("gives each title one slot, without repeating skips", () => {
		vi.spyOn(Math, "random")
			.mockReturnValueOnce(0)
			.mockReturnValueOnce(0.5)
			.mockReturnValueOnce(0.99);
		expect(choosePickerItem(items, [])?.id).toBe("a");
		expect(choosePickerItem(items, [])?.id).toBe("b");
		expect(choosePickerItem(items, [])?.id).toBe("c");
		expect(choosePickerItem(items, ["a", "b"])?.id).toBe("c");
		expect(choosePickerItem(items, ["a", "b", "c"])).toBeUndefined();
	});
	it("restores cleared service filters without reapplying My Services", () => {
		const fallback = initialPickerFilters([8]);
		expect(
			restorePickerFilters(JSON.stringify(initialPickerFilters([])), fallback)
				.services,
		).toBeUndefined();
		expect(restorePickerFilters("broken", fallback)).toEqual(fallback);
		expect(
			restorePickerFilters(
				'{"type":"both","progress":"both","genre":"","services":"bad"}',
				fallback,
			),
		).toEqual(fallback);
	});
});
