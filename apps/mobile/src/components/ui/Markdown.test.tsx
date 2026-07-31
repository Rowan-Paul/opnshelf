import {
	act,
	create,
	type ReactTestInstance,
	type ReactTestRenderer,
	type ReactTestRendererJSON,
} from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { Markdown } from "./Markdown";

const mocks = vi.hoisted(() => ({
	openExternalWebUrl: vi.fn(),
	openURL: vi.fn(),
}));

vi.mock("@/lib/safe-links", () => ({
	openExternalWebUrl: mocks.openExternalWebUrl,
}));

vi.mock("expo-image", async () => {
	const { createElement } = await import("react");
	return {
		Image: (props: Record<string, unknown>) =>
			createElement("image", props, props.children as never),
	};
});

vi.mock("react-native", async () => {
	const { createElement } = await import("react");
	return {
		Linking: { openURL: mocks.openURL },
		View: (props: Record<string, unknown>) =>
			createElement("view", props, props.children as never),
	};
});

vi.mock("@/components/ui/text", async () => {
	const { createElement } = await import("react");
	return {
		Text: (props: Record<string, unknown>) =>
			createElement("text", props, props.children as never),
	};
});

function renderMarkdown(value: string): ReactTestRenderer {
	let tree: ReactTestRenderer | null = null;
	act(() => {
		tree = create(<Markdown value={value} />);
	});
	if (tree == null) {
		throw new Error("Renderer was not created");
	}
	return tree;
}

function flattenText(
	node: ReactTestRendererJSON | ReactTestRendererJSON[] | string | null,
): string {
	if (node == null) {
		return "";
	}
	if (Array.isArray(node)) {
		return node.map((child) => flattenText(child)).join("");
	}
	if (typeof node === "string") {
		return node;
	}
	return (node.children ?? [])
		.map((child) => flattenText(child as never))
		.join("");
}

function flattenInstanceText(node: ReactTestInstance): string {
	return node.children
		.map((child) =>
			typeof child === "string" ? child : flattenInstanceText(child),
		)
		.join("");
}

describe("Markdown", () => {
	it("renders nested emphasis and underscore strong markers correctly", () => {
		const renderer = renderMarkdown("**bold *it* end**\n\n__bold__");
		const textNodes = renderer.root.findAllByType("text");

		expect(
			textNodes.some(
				(node) =>
					node.props.style?.fontFamily === "Inter-Italic" &&
					flattenInstanceText(node).includes("it"),
			),
		).toBe(true);
		expect(
			textNodes.filter(
				(node) =>
					node.props.style?.fontFamily === "Inter-Bold" &&
					flattenInstanceText(node).includes("bold"),
			).length,
		).toBeGreaterThanOrEqual(2);
	});

	it("keeps escaped emphasis literal", () => {
		const renderer = renderMarkdown("\\*not italic\\*");
		expect(flattenText(renderer.toJSON())).toContain("*not italic*");
		expect(flattenText(renderer.toJSON())).not.toContain("\\*not italic\\*");
		expect(
			renderer.root
				.findAllByType("text")
				.some((node) => node.props.style?.fontFamily === "Inter-Italic"),
		).toBe(false);
	});

	it("renders markdown images as native images", () => {
		const renderer = renderMarkdown(
			"![alt text](https://example.com/review.png)",
		);
		const image = renderer.root.findByType("image");
		expect(image.props.source).toEqual({
			uri: "https://example.com/review.png",
		});
		expect(image.props.accessibilityLabel).toBe("alt text");
	});

	it("treats angle-bracket autolinks as tappable links", () => {
		const renderer = renderMarkdown("<https://a.b>");
		const link = renderer.root
			.findAllByType("text")
			.find(
				(node) =>
					typeof node.props.onPress === "function" &&
					flattenInstanceText(node).includes("https://a.b"),
			);

		expect(link).toBeDefined();
		act(() => {
			link?.props.onPress();
		});
		expect(mocks.openExternalWebUrl).toHaveBeenCalledWith(
			"https://a.b",
			mocks.openURL,
		);
	});

	it("renders plus-prefixed and nested list items as lists", () => {
		const renderer = renderMarkdown("+ item\n - nested");
		const text = flattenText(renderer.toJSON());
		expect(text).toContain("•");
		expect(text).toContain("item");
		expect(text).toContain("nested");
	});

	it("renders thematic breaks without showing literal dashes", () => {
		const renderer = renderMarkdown("---");
		expect(flattenText(renderer.toJSON())).not.toContain("---");
		expect(
			renderer.root
				.findAllByType("view")
				.some((node) => node.props.className === "h-px bg-border"),
		).toBe(true);
	});

	it("keeps h4 headings distinct from paragraph text", () => {
		const renderer = renderMarkdown("#### four");
		expect(
			renderer.root
				.findAllByType("text")
				.some(
					(node) =>
						node.props.style?.fontFamily === "PlusJakartaSans-SemiBold" &&
						flattenInstanceText(node) === "four",
				),
		).toBe(true);
	});
});
