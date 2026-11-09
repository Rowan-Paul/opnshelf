import {
	configureApiClient,
	reviewsControllerGetMediaReviewsQueryKey,
	reviewsControllerGetReviewLikesQueryKey,
} from "@opnshelf/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { View } from "react-native";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CommunityReviews } from "@/components/detail/CommunityReviews";
import Screen from "../app/reviews/[handle]/[rkey]";

const m = vi.hoisted(() => ({
	error: vi.fn(),
	authenticated: true,
	did: "viewer",
}));
vi.mock("react-native", () => ({
	View: "view",
	ScrollView: "scroll",
	Pressable: "pressable",
	ActivityIndicator: "spinner",
	Share: {},
}));
vi.mock("expo-image", () => ({ Image: "image" }));
vi.mock("expo-router", () => ({
	Link: "link",
	Stack: { Screen: "screen" },
	useLocalSearchParams: () => ({ handle: "other.test", rkey: "1" }),
}));
vi.mock("lucide-react-native", () => ({
	Pencil: "icon",
	Plus: "icon",
	Trash2: "icon",
	ArrowRight: "icon",
	CalendarDays: "icon",
	Heart: "icon",
	Share2: "icon",
	User: "icon",
}));
vi.mock("@/components/reviews/SpoilerShield", () => ({
	SpoilerShield: "shield",
}));
vi.mock("@/components/ui/Markdown", () => ({ Markdown: "markdown" }));
vi.mock("@/components/ui/skeletons", () => ({ ReviewsSkeleton: "skeleton" }));
vi.mock("@/components/ui/states", () => ({ ErrorState: "error" }));
vi.mock("@/components/ui/text", () => ({ Text: "text" }));
vi.mock("@/components/ui/toast", () => ({
	useToast: () => ({ error: m.error }),
}));
vi.mock("@/lib/auth-context", () => ({
	useAuth: () => ({ user: { did: m.did }, isAuthenticated: m.authenticated }),
}));
vi.mock("@/lib/media-href", () => ({ mediaHref: () => "/shows/1" }));
vi.mock("@/lib/posthog", () => ({ posthog: null }));
vi.mock("@/lib/tmdb", () => ({
	posterUrl: () => undefined,
	formatLongDate: () => "today",
}));
vi.mock("@/lib/web-url", () => ({ webReviewUrl: () => "" }));
vi.mock("@/theme/colors", () => ({ useThemeColors: () => ({}) }));

vi.mock("@/components/detail/ReviewEditorSheet", () => ({
	ReviewEditorSheet: () => null,
}));
vi.mock("@/components/detail/StarRating", () => ({ StarRating: () => null }));
vi.mock("@/components/ReviewBody", () => ({ ReviewBody: () => null }));
vi.mock("@/lib/use-review", () => ({ useReview: () => ({}) }));
vi.mock("@/lib/use-tw-style", () => ({ useTwStyle: () => ({}) }));
let liked = false;
let delayLikes: Promise<void> | undefined;
let likesFailure = false;
let writes: string[];
let tree: ReturnType<typeof create>;
let client: QueryClient;
const likesKey = () =>
	reviewsControllerGetReviewLikesQueryKey({ path: { reviewId: "r1" } });
const mediaKey = () =>
	reviewsControllerGetMediaReviewsQueryKey({
		query: {
			mediaType: "show",
			mediaId: "1",
			seasonNumber: undefined,
			episodeNumber: undefined,
		},
	});
