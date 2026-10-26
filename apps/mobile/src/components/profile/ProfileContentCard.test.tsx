import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { expect, it, vi } from "vitest";
import { ProfileContentCard } from "./ProfileContentCard";

vi.mock("react-native", () => ({
	Pressable: "pressable",
	View: "view",
}));
vi.mock("expo-router", () => ({ Link: "link" }));
vi.mock("@/components/ui/text", () => ({ Text: "text" }));
vi.mock("@/components/media/PosterImage", () => ({ PosterImage: "poster" }));

it("keeps header and body actions outside navigation targets", () => {
	let renderer!: ReactTestRenderer;
	act(() => {
		renderer = create(
			<ProfileContentCard
				href="/movies/1/example"
				title="Example"
				meta="Today"
				headerRight={createElement("button", {
					type: "button",
					accessibilityLabel: "Delete",
				})}
			>
				{createElement("button", {
					type: "button",
					accessibilityLabel: "Like",
				})}
			</ProfileContentCard>,
		);
	});
	const links = renderer.root.findAllByType("link" as never);
	expect(links).toHaveLength(2);
	const [poster, title] = links.map((link) =>
		link.findByType("pressable" as never),
	);
	expect(poster.props).toMatchObject({
		accessible: false,
		accessibilityElementsHidden: true,
		importantForAccessibility: "no-hide-descendants",
	});
	expect(title.props.accessibilityRole).toBe("link");
	expect(title.props.accessible).not.toBe(false);
	for (const link of links) {
		expect(link.props.href).toBe("/movies/1/example");
		expect(link.findAllByType("button" as never)).toHaveLength(0);
	}
	expect(renderer.root.findAllByType("button" as never)).toHaveLength(2);
});
