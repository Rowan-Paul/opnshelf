import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewsTab } from "./ReviewsTab";

const testDoubles = vi.hoisted(() => ({
	useReviews: vi.fn(),
	invalidateQueries: vi.fn(),
	previewQueryKey: vi.fn(() => ["reviews", "preview"]),
	infiniteQueryKey: vi.fn(() => ["reviews", "infinite"]),
}));

vi.mock("@/lib/use-public-profile", () => ({
	useInfiniteProfileReviews: testDoubles.useReviews,
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
});

describe("ReviewsTab", () => {
	it("retains reviews in page order and coalesces rapid load-more presses", async () => {
		let resolveLoad: (() => void) | undefined;
		const load = new Promise<void>((resolve) => {
			resolveLoad = resolve;
		});
		const fetchNextPage = vi.fn(() => load);
		let state = {
			data: {
				pages: [
					{
						items: [review("1", "First")],
						nextCursor: "next" as string | null,
					},
				],
			},
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
		const buttons = renderer.root.findAllByType("pressable" as never);
		const loadButton = buttons.find((node) =>
			node
				.findAllByType("text" as never)
				.some((text) => text.children.includes("Load more")),
		);
		expect(loadButton).toBeDefined();
		let firstLoad!: Promise<void>;
		act(() => {
			firstLoad = loadButton?.props.onPress();
			loadButton?.props.onPress();
		});
		expect(fetchNextPage).toHaveBeenCalledTimes(1);

		resolveLoad?.();
		await act(async () => firstLoad);
		state = {
			...state,
			data: {
				pages: [
					{ items: [review("1", "First")], nextCursor: "next" },
					{
						items: [review("2", "Second")],
						nextCursor: null as string | null,
					},
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
		expect(text).not.toContain("Load more");
	});

	it("shows a disabled loading control while fetching the next page", () => {
		testDoubles.useReviews.mockReturnValue({
			data: { pages: [{ items: [review("1", "First")], nextCursor: "next" }] },
			isLoading: false,
			isError: false,
			fetchNextPage: vi.fn(),
			hasNextPage: true,
			isFetchingNextPage: true,
		});
		let renderer!: ReactTestRenderer;
		act(() => {
			renderer = create(
				<ReviewsTab userDid="did:one" handle="one" isOwner={false} />,
			);
		});
		const loadingButton = renderer.root
			.findAllByType("pressable" as never)
			.find(
				(node) => node.findAllByType("activity-indicator" as never).length > 0,
			);
		expect(loadingButton?.props.disabled).toBe(true);
	});

	it("invalidates both the Overview preview and infinite list after a mutation", () => {
		testDoubles.useReviews.mockReturnValue({
			data: {
				pages: [{ items: [review("1", "First")], nextCursor: null }],
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
