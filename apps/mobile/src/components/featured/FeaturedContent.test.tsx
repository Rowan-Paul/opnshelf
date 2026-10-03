import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
import { FeaturedContent } from "./FeaturedContent";

const fixture = vi.hoisted(() => ({
	data: {
		items: [
			{
				id: "pick",
				mediaType: "season",
				mediaId: 1399,
				seasonNumber: 2,
				title: "Game of Thrones",
				posterPath: null,
				message: "A new trailer",
				sourceUrl: "https://example.com/exact-trailer",
				sourceLabel: "Watch trailer",
				expiresAt: "2099-01-01T00:00:00Z",
				active: true,
			},
		],
	},
	isPending: false,
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
	...(await importOriginal<object>()),
	useQuery: () => fixture,
}));
vi.mock("react-native", () => ({
	Alert: { alert: vi.fn() },
	Pressable: "Pressable",
	ScrollView: "ScrollView",
	Text: "Text",
	View: "View",
	useWindowDimensions: () => ({ width: 390 }),
}));
vi.mock("expo-image", () => ({ Image: "Image" }));
vi.mock("expo-router", () => ({ Link: "Link" }));
vi.mock("expo-web-browser", () => ({
	openBrowserAsync: vi.fn().mockResolvedValue({}),
}));
let renderer: ReactTestRenderer;
afterEach(() => {
	act(() => renderer?.unmount());
	vi.useRealTimers();
});
it("opens the season detail and the exact source independently", async () => {
	act(() => {
		renderer = create(<FeaturedContent isFocused />);
	});
	expect(renderer.root.findByType("Link" as never).props.href).toBe(
		"/shows/1399/game-of-thrones/seasons/2",
	);
	const source = renderer.root
		.findAllByType("Pressable" as never)
		.find((node) => node.props.onPress);
	await act(async () => {
		source?.props.onPress();
	});
	const { openBrowserAsync } = await import("expo-web-browser");
	expect(openBrowserAsync).toHaveBeenCalledWith(
		"https://example.com/exact-trailer",
	);
});
it("hides expired content while the client stays open", () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2098-12-31T23:59:59Z"));
	act(() => {
		renderer = create(<FeaturedContent isFocused />);
	});
	expect(renderer.toJSON()).not.toBeNull();
	act(() => {
		vi.advanceTimersByTime(2000);
	});
	expect(renderer.toJSON()).toBeNull();
});
