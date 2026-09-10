import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewsTab } from "./ReviewsTab";

const testDoubles = vi.hoisted(() => ({
	useReviews: vi.fn(),
	invalidateQueries: vi.fn(),
	previewQueryKey: vi.fn(() => ["reviews", "preview"]),
	infiniteQueryKey: vi.fn(() => ["reviews", "infinite"]),
	endReached: { current: undefined as (() => void) | undefined },
}));

vi.mock("@/lib/use-public-profile", () => ({
	useInfiniteProfileReviews: testDoubles.useReviews,
}));

// Captures the tab's end-reached callback so the test can act as the scroll
// container nearing its bottom.
vi.mock("@/lib/use-end-reached", () => ({
	useEndReached: (callback: () => void) => {
		testDoubles.endReached.current = callback;
	},
}));

vi.mock("@opnshelf/api", () => ({
	reviewsControllerDeleteReviewMutation: () => ({}),
	reviewsControllerGetUserReviewsInfiniteQueryKey: testDoubles.infiniteQueryKey,
	reviewsControllerGetUserReviewsQueryKey: testDoubles.previewQueryKey,
	reviewsControllerLikeReviewMutation: () => ({}),
	reviewsControllerUnlikeReviewMutation: () => ({}),
	reviewsControllerUpdateReviewMutation: () => ({}),
}));

vi.mock("@tanstack/react-query", () => ({
	useMutation: () => ({
		isPending: false,
		mutate: vi.fn((_variables: unknown, options?: { onSuccess?: () => void }) =>
			options?.onSuccess?.(),
		),
	}),
	useQueryClient: () => ({
		invalidateQueries: testDoubles.invalidateQueries,
	}),
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
	const Icon = () => createElement("icon");
	return { Heart: Icon, Pencil: Icon, Star: Icon, Trash2: Icon };
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

vi.mock("@/components/profile/ProfileReviewRating", () => ({
	ProfileReviewRating: () => null,
}));

vi.mock("@/components/detail/ReviewEditorSheet", () => ({
	ReviewEditorSheet: () => null,
}));
vi.mock("@/components/ReviewBody", () => ({ ReviewBody: () => null }));
vi.mock("@/components/reviews/SpoilerShield", async () => {
	const { createElement } = await import("react");
	return {
		SpoilerShield: (props: Record<string, unknown>) =>
			createElement("spoiler-shield", props, props.children as never),
	};
});
vi.mock("@/components/ui/dialog", () => ({
	useDialog: () => ({ showDialog: vi.fn() }),
}));
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
vi.mock("@/components/ui/toast", () => ({
	useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/auth-context", () => ({
	useAuth: () => ({ isAuthenticated: false }),
}));
vi.mock("@/lib/media-href", () => ({ mediaHref: () => "/media" }));
vi.mock("@/lib/posthog", () => ({ posthog: undefined }));

const review = (id: string, title: string) => ({
	id,
	mediaLabel: title,
	mediaTitle: title,
	createdAt: "2026-07-20T00:00:00.000Z",
	posterPath: null,
	reviewTitle: null,
	markdown: null,
	spoiler: false,
	hasLiked: false,
	likeCount: 0,
	rkey: id,
});

function renderedText(renderer: ReactTestRenderer) {
	return renderer.root
		.findAllByType("text")
		.flatMap((node) => node.children)
		.filter((child): child is string => typeof child === "string");
}

beforeEach(() => {
	testDoubles.useReviews.mockReset();
	testDoubles.invalidateQueries.mockReset();
	testDoubles.previewQueryKey.mockClear();
	testDoubles.infiniteQueryKey.mockClear();
	testDoubles.endReached.current = undefined;
});

describe("ReviewsTab", () => {
	it("appends the next page in order when the scroll container nears its end", () => {
		const fetchNextPage = vi.fn();
		let state = {
			data: { pages: [{ items: [review("1", "First")], hasNextPage: true }] },
			isLoading: false,
			isError: false,
			fetchNextPage,
			hasNextPage: true,
			isFetchingNextPage: false,
		};
		testDoubles.useReviews.mockImplementation(() => state);
		let renderer!: ReactTestRenderer;
		act(() => {
			renderer = create(
				<ReviewsTab userDid="did:one" handle="one" isOwner={false} />,
			);
		});
		expect(renderedText(renderer)).not.toContain("Load more");

		act(() => testDoubles.endReached.current?.());
		expect(fetchNextPage).toHaveBeenCalledTimes(1);

		state = {
			...state,
			data: {
				pages: [
					{ items: [review("1", "First")], hasNextPage: true },
					{ items: [review("2", "Second")], hasNextPage: false },
				],
			},
			hasNextPage: false,
		};
		act(() => {
			renderer.update(
				<ReviewsTab userDid="did:one" handle="one" isOwner={false} />,
			);
		});

		const text = renderedText(renderer);
		expect(text.filter((value) => value === "First")).toHaveLength(1);
		expect(text.filter((value) => value === "Second")).toHaveLength(1);
		expect(text.indexOf("First")).toBeLessThan(text.indexOf("Second"));

		// Nothing left to load: nearing the end again is a no-op.
		act(() => testDoubles.endReached.current?.());
		expect(fetchNextPage).toHaveBeenCalledTimes(1);
	});

	it("shows a trailing skeleton and skips duplicate loads while fetching", () => {
		const fetchNextPage = vi.fn();
		testDoubles.useReviews.mockReturnValue({
			data: { pages: [{ items: [review("1", "First")], hasNextPage: true }] },
			isLoading: false,
			isError: false,
			fetchNextPage,
			hasNextPage: true,
			isFetchingNextPage: true,
		});
		let renderer!: ReactTestRenderer;
		act(() => {
			renderer = create(
				<ReviewsTab userDid="did:one" handle="one" isOwner={false} />,
			);
		});
		expect(renderer.root.findAllByType("skeleton" as never)).toHaveLength(1);
		expect(renderedText(renderer)).toContain("First");

		act(() => testDoubles.endReached.current?.());
		expect(fetchNextPage).not.toHaveBeenCalled();
	});

	it("invalidates both the Overview preview and infinite list after a mutation", () => {
		testDoubles.useReviews.mockReturnValue({
			data: {
				pages: [{ items: [review("1", "First")], hasNextPage: false }],
			},
			isLoading: false,
			isError: false,
			fetchNextPage: vi.fn(),
			hasNextPage: false,
			isFetchingNextPage: false,
		});
		let renderer!: ReactTestRenderer;
		act(() => {
			renderer = create(
				<ReviewsTab userDid="did:one" handle="one" isOwner={false} />,
			);
		});

		const likeButton = renderer.root.findByType("pressable" as never);
		act(() => likeButton.props.onPress());

		expect(testDoubles.invalidateQueries).toHaveBeenCalledTimes(2);
		expect(testDoubles.invalidateQueries).toHaveBeenNthCalledWith(1, {
			queryKey: ["reviews", "preview"],
		});
		expect(testDoubles.invalidateQueries).toHaveBeenNthCalledWith(2, {
			queryKey: ["reviews", "infinite"],
		});
		expect(testDoubles.previewQueryKey).toHaveBeenCalledWith({
			path: { userDid: "did:one" },
		});
		expect(testDoubles.infiniteQueryKey).toHaveBeenCalledWith({
			path: { userDid: "did:one" },
		});
	});
});
