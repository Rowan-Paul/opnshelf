import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { ListInfoCard } from "./ListInfoCard";

vi.mock("react-native", async () => {
	const React = await import("react");
	return {
		View: ({ children, ...props }: React.PropsWithChildren) =>
			React.createElement("View", props, children),
		Text: ({ children, ...props }: React.PropsWithChildren) =>
			React.createElement("Text", props, children),
	};
});

/** Flatten every string the card rendered so assertions read as page copy. */
function renderText(element: React.ReactElement): string {
	let renderer: ReactTestRenderer | undefined;
	act(() => {
		renderer = create(element);
	});
	if (!renderer) throw new Error("Card did not render");
	const collect = (node: unknown): string => {
		if (typeof node === "string") return node;
		if (Array.isArray(node)) return node.map(collect).join("");
		if (node && typeof node === "object" && "children" in node) {
			return collect((node as { children: unknown }).children);
		}
		return "";
	};
	return collect(renderer.toJSON());
}

const base = {
	description: "Items you want to watch",
	total: 4,
	updatedAt: new Date().toISOString(),
	watchedCount: 1,
};

describe("ListInfoCard", () => {
	it("summarises the list with description and last-updated metadata", () => {
		const text = renderText(<ListInfoCard {...base} showProgress={false} />);

		expect(text).toContain("Items you want to watch");
		expect(text).toContain("Updated just now");
	});

	it("names the creator only when one is passed", () => {
		expect(
			renderText(
				<ListInfoCard {...base} creator="norbiros.dev" showProgress={false} />,
			),
		).toContain("Created by @norbiros.dev");

		// Own lists pass no creator: "Created by you" is noise.
		expect(
			renderText(<ListInfoCard {...base} showProgress={false} />),
		).not.toContain("Created by");
	});

	it("shows viewer-relative progress in place of the item count", () => {
		const text = renderText(<ListInfoCard {...base} showProgress />);

		expect(text).toContain("1 of 4 watched");
		expect(text).toContain("25%");
		expect(text).not.toContain("4 items");
	});

	it("falls back to the item count when progress is hidden", () => {
		const text = renderText(<ListInfoCard {...base} showProgress={false} />);

		expect(text).toContain("4 items");
		expect(text).not.toContain("watched");
	});

	it("singularises a one-item list", () => {
		const text = renderText(
			<ListInfoCard {...base} total={1} showProgress={false} />,
		);

		expect(text).toContain("1 item");
		expect(text).not.toContain("1 items");
	});

	it("exposes progress to assistive tech", () => {
		let renderer: ReactTestRenderer | undefined;
		act(() => {
			renderer = create(<ListInfoCard {...base} showProgress />);
		});

		if (!renderer) throw new Error("Card did not render");
		const progressbar = renderer.root.findByProps({
			accessibilityRole: "progressbar",
		});
		expect(progressbar.props.accessibilityValue).toEqual({
			min: 0,
			max: 4,
			now: 1,
		});
	});

	it("keeps the progress bar at 0% rather than dividing by zero", () => {
		let renderer: ReactTestRenderer | undefined;
		act(() => {
			renderer = create(
				<ListInfoCard {...base} total={0} watchedCount={0} showProgress />,
			);
		});

		if (!renderer) throw new Error("Card did not render");
		const progressbar = renderer.root.findByProps({
			accessibilityRole: "progressbar",
		});
		expect(progressbar.props.accessibilityValue).toEqual({
			min: 0,
			max: 0,
			now: 0,
		});
	});
});
