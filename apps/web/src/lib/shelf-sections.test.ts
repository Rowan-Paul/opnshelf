import { describe, expect, it } from "vitest";
import { groupShelfItemsByDate, NO_DATE_SECTION_LABEL } from "./shelf-sections";

type TestShelfItem = {
	id: string;
	watchedDate?: string;
};

const labelDate = (date: string) => date.slice(0, 10);

describe("groupShelfItemsByDate", () => {
	it("creates one section for an all-undated shelf", () => {
		const items: TestShelfItem[] = [{ id: "one" }, { id: "two" }];

		expect(groupShelfItemsByDate(items, labelDate)).toEqual([
			{ label: NO_DATE_SECTION_LABEL, items },
		]);
	});

	it("keeps dated section order and moves interleaved undated items last", () => {
		const first = { id: "first", watchedDate: "2026-08-18T09:00:00Z" };
		const undatedOne: TestShelfItem = { id: "undated-one" };
		const older = { id: "older", watchedDate: "2026-08-17T09:00:00Z" };
		const undatedTwo: TestShelfItem = { id: "undated-two" };
		const firstAgain = {
			id: "first-again",
			watchedDate: "2026-08-18T12:00:00Z",
		};

		expect(
			groupShelfItemsByDate(
				[first, undatedOne, older, undatedTwo, firstAgain],
				labelDate,
			),
		).toEqual([
			{ label: "2026-08-18", items: [first, firstAgain] },
			{ label: "2026-08-17", items: [older] },
			{
				label: NO_DATE_SECTION_LABEL,
				items: [undatedOne, undatedTwo],
			},
		]);
	});
});
