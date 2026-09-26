import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { RatingSheet } from "./RatingSheet";
import { StarRating } from "./StarRating";

vi.mock("react-native", async () => {
	const { createElement } = await import("react");
	const component = (name: string) => (props: Record<string, unknown>) =>
		createElement(name, props, props.children as never);
	return {
		View: component("view"),
		Pressable: component("pressable"),
		Modal: component("modal"),
	};
});
vi.mock("lucide-react-native", () => ({ StarOff: "star-off", X: "close" }));
vi.mock("react-native-svg", () => ({ default: "svg", Path: "path" }));
vi.mock("@/components/ui/text", () => ({ Text: "text" }));

function render(rating: number, onChange?: (value: number) => void) {
	let renderer!: ReactTestRenderer;
	act(() => {
		renderer = create(
			<StarRating rating={rating} onChange={onChange} size={14} />,
		);
	});
	return renderer;
}

describe("StarRating scale", () => {
	it.each([1, 5, 8, 10])("displays and announces %s out of 10", (rating) => {
		const renderer = render(rating);
		expect(
			renderer.root.findByProps({ accessibilityRole: "image" }).props
				.accessibilityLabel,
		).toBe(`Rating: ${rating} out of 10`);
		expect(JSON.stringify(renderer.toJSON())).toContain(`${rating}/10`);
	});
	it("keeps all ten half-star choices on the stored scale", () => {
		const onChange = vi.fn();
		const renderer = render(8, onChange);
		const choices = renderer.root.findAllByType("pressable" as never);
		expect(choices).toHaveLength(10);
		choices.forEach((choice, index) => {
			expect(choice.props.accessibilityLabel).toBe(
				`Rate ${index + 1} out of 10`,
			);
			act(() => choice.props.onPress());
			expect(onChange).toHaveBeenLastCalledWith(index + 1);
		});
	});
});

it("shows the same score in the rating sheet and keeps clearing separate", () => {
	let renderer!: ReactTestRenderer;
	const onChange = vi.fn();
	const onClear = vi.fn();
	const onDismiss = vi.fn();
	act(() => {
		renderer = create(
			<RatingSheet
				visible
				rating={9}
				onChange={onChange}
				onClear={onClear}
				onDismiss={onDismiss}
			/>,
		);
	});
	const text = renderer.root
		.findAllByType("text" as never)
		.flatMap((node) => node.children)
		.join("");
	expect(text).toContain("9 /10");
	const choices = renderer.root.findAllByType("pressable" as never);
	act(() =>
		choices
			.find((node) => node.props.accessibilityLabel === "Rate 1 out of 10")
			?.props.onPress(),
	);
	expect(onChange).toHaveBeenCalledWith(1);
	act(() =>
		choices
			.find((node) =>
				node
					.findAllByType("text" as never)
					.some((text) => text.children.includes("Clear rating")),
			)
			?.props.onPress(),
	);
	expect(onClear).toHaveBeenCalledOnce();
	expect(onDismiss).toHaveBeenCalledOnce();
});
