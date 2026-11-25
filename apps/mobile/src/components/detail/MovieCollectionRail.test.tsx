import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	MovieCollectionEyebrow,
	MovieCollectionRail,
} from "./MovieCollectionRail";

const state = vi.hoisted(() => ({
	isAuthenticated: false,
	watchCounts: undefined as
		| { movieId: string; watchCount: number }[]
		| undefined,
	scrollTo: vi.fn(),
}));
vi.mock("react-native", async () => {
	const { createElement, useImperativeHandle } = await import("react");
	return {
		View: (props: Record<string, unknown>) =>
			createElement("view", props, props.children as never),
		Pressable: (props: Record<string, unknown>) =>
			createElement("button", props, props.children as never),
		ScrollView: ({
			ref,
			...props
		}: Record<string, unknown> & { ref?: React.Ref<unknown> }) => {
			useImperativeHandle(ref, () => ({ scrollTo: state.scrollTo }));
			return createElement("scroll", props, props.children as never);
		},
	};
});
vi.mock("lucide-react-native", () => ({ Layers: () => null }));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-query")>()),
	useQuery: () => ({ data: state.watchCounts }),
}));
vi.mock("@/lib/auth-context", () => ({
	useAuth: () => ({
		user: state.isAuthenticated ? { did: "did:plc:viewer" } : undefined,
		isAuthenticated: state.isAuthenticated,
	}),
}));
vi.mock("@/theme/colors", () => ({
	useThemeColors: () => ({ mutedForeground: "muted" }),
}));
vi.mock("@/components/media/MediaCard", async () => {
	const { createElement } = await import("react");
	return {
		MediaCard: (props: Record<string, unknown>) => createElement("card", props),
	};
});
vi.mock("@/components/ui/text", async () => {
	const { createElement } = await import("react");
	return {
		Text: (props: Record<string, unknown>) =>
			createElement("text", props, props.children as never),
	};
});

const collection = {
	id: 10,
	name: "Example Collection",
	movies: [
		{ id: 1, title: "First", release_date: "2020-01-01" },
		{ id: 2, title: "Second", release_date: "2021-01-01" },
		{ id: 3, title: "Third", release_date: "2022-01-01" },
		{ id: 4, title: "Fourth", release_date: "2023-01-01" },
	],
};

function render(element: React.ReactElement) {
	let renderer!: ReactTestRenderer;
	act(() => {
		renderer = create(element);
	});
	return renderer;
}
const cards = (renderer: ReactTestRenderer) =>
	renderer.root.findAll((node) => (node.type as string) === "card");
const text = (renderer: ReactTestRenderer) =>
	renderer.root
		.findAll((node) => node.type === "text")
		.map((node) => [node.props.children].flat().join(""));

afterEach(() => {
	state.isAuthenticated = false;
	state.watchCounts = undefined;
	vi.clearAllMocks();
});

describe("MovieCollectionRail", () => {
	it("gives every other movie the shelf actions and shows the current one read-only", () => {
		state.isAuthenticated = true;
		state.watchCounts = [{ movieId: "2", watchCount: 1 }];
		const renderer = render(
			<MovieCollectionRail collection={collection} movieId="2" />,
		);
		const [first, current] = cards(renderer);

		expect(text(renderer)).toContain("Example movies");
		expect(text(renderer)).toContain("1 of 4 watched");
		expect(first.props).toMatchObject({
			item: { id: 1, type: "movie", title: "First", year: "2020" },
			actions: true,
		});
		expect(current.props.actions).toBeUndefined();
		expect(current.props.isWatched).toBe(true);
		expect(current.parent?.parent?.props.pointerEvents).toBe("none");
	});

	it("centres the current movie once the row is measured", () => {
		const renderer = render(
			<MovieCollectionRail collection={collection} movieId="4" />,
		);
		act(() =>
			renderer.root
				.find((node) => (node.type as string) === "scroll")
				.props.onLayout({ nativeEvent: { layout: { width: 320 } } }),
		);

		// 16 edge + 3 cards of 112 + 12 gap, less half the spare row width.
		expect(state.scrollTo).toHaveBeenCalledWith({ x: 284, animated: false });
	});

	it("renders nothing for a movie that stands alone", () => {
		expect(
			render(
				<MovieCollectionRail collection={undefined} movieId="2" />,
			).toJSON(),
		).toBeNull();
	});
});

describe("MovieCollectionEyebrow", () => {
	it("says where the movie sits and reports the press", () => {
		const onPress = vi.fn();
		const renderer = render(
			<MovieCollectionEyebrow
				collection={collection}
				movieId="2"
				onPress={onPress}
			/>,
		);

		expect(text(renderer)).toEqual(["Example · Movie 2 of 4"]);
		act(() =>
			renderer.root
				.find((node) => (node.type as string) === "button")
				.props.onPress(),
		);
		expect(onPress).toHaveBeenCalled();
	});
});
