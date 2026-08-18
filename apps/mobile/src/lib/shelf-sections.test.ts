import { describe, expect, it } from "vitest";
import { groupShelfSections } from "./shelf-sections";

const labelForDate = (date: string) => date.slice(0, 10);

describe("groupShelfSections", () => {
	it("keeps dated section order and collects interleaved undated Watches last", () => {
		const items = [
			{ id: "dated-1", watchedDate: "2026-08-18T12:00:00.000Z" },
			{ id: "undated-1" },
			{ id: "dated-2", watchedDate: "2026-08-17T12:00:00.000Z" },
			{ id: "undated-2" },
		];

		expect(groupShelfSections(items, labelForDate)).toEqual([
			{ label: "2026-08-18", items: [items[0]] },
			{ label: "2026-08-17", items: [items[2]] },
			{ label: "No date", items: [items[1], items[3]] },
		]);
	});

	it("returns one No date section when every Watch is undated", () => {
		const items = [
			{ id: "undated-1", watchedDate: undefined },
			{ id: "undated-2", watchedDate: undefined },
		];

		expect(groupShelfSections(items, labelForDate)).toEqual([
			{ label: "No date", items },
		]);
	});
});
