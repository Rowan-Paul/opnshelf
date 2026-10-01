import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewEditorSheet } from "./ReviewEditorSheet";

vi.mock("@tanstack/react-query", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-query")>()),
	useQuery: () => ({ data: undefined }),
}));

const showDialog = vi.hoisted(() => vi.fn());
const scrollTo = vi.hoisted(() => vi.fn());
const focusEditor = vi.hoisted(() => vi.fn());
const blurTitle = vi.hoisted(() => vi.fn());
vi.mock("@/components/ui/dialog", () => ({
	useDialog: () => ({ showDialog }),
	DialogProvider: ({ children }: { children: import("react").ReactNode }) =>
		children,
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
		ScrollView: component("scroll-view"),
		// The Button primitive picks its spinner tint from the scheme.
		useColorScheme: () => "light",
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
	const { createElement, forwardRef, useImperativeHandle } = await import(
		"react"
	);
	return {
		TextField: forwardRef((props: Record<string, unknown>, ref) => {
			useImperativeHandle(ref, () => ({ blur: blurTitle }));
			return createElement(
				"text-field",
				props,
				props.label ? createElement("text", null, props.label as string) : null,
			);
		}),
	};
});

vi.mock("@/components/detail/MilkdownWebView", async () => {
	const { createElement, forwardRef, useImperativeHandle } = await import(
		"react"
	);
	return {
		MilkdownWebView: forwardRef((props: Record<string, unknown>, ref) => {
			useImperativeHandle(ref, () => ({ focus: focusEditor }));
			return createElement("milkdown", props);
		}),
	};
});

vi.mock("@/components/detail/StarRating", () => ({ StarRating: () => null }));

function renderSheet(onSave = vi.fn()) {
	let renderer!: ReactTestRenderer;
	act(() => {
		renderer = create(
			<ReviewEditorSheet visible onDismiss={vi.fn()} onSave={onSave} />,
			{
				createNodeMock: (node) =>
					node.type === "scroll-view" ? { scrollTo } : null,
			},
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

describe("starting a new review", () => {
	it("keeps unsaved changes until the discard action is confirmed", () => {
		const onNewReview = vi.fn();
		let renderer!: ReactTestRenderer;
		act(() => {
			renderer = create(
				<ReviewEditorSheet
					visible
					isEditing
					initialTitle="Existing"
					initialMarkdown="Body"
					onDismiss={vi.fn()}
					onSave={vi.fn()}
					onNewReview={onNewReview}
				/>,
			);
		});
		act(() =>
			renderer.root
				.findByType("text-field" as never)
				.props.onChangeText("Unsaved"),
		);
		const button = renderer.root
			.findAllByType("pressable" as never)
			.find((node) =>
				node
					.findAllByType("text" as never)
					.some((text) => text.children.includes("New review")),
			);
		act(() => button?.props.onPress());
		expect(onNewReview).not.toHaveBeenCalled();
		expect(renderer.root.findByType("text-field" as never).props.value).toBe(
			"Unsaved",
		);
		act(() => showDialog.mock.calls.at(-1)?.[0].actions[1].onPress());
		expect(onNewReview).toHaveBeenCalledOnce();
	});
});

it("reveals the focused field after the keyboard shrinks the form, not on expansion", () => {
	const { renderer } = renderSheet();
	const scroll = renderer.root.findByType("scroll-view" as never);
	const layout = (y: number, height: number) => ({
		nativeEvent: { layout: { y, height } },
	});
	act(() => scroll.props.onLayout(layout(0, 500)));
	const body = renderer.root
		.findAllByType("view" as never)
		.find(
			(n) => n.props.onLayout && n.findAllByType("milkdown" as never).length,
		);
	expect(body).toBeDefined();
	act(() => body?.props.onLayout(layout(280, 192)));
	act(() => renderer.root.findByType("milkdown" as never).props.onFocus());
	expect(scrollTo).toHaveBeenLastCalledWith({ y: 280, animated: false });
	scrollTo.mockClear();
	act(() => scroll.props.onLayout(layout(0, 300)));
	expect(scrollTo).toHaveBeenCalledOnce();
	scrollTo.mockClear();
	act(() => scroll.props.onLayout(layout(0, 500)));
	expect(scrollTo).not.toHaveBeenCalled();
	const title = renderer.root
		.findAllByType("view" as never)
		.find(
			(n) => n.props.onLayout && n.findAllByType("text-field" as never).length,
		);
	expect(title).toBeDefined();
	act(() => title?.props.onLayout(layout(110, 70)));
	act(() => renderer.root.findByType("text-field" as never).props.onFocus());
	expect(scrollTo).toHaveBeenLastCalledWith({ y: 110, animated: false });
	expect(
		scroll
			.findAllByType("pressable" as never)
			.some((n) => n.props.accessibilityLabel === "Save"),
	).toBe(false);
});

it("moves from the title to the body without saving a valid review", () => {
	const { renderer, onSave } = renderSheet();
	const title = renderer.root.findByType("text-field" as never);
	act(() => {
		title.props.onChangeText("My review");
		renderer.root
			.findByType("milkdown" as never)
			.props.onChange("A complete body");
	});
	expect(saveButton(renderer)?.props.disabled).toBe(false);
	expect(title.props.returnKeyType).toBe("next");
	expect(title.props.submitBehavior).toBe("submit");
	act(() => title.props.onSubmitEditing());
	expect(blurTitle).toHaveBeenCalledOnce();
	expect(focusEditor).toHaveBeenCalledOnce();
	expect(blurTitle.mock.invocationCallOrder[0]).toBeLessThan(
		focusEditor.mock.invocationCallOrder[0],
	);
	expect(onSave).not.toHaveBeenCalled();
	act(() => renderer.unmount());
});
