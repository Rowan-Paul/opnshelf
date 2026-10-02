import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, expect, it, vi } from "vitest";
import { RateReviewButton } from "./RateReviewButton";

const state = vi.hoisted(() => ({
	reviews: [
		{
			id: "newest",
			reviewTitle: "Latest review",
			markdown: "Latest body",
			spoiler: true,
			mirrorToBlog: false,
		},
		{
			id: "older",
			reviewTitle: "Earlier review",
			markdown: "Earlier body",
			spoiler: false,
			mirrorToBlog: true,
		},
	],
	createReview: vi.fn(),
	updateReview: vi.fn(),
	isLoading: false,
	isReviewError: false,
	refetchReviews: vi.fn(),
}));
vi.mock("@/lib/use-review", () => ({
	useReview: () => ({ ...state, rating: 8 }),
}));
vi.mock("@/lib/auth-context", () => ({
	useAuth: () => ({ isAuthenticated: true }),
}));
vi.mock("react-native", async () => {
	const { createElement } = await import("react");
	const component = (name: string) => (props: Record<string, unknown>) =>
		createElement(name, props, props.children as never);
	return { View: component("view"), Pressable: component("pressable") };
});
vi.mock("lucide-react-native", () => ({ MessageSquare: () => null }));
vi.mock("@/components/ui/text", async () => {
	const { createElement } = await import("react");
	return {
		Text: (props: Record<string, unknown>) =>
			createElement("text", props, props.children as never),
	};
});
vi.mock("@/components/detail/ReviewEditorSheet", async () => {
	const { createElement } = await import("react");
	return {
		ReviewEditorSheet: (props: Record<string, unknown>) =>
			createElement("editor", props),
	};
});

beforeEach(() => vi.clearAllMocks());
function open() {
	let renderer!: ReactTestRenderer;
	act(() => {
		renderer = create(
			<RateReviewButton
				mediaType="show"
				mediaId="123"
				seasonNumber={3}
				episodeNumber={2}
			/>,
		);
	});
	act(() => renderer.root.findByType("pressable" as never).props.onPress());
	return renderer;
}
it("loads the latest own Review and updates its id, preserving all fields", () => {
	const renderer = open();
	const editor = renderer.root.findByType("editor" as never);
	expect(editor.props).toMatchObject({
		visible: true,
		isEditing: true,
		initialTitle: "Latest review",
		initialMarkdown: "Latest body",
		initialSpoiler: true,
		initialMirrorToBlog: false,
	});
	const input = {
		title: "Edited",
		markdown: "Body",
		spoiler: true,
		mirrorToBlog: false,
		postToBluesky: false,
	};
	act(() => editor.props.onSave(input));
	expect(state.updateReview).toHaveBeenCalledWith("newest", input);
	expect(state.createReview).not.toHaveBeenCalled();
});
it("creates separately after New review and resets to latest on reopening", () => {
	const renderer = open();
	act(() => renderer.root.findByType("editor" as never).props.onNewReview());
	const editor = renderer.root.findByType("editor" as never);
	expect(editor.props).toMatchObject({
		isEditing: false,
		initialTitle: "",
		initialMarkdown: "",
		initialSpoiler: false,
		initialMirrorToBlog: true,
	});
	const input = {
		title: "New",
		markdown: "New body",
		spoiler: false,
		mirrorToBlog: true,
		postToBluesky: false,
	};
	act(() => editor.props.onSave(input));
	expect(state.createReview).toHaveBeenCalledWith(input);
	expect(state.updateReview).not.toHaveBeenCalled();
	act(() => renderer.root.findByType("pressable" as never).props.onPress());
	expect(renderer.root.findByType("editor" as never).props.initialTitle).toBe(
		"Latest review",
	);
});
it("opens blank when the author has no Reviews", () => {
	const reviews = state.reviews;
	state.reviews = [];
	const renderer = open();
	expect(renderer.root.findByType("editor" as never).props.isEditing).toBe(
		false,
	);
	state.reviews = reviews;
});
it("does not open a blank editor when reviews failed to load", () => {
	state.isReviewError = true;
	const renderer = open();
	expect(renderer.root.findByType("editor" as never).props.visible).toBe(false);
	expect(state.refetchReviews).toHaveBeenCalledOnce();
	state.isReviewError = false;
});
