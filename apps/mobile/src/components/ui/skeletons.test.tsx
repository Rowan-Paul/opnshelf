import {
	act,
	create,
	type ReactTestInstance,
	type ReactTestRenderer,
} from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { ActivityCardsSkeleton, PosterRowSkeleton } from "./skeletons";

vi.mock("@/lib/use-wide-layout", () => ({
	useWideLayout: () => false,
	usePaneWidth: () => 0,
}));
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

describe("ActivityCardsSkeleton", () => {
	it("draws a header row above the poster row for each card", () => {
		let renderer!: ReactTestRenderer;
		act(() => {
			renderer = create(<ActivityCardsSkeleton rows={2} />);
		});
		const cards = renderer.root.findAll(
			(node) => node.props.testID === "activity-card-skeleton",
		);
		expect(cards).toHaveLength(2);
		const [header, body] = cards[0].children as ReactTestInstance[];
		// Avatar, two text lines, then the Movie/TV pill.
		expect(
			header.findAll((node) => node.props.className?.includes("rounded-full")),
		).toHaveLength(2);
		expect(body.children[0]).toMatchObject({
			props: { className: expect.stringContaining("h-32 w-20") },
		});
		act(() => renderer.unmount());
	});
});
