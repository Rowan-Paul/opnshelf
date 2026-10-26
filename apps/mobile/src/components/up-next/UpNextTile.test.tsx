import type { UpNextShowDto } from "@opnshelf/api";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { Tv } from "lucide-react-native";
import type { PropsWithChildren } from "react";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PosterProgress } from "@/components/media/poster-progress";
import { Text } from "@/components/ui/text";
import { UpNextTile } from "./UpNextTile";

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), useMark: vi.fn() }));
function host(name: string) {
	return ({ children, ...props }: PropsWithChildren) =>
		createElement(name, props, children);
}
vi.mock("react-native", () => ({
	ActivityIndicator: host("ActivityIndicator"),
	View: host("View"),
	Pressable: host("Pressable"),
}));
vi.mock("expo-image", () => ({ Image: host("Image") }));
vi.mock("expo-linear-gradient", () => ({ LinearGradient: host("Gradient") }));
vi.mock("expo-router", () => ({ Link: host("Link") }));
vi.mock("lucide-react-native", () => ({ Plus: host("Plus"), Tv: host("Tv") }));
vi.mock("@/components/ui/text", () => ({ Text: host("Text") }));
vi.mock("@/lib/use-up-next", () => ({ useMarkUpNextEpisode: mocks.useMark }));

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

function renderTiles() {
	let renderer: ReactTestRenderer | undefined;
	act(() => {
		renderer = create(
			<>
				<UpNextTile item={item} />
				<UpNextTile item={{ ...item, showId: "2" }} />
			</>,
		);
	});
	if (!renderer) throw new Error("Tiles did not render");
	return renderer;
}

function hostType(node: { type: unknown }): string {
	return typeof node.type === "string" ? node.type : "";
}

const addButtons = (view: ReactTestRenderer) =>
	view.root.findAll(
		(node) =>
			hostType(node) === "Pressable" &&
			String(node.props.accessibilityLabel).startsWith("Add "),
	);

beforeEach(() => {
	vi.clearAllMocks();
	mocks.useMark.mockReturnValue({ mutate: mocks.mutate, isPending: false });
});

describe("Up Next Home tiles", () => {
	it("writes the episode, show and progress over the still, as on Web", () => {
		const view = renderTiles();
		const lines = view.root
			.findAllByType(Text)
			.slice(0, 3)
			.map((node) => [node.props.children].flat().join(""));
		expect(lines).toEqual([
			"Next episode",
			"Severance • S2E3",
			"5 of 20 · 25% watched",
		]);
		expect(view.root.findAllByType(PosterProgress)[0].props.progress).toEqual({
			episodesWatched: 5,
			episodesTotal: 20,
			percentage: 25,
		});
		expect(view.root.findAllByType(Link)[0].props.href).toBe(
			"/shows/1/severance/seasons/2/episodes/3",
		);
		act(() => view.unmount());
	});

	it("falls back from episode artwork to show artwork and then the placeholder", () => {
		const view = renderTiles();
		const image = () => view.root.findAllByType(Image)[0];
		expect(image().props.source.uri).toContain("/still.jpg");
		act(() => image().props.onError());
		expect(image().props.source.uri).toContain("/backdrop.jpg");
		act(() => image().props.onError());
		expect(view.root.findAllByType(Tv)).toHaveLength(1);
		act(() => view.unmount());
	});

	it("scopes pending state to the tile and adds the chosen episode", () => {
		mocks.useMark.mockReturnValueOnce({
			mutate: mocks.mutate,
			isPending: true,
		});
		const view = renderTiles();
		const [first, second] = addButtons(view);
		expect(first.props.disabled).toBe(true);
		expect(
			first.findAll((node) => hostType(node) === "ActivityIndicator"),
		).toHaveLength(1);
		expect(second.props.disabled).toBe(false);
		act(() => second.props.onPress());
		expect(mocks.mutate).toHaveBeenCalledWith({
			body: { showId: "2", seasonNumber: 2, episodeNumber: 3 },
		});
		act(() => view.unmount());
	});
});
