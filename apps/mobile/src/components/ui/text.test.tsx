import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { Text } from "./text";

vi.mock("react-native", async () => {
	const { createElement } = await import("react");
	return {
		Text: (props: Record<string, unknown>) =>
			createElement("text", props, props.children as never),
	};
});

function classNameOf(element: React.ReactElement): string {
	let renderer!: ReactTestRenderer;
	act(() => {
		renderer = create(element);
	});
	return renderer.root.findByType("text" as never).props.className;
}

describe("Text", () => {
	it("defaults to the Regular family", () => {
		expect(classNameOf(<Text className="text-sm">a</Text>).split(" ")).toEqual(
			expect.arrayContaining(["font-sans", "text-sm"]),
		);
	});

	it.each([
		["font-medium", "font-sans-medium"],
		["font-semibold", "font-sans-semibold"],
		["font-bold", "font-sans-bold"],
	])("swaps %s for the %s family", (weight, family) => {
		const classes = classNameOf(
			<Text className={`text-lg ${weight} text-primary`}>a</Text>,
		).split(" ");
		expect(classes).toContain(family);
		expect(classes).not.toContain(weight);
		expect(classes).not.toContain("font-sans");
		expect(classes).toEqual(
			expect.arrayContaining(["text-lg", "text-primary"]),
		);
	});

	it("leaves display families alone", () => {
		const classes = classNameOf(
			<Text className="font-display-bold">a</Text>,
		).split(" ");
		expect(classes).toContain("font-display-bold");
	});
});
