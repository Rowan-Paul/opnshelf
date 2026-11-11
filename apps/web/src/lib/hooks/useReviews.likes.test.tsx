import {
	configureApiClient,
	reviewsControllerGetReviewLikesQueryKey,
} from "@opnshelf/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
	useMediaReviews,
	useReviewLikes,
	useToggleReviewLike,
} from "./useReviews";

vi.mock("#/integrations/posthog/provider", () => ({
	posthog: { capture: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
let liked: boolean;
let client: QueryClient;
let writes: string[];
let delayLikes: Promise<void> | undefined;
let failLikes: boolean;
const target = { mediaType: "show" as const, mediaId: "1" };
const key = () =>
	reviewsControllerGetReviewLikesQueryKey({ path: { reviewId: "r1" } });
function wrapper({ children }: { children: ReactNode }) {
	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
	liked = false;
	writes = [];
	delayLikes = undefined;
	failLikes = false;
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
			if (path.endsWith("/likes")) {
				await delayLikes;
				return Response.json(
					failLikes
						? { message: "Unavailable" }
						: { items: [], total: Number(liked), hasLiked: liked },
					{ status: failLikes ? 503 : 200 },
				);
			}
			if (path.endsWith("/like")) {
				writes.push(request.method);
				liked = request.method === "POST";
				return Response.json({ success: true });
			}
			if (path.endsWith("/media"))
				return Response.json({
					items: [{ id: "r1", likeCount: Number(liked), hasLiked: liked }],
					total: 1,
				});
			throw new Error(`Unexpected request: ${request.url}`);
		}),
	);
});
afterEach(() => {
	cleanup();
	client.clear();
	vi.unstubAllGlobals();
});
it.each([
	false,
	true,
])("refreshes inactive detail after Show toggle from liked=%s", async (initial) => {
	liked = initial;
	const detail = renderHook(
		() => useReviewLikes({ ...target, reviewId: "r1" }),
		{ wrapper },
	);
	await waitFor(() => expect(detail.result.current.isSuccess).toBe(true));
	detail.unmount();
	const show = renderHook(
		() => ({
			toggle: useToggleReviewLike(target),
			reviews: useMediaReviews(target),
		}),
		{ wrapper },
	);
	await waitFor(() => expect(show.result.current.reviews.isSuccess).toBe(true));
	act(() =>
		initial
			? show.result.current.toggle.unlikeReview("r1")
			: show.result.current.toggle.likeReview("r1"),
	);
	await waitFor(() =>
		expect(show.result.current.reviews.data?.items[0].hasLiked).toBe(!initial),
	);
	expect(client.getQueryState(key())?.isInvalidated).toBe(true);
	const reopened = renderHook(
		() => useReviewLikes({ ...target, reviewId: "r1" }),
		{ wrapper },
	);
	await waitFor(() =>
		expect(reopened.result.current.data?.hasLiked).toBe(!initial),
	);
	expect(writes).toEqual([initial ? "DELETE" : "POST"]);
});
it("keeps a detail mutation pending until its new state has loaded", async () => {
	const show = renderHook(() => useMediaReviews(target), { wrapper });
	await waitFor(() =>
		expect(show.result.current.data?.items[0]).toMatchObject({
			hasLiked: false,
			likeCount: 0,
		}),
	);
	const detail = renderHook(
		() => useReviewLikes({ ...target, reviewId: "r1" }),
		{ wrapper },
	);
	await waitFor(() => expect(detail.result.current.isSuccess).toBe(true));
	let resolve!: () => void;
	delayLikes = new Promise<void>((r) => {
		resolve = r;
	});
	act(() => detail.result.current.likeReview());
	await waitFor(() => expect(detail.result.current.isFetching).toBe(true));
	expect(detail.result.current.isLikePending).toBe(true);
	await act(async () => resolve());
	await waitFor(() => expect(detail.result.current.isLikePending).toBe(false));
	expect(detail.result.current.data).toMatchObject({
		hasLiked: true,
		total: 1,
	});
	await waitFor(() =>
		expect(show.result.current.data?.items[0]).toMatchObject({
			hasLiked: true,
			likeCount: 1,
		}),
	);
});
