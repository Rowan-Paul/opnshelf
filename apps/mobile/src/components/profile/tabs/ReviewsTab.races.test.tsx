import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { deferredCalls, keyboard, step } from "@/test/async-races";
import { ReviewsTab } from "./ReviewsTab";

// The review editor sheet's async owner is ReviewCard: it closes the sheet when a
// save succeeds. These pin what a late save may and may not do.

const mocks = vi.hoisted(() => ({
	update: undefined as unknown as ReturnType<typeof deferredCalls>,
	toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@opnshelf/api", () => ({
	reviewsControllerDeleteReviewMutation: () => ({ mutationFn: vi.fn() }),
	reviewsControllerGetUserReviewsInfiniteQueryKey: () => ["reviews"],
	reviewsControllerGetUserReviewsQueryKey: () => ["reviews", "preview"],
	reviewsControllerLikeReviewMutation: () => ({ mutationFn: vi.fn() }),
	reviewsControllerUnlikeReviewMutation: () => ({ mutationFn: vi.fn() }),
	reviewsControllerUpdateReviewMutation: () => ({
		mutationFn: mocks.update.fn,
	}),
}));
vi.mock("react-native-keyboard-controller", async () =>
	(await import("@/test/async-races")).keyboardControllerMock(),
);
vi.mock("@/components/ui/bottom-sheet-modal", () => ({
	BottomSheetModal: "modal",
}));
vi.mock("@/components/detail/ReviewEditorSheet", async () => ({
	ReviewEditorSheet: await (
		await import("@/test/async-races")
	).keyboardSheetStandIn("review-editor"),
}));
vi.mock("@/lib/auth-context", () => ({
	useAuth: () => ({ isAuthenticated: true }),
}));
vi.mock("@/lib/posthog", () => ({ posthog: undefined }));
vi.mock("@/components/profile/ProfileReviewRating", () => ({
	ProfileReviewRating: () => null,
}));
vi.mock("@/components/ReviewBody", () => ({ ReviewBody: () => null }));
vi.mock("@/components/reviews/SpoilerShield", () => ({
	SpoilerShield: () => null,
}));
vi.mock("@/components/ui/dialog", () => ({
	useDialog: () => ({ showDialog: vi.fn() }),
}));
vi.mock("@/components/ui/toast", () => ({ useToast: () => mocks.toast }));
vi.mock("@/lib/use-public-profile", () => ({
	useInfiniteProfileReviews: () => ({
		data: {
			pages: [
				{
					items: [
						{
							id: "1",
							mediaLabel: "First",
							createdAt: "2026-07-20T00:00:00.000Z",
							posterPath: null,
							reviewTitle: "Title",
							markdown: "Body",
							spoiler: false,
							hasLiked: false,
							likeCount: 0,
							rkey: "1",
						},
					],
				},
			],
		},
		isLoading: false,
		isError: false,
		fetchNextPage: vi.fn(),
		hasNextPage: false,
		isFetchingNextPage: false,
	}),
}));
vi.mock("@/lib/use-end-reached", () => ({ useEndReached: () => {} }));
vi.mock("react-native", () => ({
	ActivityIndicator: "activity-indicator",
	Pressable: "pressable",
	View: "view",
}));
vi.mock("lucide-react-native", () => ({
	Heart: "icon",
	Pencil: "icon",
	Star: "icon",
	Trash2: "icon",
}));
vi.mock("@/components/profile/ProfileContentCard", () => ({
	ProfileContentCard: ({ headerRight }: { headerRight: never }) => headerRight,
}));
vi.mock("@/components/ui/load-more", () => ({
	canLoadMore: () => false,
	LoadMoreFooter: () => null,
}));
vi.mock("@/components/ui/skeletons", () => ({ ReviewsSkeleton: () => null }));
vi.mock("@/components/ui/states", () => ({
	EmptyState: () => null,
	ErrorState: () => null,
}));
vi.mock("@/components/ui/text", () => ({ Text: "text" }));
vi.mock("@/lib/media-href", () => ({ mediaHref: () => "/media" }));

let view: ReactTestRenderer;
beforeEach(async () => {
	vi.clearAllMocks();
	mocks.update = deferredCalls();
	const client = new QueryClient();
	await step(() => {
		view = create(
			<QueryClientProvider client={client}>
				<ReviewsTab userDid="did:one" handle="one" isOwner />
			</QueryClientProvider>,
		);
	});
});
afterEach(() => act(() => view.unmount()));

const shown = () => view.root.findByType("modal" as never).props.visible;
const editor = () => view.root.findByType("review-editor" as never).props;
const openEditor = () =>
	step(() =>
		view.root
			.findAllByType("pressable" as never)
			.find((node) => node.props.accessibilityLabel === "Edit review")
			?.props.onPress(),
	);
const save = (title: string) =>
	step(() => editor().onSave({ title, markdown: "Body", spoiler: false }));
const close = () => step(() => editor().onDismiss());

it("does nothing to the keyboard when a save finishes after closing", async () => {
	await openEditor();
	await save("Edited");
	await close();
	expect(keyboard.dismiss).toHaveBeenCalledOnce();
	await step(() => mocks.update.calls[0].resolve({}));
	expect(shown()).toBe(false);
	expect(keyboard.dismiss).toHaveBeenCalledOnce();
});

it("keeps a reopened editor open when the earlier save finishes", async () => {
	await openEditor();
	await save("Edited");
	await close();
	await openEditor();
	await step(() => mocks.update.calls[0].resolve({}));
	expect(editor().visible).toBe(true);
	expect(shown()).toBe(true);
	expect(keyboard.dismiss).toHaveBeenCalledOnce();
});

it("shows no error when an earlier save fails after a newer one succeeded", async () => {
	await openEditor();
	await save("Older");
	await close();
	await openEditor();
	// The Save button is disabled while the earlier save is in flight…
	expect(editor().isSaving).toBe(true);
	// …and even a newer save that gets through supersedes it.
	await save("Newer");
	await step(() => mocks.update.calls[1].resolve({}));
	await step(() => mocks.update.calls[0].reject(new Error("Network")));
	expect(mocks.toast.error).not.toHaveBeenCalled();
	expect(shown()).toBe(false);
});
