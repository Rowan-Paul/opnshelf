import { expectTypeOf } from "vitest";
import {
	clampPage,
	clampPageSize,
	fromTmdbPage,
	getPaginationMeta,
	paginateItems,
	parsePage,
	type PaginatedResult,
} from "./pagination";

describe("pagination", () => {
	it("preserves item types without a mapper and infers mapped item types", () => {
		const page = {
			results: [{ id: 1 }],
			page: 1,
			total_results: 1,
			total_pages: 1,
		};
		const unchanged = fromTmdbPage(page, undefined, 40);
		const mapped = fromTmdbPage(page, (item) => item.id);

		expectTypeOf(unchanged).toEqualTypeOf<PaginatedResult<{ id: number }>>();
		expectTypeOf(mapped).toEqualTypeOf<PaginatedResult<number>>();
		expect(unchanged.items).toEqual(page.results);
		expect(unchanged.items).not.toBe(page.results);
		expect(unchanged.pageSize).toBe(40);
		expect(mapped.items).toEqual([1]);

		// A different output type requires a mapper, even with explicit generics.
		// @ts-expect-error A number result cannot be claimed without mapping the items.
		fromTmdbPage<{ id: number }, number>(page);
	});

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

	it("parses raw page query values with a floor of one", () => {
		expect(parsePage("3")).toBe(3);
		expect(parsePage("2.9")).toBe(2);
		expect(parsePage(undefined)).toBe(1);
		expect(parsePage("0")).toBe(1);
		expect(parsePage("abc")).toBe(1);
		expect(parsePage("Infinity")).toBe(1);
		expect(parsePage("-Infinity")).toBe(1);
	});

	it("re-expresses a TMDB page in the shared contract", () => {
		expect(
			fromTmdbPage(
				{
					results: [{ id: 1 }, { id: 2 }],
					page: 2,
					total_results: 45,
					total_pages: 3,
				},
				(item) => item.id,
			),
		).toEqual({
			items: [1, 2],
			page: 2,
			pageSize: 20,
			total: 45,
			totalPages: 3,
			hasNextPage: true,
			hasPreviousPage: true,
		});
		expect(
			fromTmdbPage({ results: [], page: 1, total_results: 0, total_pages: 0 }),
		).toMatchObject({ hasNextPage: false, hasPreviousPage: false });
	});
});