const review = {
	id: "r1",
	author: { did: "other", handle: "other.test" },
	mediaType: "show",
	mediaId: "1",
	reviewTitle: "Review",
	createdAt: "2026-11-09",
	updatedAt: "2026-11-09",
	markdown: "Body",
	spoiler: false,
};
async function flush() {
	await act(async () => {
		await new Promise((r) => setTimeout(r, 20));
	});
}
async function show(detail: boolean) {
	await act(async () => {
		const content = (
			<QueryClientProvider client={client}>
				{detail ? (
					<Screen />
				) : (
					<CommunityReviews mediaType="show" mediaId="1" />
				)}
			</QueryClientProvider>
		);
		if (tree) tree.update(content);
		else tree = create(content);
	});
	await flush();
}
function button(label: string) {
	return tree.root.findByProps({ accessibilityLabel: label });
}
async function press(label: string) {
	await act(async () => {
		const b = button(label);
		if (!b.props.disabled) b.props.onPress();
	});
	await flush();
}
beforeEach(async () => {
	m.authenticated = true;
	m.did = "viewer";
	liked = false;
	likesFailure = false;
	delayLikes = undefined;
	writes = [];
	await act(async () => {
		tree = create(<View />);
	});
	configureApiClient("http://fixture.test");
	client = new QueryClient({
		defaultOptions: {
			queries: { retry: false, staleTime: 60000 },
			mutations: { retry: false },
		},
	});
	vi.stubGlobal(
		"fetch",
		vi.fn(async (request: Request) => {
			const path = new URL(request.url).pathname;
			let data: unknown;
			if (path.includes("/canonical/")) data = review;
			else if (path.endsWith("/likes")) {
				await delayLikes;
				if (likesFailure)
					return Response.json({ message: "Unavailable" }, { status: 503 });
				data = { items: [], total: Number(liked), hasLiked: liked };
			} else if (path.endsWith("/like")) {
				writes.push(request.method);
				if (request.method === "POST" && liked)
					return Response.json(
						{ message: "Already liked this review" },
						{ status: 409 },
					);
				liked = request.method === "POST";
				data = { success: true };
			} else if (path.endsWith("/media"))
				data = {
					items: [
						{
							...review,
							userDid: "other",
							userHandle: "other.test",
							likeCount: Number(liked),
							hasLiked: liked,
						},
					],
					total: 1,
				};
			else throw new Error(`Unexpected request: ${request.url}`);
			return Response.json(data);
		}),
	);
});
afterEach(async () => {
	if (tree) await act(async () => tree.unmount());
	client.clear();
	vi.unstubAllGlobals();
});
it("blocks unknown Like state, then offers Unlike for an existing Like", async () => {
	liked = true;
	let resolve!: () => void;
	delayLikes = new Promise<void>((r) => {
		resolve = r;
	});
	await show(true);
	expect(button("Like review").props.disabled).toBe(true);
	await press("Like review");
	expect(writes).toEqual([]);
	await act(async () => resolve());
	await flush();
	expect(button("Unlike review").props.disabled).toBe(false);
	await press("Unlike review");
	expect(writes).toEqual(["DELETE"]);
});
it("offers a retry after likes fail and blocks writes until recovery", async () => {
	likesFailure = true;
	await show(true);
	expect(button("Like review").props.disabled).toBe(true);
	await press("Like review");
	expect(writes).toEqual([]);
	likesFailure = false;
	await press("Retry loading review likes");
	expect(button("Like review").props.disabled).toBe(false);
});
it.each([
	false,
	true,
])("refreshes cached detail after a Show-page toggle from liked=%s", async (initial) => {
	liked = initial;
	await show(true);
	await show(false);
	await press(initial ? "Unlike review" : "Like review");
	expect(writes).toEqual([initial ? "DELETE" : "POST"]);
	expect(client.getQueryState(likesKey())?.isInvalidated).toBe(true);
	await show(true);
	expect(button(initial ? "Like review" : "Unlike review").props.disabled).toBe(
		false,
	);
	expect(client.getQueryData(likesKey())).toMatchObject({
		hasLiked: !initial,
		total: Number(!initial),
	});
});
it("keeps detail disabled through post-mutation refetch and refreshes the Show cache", async () => {
	await show(false);
	await show(true);
	let resolve!: () => void;
	delayLikes = new Promise<void>((r) => {
		resolve = r;
	});
	await press("Like review");
	expect(button("Like review").props.disabled).toBe(true);
	await press("Like review");
	expect(writes).toEqual(["POST"]);
	await act(async () => resolve());
	await flush();
	expect(button("Unlike review").props.disabled).toBe(false);
	expect(client.getQueryState(mediaKey())?.isInvalidated).toBe(true);
	await show(false);
	expect(button("Unlike review").props.disabled).toBe(false);
	expect(writes).toEqual(["POST"]);
});

it.each([
	"signed out",
	"author",
])("keeps %s read only after likes load", async (viewer) => {
	m.authenticated = viewer !== "signed out";
	m.did = viewer === "author" ? "other" : "viewer";
	await show(true);
	expect(button("Like review").props.disabled).toBe(true);
	await press("Like review");
	expect(writes).toEqual([]);
});
