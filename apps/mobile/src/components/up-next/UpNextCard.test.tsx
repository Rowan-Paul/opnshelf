import type { UpNextShowDto } from "@opnshelf/api";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { Tv } from "lucide-react-native";
import type { PropsWithChildren } from "react";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { UpNextCard } from "./UpNextCard";

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), useMark: vi.fn() }));
function host(name: string) {
	return ({ children, ...props }: PropsWithChildren) =>
		createElement(name, props, children);
}
vi.mock("react-native", () => ({
	View: host("View"),
	Pressable: host("Pressable"),
}));
vi.mock("expo-image", () => ({ Image: host("Image") }));
vi.mock("expo-linear-gradient", () => ({ LinearGradient: host("Gradient") }));
vi.mock("expo-router", () => ({ Link: host("Link") }));
vi.mock("lucide-react-native", () => ({ Plus: host("Plus"), Tv: host("Tv") }));
vi.mock("@/components/ui/text", () => ({ Text: host("Text") }));
vi.mock("@/components/ui/button", () => ({ Button: host("Button") }));
vi.mock("@/lib/use-up-next", () => ({ useMarkUpNextEpisode: mocks.useMark }));
vi.mock("@/lib/use-show-progress", () => ({
	useShowProgressForShow: () => ({ data: undefined, isLoading: false }),
	findShowProgress: () => undefined,
}));
const item: UpNextShowDto = {
	showId: "1",
	show: { showId: "1", title: "Severance", backdropPath: "/backdrop.jpg" },
	nextEpisode: {
		seasonNumber: 2,
		episodeNumber: 3,
		name: "Next episode",
		overview: "An episode description.",
		stillPath: "/still.jpg",
	},
	episodesWatched: 5,
	totalEpisodes: 20,
	latestWatchedDate: "2026-01-01",
	lastWatched: { seasonNumber: 2, episodeNumber: 2 },
};
function renderCards(owner = true) {
	let renderer: ReactTestRenderer | undefined;
	act(() => {
		renderer = create(
			<>
				<UpNextCard item={item} isOwner={owner} />
				<UpNextCard item={{ ...item, showId: "2" }} isOwner={owner} />
			</>,
		);
	});
	if (!renderer) throw new Error("Cards did not render");
	return renderer;
}
beforeEach(() => {
	vi.clearAllMocks();
	mocks.useMark.mockReturnValue({ mutate: mocks.mutate, isPending: false });
});
describe("Up Next episode tiles", () => {
	it("falls back from episode artwork to show artwork and then the placeholder", () => {
		const view = renderCards();
		const image = () => view.root.findAllByType(Image)[0];
		expect(image().props.source.uri).toContain("/still.jpg");
		act(() => image().props.onError());
		expect(image().props.source.uri).toContain("/backdrop.jpg");
		act(() => image().props.onError());
		expect(view.root.findAllByType(Tv)).toHaveLength(1);
		act(() => view.unmount());
	});
	it("scopes pending state to the card and marks the chosen episode", () => {
		mocks.useMark.mockReturnValueOnce({
			mutate: mocks.mutate,
			isPending: true,
		});
		const view = renderCards();
		const buttons = view.root.findAllByType(Button);
		expect(buttons[0].props.loading).toBe(true);
		expect(buttons[0].props.loadingLabel).toBe("Adding…");
		expect(buttons[1].props.loading).toBe(false);
		act(() => buttons[1].props.onPress());
		expect(mocks.mutate).toHaveBeenCalledWith({
			body: { showId: "2", seasonNumber: 2, episodeNumber: 3 },
		});
		act(() => view.unmount());
	});
	it("keeps another user's queue read-only and links to the episode", () => {
		const view = renderCards(false);
		expect(view.root.findAllByType(Button)).toHaveLength(0);
		expect(view.root.findAllByType(Link)[0].props.href).toBe(
			"/shows/1/severance/seasons/2/episodes/3",
		);
		act(() => view.unmount());
	});
});
