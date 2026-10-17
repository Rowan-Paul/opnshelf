import type { PropsWithChildren } from "react";
import { createElement, useState } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { expect, it, vi } from "vitest";
import { UpNextEpisodeGrid } from "./UpNextEpisodeGrid";

vi.mock("react-native", () => ({
	View: ({ children, ...props }: PropsWithChildren) =>
		createElement("View", props, children),
}));

function StatefulCard() {
	const [count, setCount] = useState(0);
	return createElement("Card", {
		testID: "stateful-card",
		count,
		onPress: () => setCount(count + 1),
	});
}

it("fits episode columns to available space and preserves card state while folding", () => {
	let view: ReactTestRenderer | undefined;
	act(() => {
		view = create(
			<UpNextEpisodeGrid>
				<StatefulCard key="one" />
				<StatefulCard key="two" />
				<StatefulCard key="three" />
			</UpNextEpisodeGrid>,
		);
	});
	if (!view) throw new Error("Grid did not render");
	const renderer = view;
	const grid = renderer.root.findByProps({ testID: "up-next-episode-grid" });
	const cards = () => renderer.root.findAllByProps({ testID: "stateful-card" });
	act(() => cards()[0].props.onPress());
	for (const [width, expectedWidth] of [
		[760, 374],
		[1100, 358.66],
		[390, "100%"],
	]) {
		act(() => grid.props.onLayout({ nativeEvent: { layout: { width } } }));
		const actualWidth = cards()[0].parent?.parent?.props.style.width;
		if (typeof expectedWidth === "number") {
			expect(actualWidth).toBeCloseTo(expectedWidth, 1);
		} else {
			expect(actualWidth).toBe(expectedWidth);
		}
		expect(cards()[0].props.count).toBe(1);
	}
	act(() => renderer.unmount());
});
