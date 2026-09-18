/**
 * Geometry for dragging a poster around the list reorder grid.
 *
 * The array is never touched mid-drag: the finger offset only decides which
 * index the dragged poster would land on, and every other poster slides into
 * the slot that move would leave it in. Keeping the arithmetic here, out of the
 * gesture, means it can be tested without a touch.
 *
 * All of it runs on the UI thread from `useAnimatedStyle`, hence the worklet
 * directives.
 */

/** Fixed cell size of the grid the drag is measured against. */
export type GridMetrics = {
	columns: number;
	cellWidth: number;
	cellHeight: number;
};

function clamp(value: number, min: number, max: number): number {
	"worklet";
	return Math.min(Math.max(value, min), max);
}

/**
 * Index a poster dragged from `index` lands on after moving by (dx, dy).
 *
 * Columns clamp so dragging off the left or right edge slides along that edge
 * rather than wrapping onto the neighbouring row, which is what a wrapping
 * column would silently do to the order.
 */
export function dropIndex(
	index: number,
	dx: number,
	dy: number,
	count: number,
	metrics: GridMetrics,
): number {
	"worklet";
	if (metrics.cellWidth <= 0 || metrics.cellHeight <= 0) return index;
	const column = index % metrics.columns;
	const row = Math.floor(index / metrics.columns);
	const targetColumn = clamp(
		column + Math.round(dx / metrics.cellWidth),
		0,
		metrics.columns - 1,
	);
	const targetRow = row + Math.round(dy / metrics.cellHeight);
	return clamp(targetRow * metrics.columns + targetColumn, 0, count - 1);
}

/**
 * Slot a poster sits in while the one from `from` hovers over `to`. Everything
 * between the two shifts by one, opening the gap the drop will fill.
 */
export function slotFor(index: number, from: number, to: number): number {
	"worklet";
	if (from === -1 || from === to || index === from) return index;
	if (from < to && index > from && index <= to) return index - 1;
	if (from > to && index >= to && index < from) return index + 1;
	return index;
}

/** How far a poster travels from its own slot to the one it currently occupies. */
export function slotOffset(
	index: number,
	slot: number,
	metrics: GridMetrics,
): { x: number; y: number } {
	"worklet";
	return {
		x:
			((slot % metrics.columns) - (index % metrics.columns)) *
			metrics.cellWidth,
		y:
			(Math.floor(slot / metrics.columns) -
				Math.floor(index / metrics.columns)) *
			metrics.cellHeight,
	};
}
