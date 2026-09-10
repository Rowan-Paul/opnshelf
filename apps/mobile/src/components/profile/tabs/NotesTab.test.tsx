import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotesTab } from "./NotesTab";

const profile = vi.hoisted(() => ({
	useNotes: vi.fn(),
	endReached: { current: undefined as (() => void) | undefined },
}));

vi.mock("@/lib/use-public-profile", () => ({
	useInfiniteProfileNotes: profile.useNotes,
}));

// Captures the tab's end-reached callback so the test can act as the scroll
// container nearing its bottom.
vi.mock("@/lib/use-end-reached", () => ({
	useEndReached: (callback: () => void) => {
		profile.endReached.current = callback;
	},
}));

vi.mock("react-native", async () => {
	const { createElement } = await import("react");
	return {
		ActivityIndicator: () => createElement("activity-indicator"),
		Pressable: (props: Record<string, unknown>) =>
			createElement("pressable", props, props.children as never),
		View: (props: Record<string, unknown>) =>
			createElement("view", props, props.children as never),
	};
});

vi.mock("lucide-react-native", async () => {
	const { createElement } = await import("react");
	return { StickyNote: () => createElement("sticky-note") };
});

vi.mock("@/components/profile/ProfileContentCard", async () => {
	const { createElement } = await import("react");
	return {
		ProfileContentCard: (props: Record<string, unknown>) =>
			createElement(
				"profile-card",
				props,
				createElement("text", null, props.title as string),
				props.children as never,
			),
	};
});

vi.mock("@/components/ui/skeletons", async () => {
	const { createElement } = await import("react");
	return { ReviewsSkeleton: () => createElement("skeleton") };
});

vi.mock("@/components/ui/states", async () => {
	const { createElement } = await import("react");
	return {
		EmptyState: (props: Record<string, unknown>) =>
			createElement("empty-state", props),
		ErrorState: (props: Record<string, unknown>) =>
			createElement("error-state", props),
	};
});

vi.mock("@/components/ui/text", async () => {
	const { createElement } = await import("react");
	return {
		Text: (props: Record<string, unknown>) =>
			createElement("text", props, props.children as never),
	};
});

vi.mock("@/lib/media-href", () => ({ mediaHref: () => "/media" }));

const note = (id: string, title: string) => ({
	id,
	mediaLabel: title,
	mediaTitle: title,
	content: `${title} content`,
	updatedAt: "2026-07-20T00:00:00.000Z",
	posterPath: null,
});

function renderedText(renderer: ReactTestRenderer) {
	return renderer.root
		.findAllByType("text")
		.flatMap((node) => node.children)
		.filter((child): child is string => typeof child === "string");
}

beforeEach(() => {
	profile.useNotes.mockReset();
	profile.endReached.current = undefined;
});

describe("NotesTab", () => {
	it("appends the next page when the scroll container nears its end", () => {
		const fetchNextPage = vi.fn();
		let state = {
			data: { pages: [{ items: [note("1", "First")], hasNextPage: true }] },
			isLoading: false,
			isError: false,
			fetchNextPage,
			hasNextPage: true,
			isFetchingNextPage: false,
		};
		profile.useNotes.mockImplementation(() => state);
		let renderer!: ReactTestRenderer;
		act(() => {
			renderer = create(<NotesTab userDid="did:one" isOwner={false} />);
		});
		expect(renderer.root.findAllByType("pressable" as never)).toHaveLength(0);

		act(() => profile.endReached.current?.());
		expect(fetchNextPage).toHaveBeenCalledTimes(1);

		// While the page is in flight a trailing skeleton stands in for it and
		// another end-reached signal does not start a second request.
		state = { ...state, isFetchingNextPage: true };
		act(() => renderer.update(<NotesTab userDid="did:one" isOwner={false} />));
		expect(renderer.root.findAllByType("skeleton" as never)).toHaveLength(1);
		act(() => profile.endReached.current?.());
		expect(fetchNextPage).toHaveBeenCalledTimes(1);

		state = {
			...state,
			data: {
				pages: [
					{ items: [note("1", "First")], hasNextPage: true },
					{ items: [note("2", "Second")], hasNextPage: false },
				],
			},
			isFetchingNextPage: false,
			hasNextPage: false,
		};
		act(() => renderer.update(<NotesTab userDid="did:one" isOwner={false} />));

		const text = renderedText(renderer);
		expect(text.filter((value) => value === "First")).toHaveLength(1);
		expect(text.filter((value) => value === "Second")).toHaveLength(1);
		expect(text.indexOf("First")).toBeLessThan(text.indexOf("Second"));
		expect(renderer.root.findAllByType("skeleton" as never)).toHaveLength(0);
	});

	it("does not show the previous user's pages while a new profile loads", () => {
		profile.useNotes.mockImplementation((userDid: string) => {
			if (userDid === "did:a") {
				return {
					data: {
						pages: [{ items: [note("a", "A note")], hasNextPage: false }],
					},
					isLoading: false,
					isError: false,
					fetchNextPage: vi.fn(),
					hasNextPage: false,
					isFetchingNextPage: false,
				};
			}
			return {
				data: undefined,
				isLoading: true,
				isError: false,
				fetchNextPage: vi.fn(),
				hasNextPage: false,
				isFetchingNextPage: false,
			};
		});
		let renderer!: ReactTestRenderer;
		act(() => {
			renderer = create(<NotesTab userDid="did:a" isOwner={false} />);
		});
		expect(renderedText(renderer)).toContain("A note");

		act(() => renderer.update(<NotesTab userDid="did:b" isOwner={false} />));
		expect(renderedText(renderer)).not.toContain("A note");
		expect(renderer.root.findAllByType("skeleton" as never)).toHaveLength(1);
	});
});
