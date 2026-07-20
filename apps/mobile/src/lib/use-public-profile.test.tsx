import { reviewsControllerGetUserReviewsInfiniteQueryKey } from "@opnshelf/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	useInfiniteProfileNotes,
	useInfiniteProfileReviews,
} from "./use-public-profile";

const api = vi.hoisted(() => ({
	getNotes: vi.fn(),
	getReviews: vi.fn(),
}));

vi.mock("@opnshelf/api", async (importOriginal) => ({
	...(await importOriginal<typeof import("@opnshelf/api")>()),
	notesControllerGetUserNotes: api.getNotes,
	reviewsControllerGetUserReviews: api.getReviews,
}));

function renderQueryHook<Result>(hook: () => Result) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false, gcTime: Infinity } },
	});
	let current: Result;
	let renderer: ReactTestRenderer;

	function TestComponent(): ReactNode {
		current = hook();
		return null;
	}

	act(() => {
		renderer = create(
			<QueryClientProvider client={client}>
				<TestComponent />
			</QueryClientProvider>,
		);
	});

	return {
		client,
		result: {
			get current() {
				return current;
			},
		},
		rerender() {
			act(() => {
				renderer.update(
					<QueryClientProvider client={client}>
						<TestComponent />
					</QueryClientProvider>,
				);
			});
		},
		unmount() {
			act(() => renderer.unmount());
			client.clear();
		},
	};
}

async function waitForUpdate(assertion: () => void) {
	await act(async () => {
		await vi.waitFor(assertion);
	});
}

afterEach(() => {
	api.getNotes.mockReset();
	api.getReviews.mockReset();
});

describe("infinite public profile hooks", () => {
	it("accumulates review pages and forwards the next cursor", async () => {
		api.getReviews
			.mockResolvedValueOnce({
				data: { items: [{ id: "review-1" }], nextCursor: "page-2" },
			})
			.mockResolvedValueOnce({
				data: { items: [{ id: "review-2" }], nextCursor: null },
			});
		const hook = renderQueryHook(() => useInfiniteProfileReviews("did:one", 5));

		await waitForUpdate(() => {
			expect(hook.result.current.isSuccess).toBe(true);
			expect(hook.result.current.hasNextPage).toBe(true);
		});
		expect(api.getReviews).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				path: { userDid: "did:one" },
				query: { limit: 5 },
			}),
		);

		await act(async () => {
			await hook.result.current.fetchNextPage();
		});
		await waitForUpdate(() =>
			expect(hook.result.current.data?.pages).toHaveLength(2),
		);

		expect(api.getReviews).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				path: { userDid: "did:one" },
				query: { limit: 5, cursor: "page-2" },
			}),
		);
		expect(
			hook.result.current.data?.pages.map((page) => page.items[0]?.id),
		).toEqual(["review-1", "review-2"]);
		expect(hook.result.current.hasNextPage).toBe(false);
		hook.unmount();
	});

	it("retains note pages after a next-page error and permits retry", async () => {
		api.getNotes
			.mockResolvedValueOnce({
				data: { items: [{ id: "note-1" }], nextCursor: "page-2" },
			})
			.mockRejectedValueOnce(new Error("temporary"))
			.mockResolvedValueOnce({
				data: { items: [{ id: "note-2" }], nextCursor: null },
			});
		const hook = renderQueryHook(() => useInfiniteProfileNotes("did:one"));

		await waitForUpdate(() => expect(hook.result.current.isSuccess).toBe(true));
		await act(async () => {
			await hook.result.current.fetchNextPage();
		});
		await waitForUpdate(() =>
			expect(hook.result.current.isFetchNextPageError).toBe(true),
		);
		expect(hook.result.current.data?.pages).toHaveLength(1);

		await act(async () => {
			await hook.result.current.fetchNextPage();
		});
		await waitForUpdate(() =>
			expect(hook.result.current.data?.pages).toHaveLength(2),
		);
		expect(api.getNotes).toHaveBeenNthCalledWith(
			3,
			expect.objectContaining({ query: { limit: 20, cursor: "page-2" } }),
		);
		hook.unmount();
	});

	it("uses distinct cache entries when the profile identity changes", async () => {
		api.getNotes.mockImplementation(({ path }: { path: { userDid: string } }) =>
			Promise.resolve({
				data: { items: [{ id: path.userDid }], nextCursor: null },
			}),
		);
		let userDid = "did:a";
		const hook = renderQueryHook(() => useInfiniteProfileNotes(userDid));
		await waitForUpdate(() =>
			expect(hook.result.current.data?.pages[0]?.items[0]?.id).toBe("did:a"),
		);

		userDid = "did:b";
		hook.rerender();
		expect(hook.result.current.data).toBeUndefined();
		await waitForUpdate(() =>
			expect(hook.result.current.data?.pages[0]?.items[0]?.id).toBe("did:b"),
		);
		hook.unmount();
	});

	it("matches review invalidation under the generated endpoint family", async () => {
		api.getReviews.mockResolvedValue({
			data: { items: [{ id: "review-1" }], nextCursor: null },
		});
		const hook = renderQueryHook(() => useInfiniteProfileReviews("did:one"));
		await waitForUpdate(() => {
			expect(api.getReviews).toHaveBeenCalledTimes(1);
			expect(hook.result.current.isFetching).toBe(false);
		});

		await hook.client.invalidateQueries({
			queryKey: reviewsControllerGetUserReviewsInfiniteQueryKey({
				path: { userDid: "did:one" },
				query: { limit: 20 },
			}),
		});
		await waitForUpdate(() => expect(api.getReviews).toHaveBeenCalledTimes(2));
		hook.unmount();
	});
});
