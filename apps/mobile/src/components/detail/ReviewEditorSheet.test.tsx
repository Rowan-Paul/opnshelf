import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewEditorSheet } from "./ReviewEditorSheet";

vi.mock("@tanstack/react-query", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-query")>()),
	useQuery: () => ({ data: undefined }),
}));

vi.mock("@/lib/auth-context", () => ({
	useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock("@/lib/use-tw-style", () => ({ useTwStyle: () => ({}) }));

vi.mock("react-native-keyboard-controller", async () => {
	const { createElement } = await import("react");
	const passthrough = (props: Record<string, unknown>) =>
		createElement("keyboard-view", props, props.children as never);
	return { KeyboardAvoidingView: passthrough, KeyboardProvider: passthrough };
});

vi.mock("react-native", async () => {
	const { createElement } = await import("react");
	const component = (name: string) => (props: Record<string, unknown>) =>
		createElement(name, props, props.children as never);
	return {
		Modal: component("modal"),
		Pressable: component("pressable"),
		Switch: component("switch"),
		View: component("view"),
	};
});

vi.mock("lucide-react-native", async () => {
	const { createElement } = await import("react");
	return {
		StarOff: () => createElement("star-off"),
		Trash2: () => createElement("trash"),
		X: () => createElement("close"),
	};
});

vi.mock("@/components/ui/text", async () => {
	const { createElement } = await import("react");
	return {
		Text: (props: Record<string, unknown>) =>
			createElement("text", props, props.children as never),
	};
});

vi.mock("@/components/ui/text-field", async () => {
	const { createElement } = await import("react");
	return {
		TextField: (props: Record<string, unknown>) =>
			createElement(
				"text-field",
				props,
				props.label ? createElement("text", null, props.label as string) : null,
			),
	};
});

vi.mock("@/components/detail/MilkdownWebView", async () => {
	const { createElement } = await import("react");
	return {
		MilkdownWebView: (props: Record<string, unknown>) =>
			createElement("milkdown", props),
	};
});

vi.mock("@/components/detail/StarRating", () => ({ StarRating: () => null }));

function renderSheet(onSave = vi.fn()) {
	let renderer!: ReactTestRenderer;
	act(() => {
		renderer = create(
			<ReviewEditorSheet visible onDismiss={vi.fn()} onSave={onSave} />,
		);
	});
	return { renderer, onSave };
}

function text(renderer: ReactTestRenderer) {
	return renderer.root
		.findAllByType("text" as never)
		.flatMap((node) => node.children)
		.filter((child): child is string => typeof child === "string");
}

function saveButton(renderer: ReactTestRenderer) {
	return renderer.root
		.findAllByType("pressable" as never)
		.find((node) =>
			node
				.findAllByType("text" as never)
				.some((child) => child.children.includes("Save")),
		);
}

describe("ReviewEditorSheet required fields", () => {
	beforeEach(() => vi.clearAllMocks());

	it("marks the title and review body as required", () => {
		const { renderer } = renderSheet();

		expect(text(renderer)).toContain("Title *");
		expect(text(renderer)).toContain("Review *");
		expect(
			renderer.root.findByType("text-field" as never).props.accessibilityLabel,
		).toBe("Review title, required");
	});

	it("explains which required field is missing", () => {
		const { renderer } = renderSheet();
		const title = renderer.root.findByType("text-field" as never);
		const editor = renderer.root.findByType("milkdown" as never);

		act(() => title.props.onChangeText("A title"));
		expect(text(renderer)).toContain(
			"A review body is required before you can save.",
		);
		expect(saveButton(renderer)?.props.disabled).toBe(true);

		act(() => {
			title.props.onChangeText("");
			editor.props.onChange("A body");
		});
		expect(text(renderer)).toContain(
			"A title is required when you write a review.",
		);
		expect(saveButton(renderer)?.props.disabled).toBe(true);
	});

	it("enables save only when both fields contain text", () => {
		const { renderer, onSave } = renderSheet();
		const title = renderer.root.findByType("text-field" as never);
		const editor = renderer.root.findByType("milkdown" as never);

		act(() => {
			title.props.onChangeText("  A title  ");
			editor.props.onChange("  A body  ");
		});
		const save = saveButton(renderer);
		expect(save?.props.disabled).toBe(false);

		act(() => save?.props.onPress());
		expect(onSave).toHaveBeenCalledWith(
			expect.objectContaining({ title: "  A title  ", markdown: "  A body  " }),
		);

		act(() => editor.props.onChange("   "));
		expect(saveButton(renderer)?.props.disabled).toBe(true);
	});
});
