import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { EndReachedScrollView, useEndReached } from "./use-end-reached";

vi.mock("react-native", async () => {
	const { createElement } = await import("react");
	return {
		ScrollView: (props: Record<string, unknown>) =>
			createElement("scroll-view", props, props.children as never),
	};
});

function Subscriber({ onEnd }: { onEnd: () => void }) {
	useEndReached(onEnd);
	return null;
}

/** Drives the container as the native ScrollView would. */
function driver(renderer: ReactTestRenderer) {
	const view = () => renderer.root.findByType("scroll-view" as never);
	return {
		layout(height: number) {
			act(() => view().props.onLayout({ nativeEvent: { layout: { height } } }));
		},
		content(height: number) {
			act(() => view().props.onContentSizeChange(0, height));
		},
		scroll(y: number) {
			act(() =>
				view().props.onScroll({ nativeEvent: { contentOffset: { y } } }),
			);
		},
	};
}

describe("EndReachedScrollView", () => {
	it("fires once when the viewport nears the bottom and re-arms after scrolling away", () => {
		const onEnd = vi.fn();
		let renderer!: ReactTestRenderer;
		act(() => {
			renderer = create(
				<EndReachedScrollView>
					<Subscriber onEnd={onEnd} />
				</EndReachedScrollView>,
			);
		});
		const scroller = driver(renderer);
		scroller.layout(800);
		scroller.content(3000);
		expect(onEnd).not.toHaveBeenCalled();

		// 3000 - (1900 + 800) = 300 remaining, inside half a viewport.
		scroller.scroll(1900);
		expect(onEnd).toHaveBeenCalledTimes(1);
		scroller.scroll(1950);
		expect(onEnd).toHaveBeenCalledTimes(1);

		scroller.scroll(200);
		scroller.scroll(1900);
		expect(onEnd).toHaveBeenCalledTimes(2);
	});

	it("keeps loading while the content is shorter than the viewport", () => {
		const onEnd = vi.fn();
		let renderer!: ReactTestRenderer;
		act(() => {
			renderer = create(
				<EndReachedScrollView>
					<Subscriber onEnd={onEnd} />
				</EndReachedScrollView>,
			);
		});
		const scroller = driver(renderer);
		scroller.layout(800);
		// First page renders shorter than the screen: no scroll event will ever
		// come, so the size change must fire.
		scroller.content(300);
		expect(onEnd).toHaveBeenCalledTimes(1);

		// The appended page still does not fill the screen: fire again.
		scroller.content(600);
		expect(onEnd).toHaveBeenCalledTimes(2);

		// A repeat measurement at the same size (nothing appended, e.g. the
		// request is in flight or failed) does not fire again.
		scroller.content(600);
		expect(onEnd).toHaveBeenCalledTimes(2);
	});

	it("re-arms when a tall loading skeleton gives way to a shorter first page", () => {
		const onEnd = vi.fn();
		let renderer!: ReactTestRenderer;
		act(() => {
			renderer = create(
				<EndReachedScrollView>
					<Subscriber onEnd={onEnd} />
				</EndReachedScrollView>,
			);
		});
		const scroller = driver(renderer);
		scroller.layout(800);
		// Four skeleton rows while loading: fires once (the subscriber's guard
		// ignores it because nothing is loaded yet).
		scroller.content(400);
		expect(onEnd).toHaveBeenCalledTimes(1);
		// The real first page is one row, shorter than the skeleton. It must
		// still trigger a load or the list would be stuck on page one.
		scroller.content(120);
		expect(onEnd).toHaveBeenCalledTimes(2);
	});

	it("uses the latest callback and stops after unmount", () => {
		const first = vi.fn();
		const second = vi.fn();
		let renderer!: ReactTestRenderer;
		act(() => {
			renderer = create(
				<EndReachedScrollView>
					<Subscriber onEnd={first} />
				</EndReachedScrollView>,
			);
		});
		act(() =>
			renderer.update(
				<EndReachedScrollView>
					<Subscriber onEnd={second} />
				</EndReachedScrollView>,
			),
		);
		const scroller = driver(renderer);
		scroller.layout(800);
		scroller.content(300);
		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledTimes(1);

		act(() =>
			renderer.update(<EndReachedScrollView>{null}</EndReachedScrollView>),
		);
		scroller.content(900);
		expect(second).toHaveBeenCalledTimes(1);
	});
});

describe("EndReachedScrollView onEndReached prop", () => {
	it("notifies the owning screen alongside subscribers", () => {
		const fromProp = vi.fn();
		const fromHook = vi.fn();
		let renderer!: ReactTestRenderer;
		act(() => {
			renderer = create(
				<EndReachedScrollView onEndReached={fromProp}>
					<Subscriber onEnd={fromHook} />
				</EndReachedScrollView>,
			);
		});
		const scroller = driver(renderer);
		scroller.layout(800);
		scroller.content(300);
		expect(fromProp).toHaveBeenCalledTimes(1);
		expect(fromHook).toHaveBeenCalledTimes(1);
	});
});

describe("useEndReached", () => {
	it("is a no-op outside an EndReachedScrollView", () => {
		const onEnd = vi.fn();
		act(() => {
			create(<Subscriber onEnd={onEnd} />);
		});
		expect(onEnd).not.toHaveBeenCalled();
	});
});
