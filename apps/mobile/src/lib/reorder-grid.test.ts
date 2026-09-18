import { describe, expect, it } from "vitest";
import {
	dropIndex,
	type GridMetrics,
	slotFor,
	slotOffset,
} from "./reorder-grid";

// A 3-column grid of 120x220 cells: index 0 1 2 / 3 4 5 / 6 7 8.
const metrics: GridMetrics = { columns: 3, cellWidth: 120, cellHeight: 220 };
const count = 9;

describe("dropIndex", () => {
	it("stays put for a drag shorter than half a cell", () => {
		expect(dropIndex(4, 55, 100, count, metrics)).toBe(4);
	});

	it("follows the finger across columns and rows", () => {
		expect(dropIndex(4, 120, 0, count, metrics)).toBe(5);
		expect(dropIndex(4, -120, 0, count, metrics)).toBe(3);
		expect(dropIndex(4, 0, 220, count, metrics)).toBe(7);
		expect(dropIndex(4, 120, -220, count, metrics)).toBe(2);
	});

	it("slides along the edge instead of wrapping onto the next row", () => {
		// Dragging the middle of a row far left lands on that row's first cell,
		// not on the tail of the row above.
		expect(dropIndex(4, -600, 0, count, metrics)).toBe(3);
		expect(dropIndex(4, 600, 0, count, metrics)).toBe(5);
	});

	it("clamps to the ends of the list", () => {
		expect(dropIndex(4, 0, -2000, count, metrics)).toBe(0);
		expect(dropIndex(4, 0, 2000, count, metrics)).toBe(8);
	});

	it("holds still until the grid has been measured", () => {
		const unmeasured: GridMetrics = { columns: 3, cellWidth: 0, cellHeight: 0 };
		expect(dropIndex(4, 999, 999, count, unmeasured)).toBe(4);
	});
});

describe("slotFor", () => {
	it("leaves everything alone when nothing is being dragged", () => {
		expect(slotFor(5, -1, -1)).toBe(5);
	});

	it("keeps the dragged cell in its own slot", () => {
		expect(slotFor(2, 2, 7)).toBe(2);
	});

	it("shifts the span back when a cell moves later", () => {
		// 2 -> 5: cells 3,4,5 each move one slot earlier, 6 stays.
		expect(slotFor(3, 2, 5)).toBe(2);
		expect(slotFor(5, 2, 5)).toBe(4);
		expect(slotFor(6, 2, 5)).toBe(6);
	});

	it("shifts the span forward when a cell moves earlier", () => {
		// 6 -> 2: cells 2,3,4,5 each move one slot later, 1 stays.
		expect(slotFor(2, 6, 2)).toBe(3);
		expect(slotFor(5, 6, 2)).toBe(6);
		expect(slotFor(1, 6, 2)).toBe(1);
	});
});

describe("slotOffset", () => {
	it("is zero for a cell already in its own slot", () => {
		expect(slotOffset(4, 4, metrics)).toEqual({ x: 0, y: 0 });
	});

	it("measures a move within a row in cell widths", () => {
		expect(slotOffset(4, 3, metrics)).toEqual({ x: -120, y: 0 });
	});

	it("wraps a row boundary as one column back and one row down", () => {
		// Slot 2 (end of row 0) -> slot 3 (start of row 1).
		expect(slotOffset(2, 3, metrics)).toEqual({ x: -240, y: 220 });
	});
});
