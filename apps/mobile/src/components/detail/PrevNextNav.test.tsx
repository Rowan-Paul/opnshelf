import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { PrevNextNav } from "./PrevNextNav";

vi.mock("react-native", async () => {
	const { createElement } = await import("react");
	return {
		View: (props: Record<string, unknown>) =>
			createElement("view", props, props.children as never),
	};
});
vi.mock("lucide-react-native", () => ({
	ChevronLeft: () => null,
	ChevronRight: () => null,
}));
vi.mock("@/theme/colors", () => ({
	useThemeColors: () => ({ mutedForeground: "muted" }),
}));
vi.mock("@/components/ui/button", async () => {
	const { createElement } = await import("react");
	return {
		Button: (props: Record<string, unknown>) => createElement("button", props),
	};
});

function render(element: React.ReactElement) {
	let renderer!: ReactTestRenderer;
	act(() => {
		renderer = create(element);
	});
	return renderer;
}

const buttons = (renderer: ReactTestRenderer) =>
	renderer.root.findAll((n) => n.type === "button");

describe("PrevNextNav", () => {
	it("labels both neighbours with their codes", () => {
		const onPrevious = vi.fn();
		const renderer = render(
			<PrevNextNav
				previous={{ label: "Previous season", code: "S1", onPress: onPrevious }}
				next={{ label: "Next season", code: "S3", onPress: vi.fn() }}
			/>,
		);
		const [previous, next] = buttons(renderer);
		expect(previous.props).toMatchObject({
			label: "Previous season",
			description: "S1",
		});
		expect(next.props).toMatchObject({
			label: "Next season",
			description: "S3",
		});
		act(() => previous.props.onPress());
		expect(onPrevious).toHaveBeenCalledOnce();
	});

	it("hides the side with no neighbour and keeps the other on its edge", () => {
		const renderer = render(
			<PrevNextNav
				next={{ label: "Next episode", code: "S1E2", onPress: vi.fn() }}
			/>,
		);
		expect(buttons(renderer)).toHaveLength(1);
		// An empty half holds the previous slot, so Next stays on the right.
		const row = renderer.toJSON() as {
			children: { type: string; props: Record<string, unknown> }[];
		};
		const [first, second] = row.children;
		expect(first.type).toBe("view");
		expect(first.props.className).toBe("flex-1");
		expect(second.type).toBe("button");
		expect(second.props.label).toBe("Next episode");
	});

	it("renders nothing without neighbours", () => {
		expect(render(<PrevNextNav />).toJSON()).toBeNull();
	});
});
