import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { PosterRowSkeleton } from "./skeletons";

vi.mock("react-native", () => ({ View: "View" }));

describe("PosterRowSkeleton", () => {
	it.each([
		80, 110, 112,
	])("fills the measured container after resizing with %i-wide posters", (width) => {
		let renderer!: ReactTestRenderer;
		act(() => {
			renderer = create(<PosterRowSkeleton width={width} />);
		});
		for (const containerWidth of [360, 808, 1200, 280]) {
			const row = renderer.root.findAllByType("View" as never)[0];
			act(() => {
				row.props.onLayout?.({
					nativeEvent: { layout: { width: containerWidth } },
				});
			});
			const cards = renderer.root.findAll(
				(node) => node.props.style?.width === width,
			);
			const coveredWidth = cards.length * (width + 12) - 12;
			expect(coveredWidth).toBeGreaterThanOrEqual(containerWidth);
			expect(coveredWidth - (width + 12)).toBeLessThan(containerWidth);
			for (const card of cards)
				expect(card.props.className).toContain("shrink-0");
		}
		act(() => renderer.unmount());
	});
});
