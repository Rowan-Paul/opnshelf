import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Button } from "./button";

const mocks = vi.hoisted(() => ({ colorScheme: vi.fn() }));

vi.mock("react-native", async () => {
	const { createElement } = await import("react");
	return {
		ActivityIndicator: (props: Record<string, unknown>) =>
			createElement("activity-indicator", props),
		Pressable: (props: Record<string, unknown>) =>
			createElement("pressable", props, props.children as never),
		View: (props: Record<string, unknown>) =>
			createElement("view", props, props.children as never),
		useColorScheme: () => mocks.colorScheme(),
	};
});

vi.mock("@/components/ui/text", async () => {
	const { createElement } = await import("react");
	return {
		Text: (props: Record<string, unknown>) =>
			createElement("text", props, props.children as never),
	};
});

function hostType(node: { type: unknown }): string {
	return typeof node.type === "string" ? node.type : "";
}

function render(element: React.ReactElement) {
	let renderer!: ReactTestRenderer;
	act(() => {
		renderer = create(element);
	});
	return renderer;
}

const button = (renderer: ReactTestRenderer) =>
	renderer.root.find((node) => hostType(node) === "pressable");
const label = (renderer: ReactTestRenderer) =>
	renderer.root
		.findAll((node) => hostType(node) === "text")
		.map((node) => [node.props.children].flat().join(""))
		.join(" ");
const spinners = (renderer: ReactTestRenderer) =>
	renderer.root.findAll((node) => hostType(node) === "activity-indicator");

beforeEach(() => {
	vi.clearAllMocks();
	mocks.colorScheme.mockReturnValue("light");
});

describe("Button", () => {
	it("presses", () => {
		const onPress = vi.fn();
		const renderer = render(<Button label="Save" onPress={onPress} />);
		act(() => button(renderer).props.onPress());
		expect(onPress).toHaveBeenCalledOnce();
	});

	it("blocks presses and dims while loading", () => {
		const renderer = render(<Button label="Save" loading />);
		expect(button(renderer).props.disabled).toBe(true);
		expect(button(renderer).props.style.opacity).toBe(0.6);
		expect(button(renderer).props.accessibilityState).toEqual({
			disabled: true,
			busy: true,
		});
	});

	it("dims the same amount when merely disabled", () => {
		// It was 0.5 on some screens, 0.6 on others and 0.7 on the rest.
		const renderer = render(
			<Button label="Save" variant="secondary" disabled />,
		);
		expect(button(renderer).props.style.opacity).toBe(0.6);
		expect(button(renderer).props.accessibilityState.busy).toBe(false);
	});

	it("keeps the label in place when the spinner appears", () => {
		// An inline spinner shoves the label sideways on tap.
		const idle = render(<Button label="Sign in" />);
		const busy = render(<Button label="Sign in" loading />);
		expect(spinners(idle)).toHaveLength(0);
		expect(spinners(busy)).toHaveLength(1);
		expect(
			busy.root.find((n) => hostType(n) === "view").props.className,
		).toContain("absolute");
	});

	it("swaps in the loading label when given one", () => {
		const renderer = render(
			<Button label="Create account" loading loadingLabel="Creating account" />,
		);
		expect(label(renderer)).toBe("Creating account");
	});

	it("tints the spinner for the variant, and for the theme when it depends on it", () => {
		// ActivityIndicator takes a colour prop, so these cannot be classes.
		expect(spinners(render(<Button label="A" loading />))[0].props.color).toBe(
			"#3f2e00",
		);
		expect(
			spinners(render(<Button label="A" loading variant="destructive" />))[0]
				.props.color,
		).toBe("#ef4444");

		expect(
			spinners(render(<Button label="A" loading variant="secondary" />))[0]
				.props.color,
		).toBe("#0f172a");
		mocks.colorScheme.mockReturnValue("dark");
		expect(
			spinners(render(<Button label="A" loading variant="secondary" />))[0]
				.props.color,
		).toBe("#f8fafc");
	});

	it("mutes a disabled primary instead of fading it", () => {
		// Fading the amber fill collapses the contrast against its dark label.
		const renderer = render(<Button label="Save" disabled />);
		expect(button(renderer).props.className).toContain("bg-background-subtle");
		expect(button(renderer).props.className).not.toContain("bg-primary");
		expect(button(renderer).props.style.opacity).toBe(1);
	});

	it("keeps the fill while loading, where the spinner needs the contrast", () => {
		const renderer = render(<Button label="Save" loading />);
		expect(button(renderer).props.className).toContain("bg-primary");
		expect(button(renderer).props.style.opacity).toBe(0.6);
	});

	it("still fades the outline variants, which have no fill to mute", () => {
		const renderer = render(
			<Button label="Save" variant="secondary" disabled />,
		);
		expect(button(renderer).props.style.opacity).toBe(0.6);
	});

	it("gives every variant the same box", () => {
		for (const variant of ["primary", "secondary", "destructive"] as const) {
			const box = button(render(<Button label="A" variant={variant} />)).props
				.className;
			expect(box).toContain("h-12");
			expect(box).toContain("rounded-lg");
		}
	});

	it("keeps layout classes the caller passes", () => {
		// Screens need flex-1 / mt-2 / self-start without reaching for a Pressable.
		const renderer = render(<Button label="A" className="flex-1" />);
		expect(button(renderer).props.className).toContain("flex-1");
	});
});
