import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { PrevNextNav } from "./PrevNextNav";

vi.mock("react-native", async () => {
	const { createElement } = await import("react");
	return {
		View: (props: Record<string, unknown>) =>
			createElement("view", props, props.children as never),
		Pressable: (props: Record<string, unknown>) =>
			createElement("button", props, props.children as never),
	};
});
vi.mock("lucide-react-native", () => ({
	ChevronLeft: () => null,
	ChevronRight: () => null,
}));
vi.mock("@/theme/colors", () => ({
	useThemeColors: () => ({ mutedForeground: "muted" }),
}));
vi.mock("@/components/ui/text", async () => {
	const { createElement } = await import("react");
	return {
		Text: (props: Record<string, unknown>) =>
			createElement("text", props, props.children as never),
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
const codes = (renderer: ReactTestRenderer) =>
	renderer.root.findAll((n) => n.type === "text").map((n) => n.props.children);

describe("PrevNextNav", () => {
	it("labels both neighbours and shows their codes", () => {
		const onPrevious = vi.fn();
		const renderer = render(
			<PrevNextNav
				previous={{ label: "Previous season", code: "S1", onPress: onPrevious }}
				next={{ label: "Next season", code: "S3", onPress: vi.fn() }}
			/>,
		);
		const [previous, next] = buttons(renderer);
		expect(previous.props.accessibilityLabel).toBe("Previous season, S1");
		expect(next.props.accessibilityLabel).toBe("Next season, S3");
		expect(codes(renderer)).toEqual(["S1", "S3"]);
		act(() => previous.props.onPress());
		expect(onPrevious).toHaveBeenCalledOnce();
	});

	it("leaves out the side with no neighbour", () => {
		const renderer = render(
			<PrevNextNav
				next={{ label: "Next episode", code: "S1E2", onPress: vi.fn() }}
			/>,
		);
		expect(buttons(renderer)).toHaveLength(1);
		expect(codes(renderer)).toEqual(["S1E2"]);
	});

	it("renders nothing without neighbours", () => {
		expect(render(<PrevNextNav />).toJSON()).toBeNull();
	});
});
