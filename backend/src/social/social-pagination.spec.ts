import {
	clampPage,
	clampPageSize,
	getPaginationMeta,
	paginateItems,
} from "./social-pagination";

describe("social pagination", () => {
	it("clamps pages and page sizes to their bounds", () => {
		expect(clampPage(0)).toBe(1);
		expect(clampPage(4)).toBe(4);
		expect(clampPageSize(0, 50)).toBe(1);
		expect(clampPageSize(500, 50)).toBe(50);
	});

	it("reports page 1 with no pages for an empty result", () => {
		expect(getPaginationMeta(0, 3, 10)).toEqual({
			page: 1,
			pageSize: 10,
			total: 0,
			totalPages: 0,
			hasNextPage: false,
			hasPreviousPage: false,
		});
	});

	it("snaps a page past the end to the last page", () => {
		expect(getPaginationMeta(3, 9, 2)).toEqual({
			page: 2,
			pageSize: 2,
			total: 3,
			totalPages: 2,
			hasNextPage: false,
			hasPreviousPage: true,
		});
	});

	it("slices items for the resolved page", () => {
		expect(paginateItems(["a", "b", "c"], 2, 2)).toEqual({
			items: ["c"],
			page: 2,
			pageSize: 2,
			total: 3,
			totalPages: 2,
			hasNextPage: false,
			hasPreviousPage: true,
		});
	});
});
