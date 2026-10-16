import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useReleaseNotes } from "./use-release-notes";

const mocks = vi.hoisted(() => ({
	user: { did: "reader" } as { did: string } | null,
	fetch: vi.fn(),
	read: vi.fn(),
	mark: vi.fn(),
}));
vi.mock("./auth-context", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("./release-notes-query", () => ({
	releaseNotesOptions: () => ({
		queryKey: ["release-notes"],
		queryFn: mocks.fetch,
		retry: false,
	}),
}));
vi.mock("../../../../packages/api/src/generated/sdk.gen", () => ({
	releaseNotesControllerGetReadState: mocks.read,
}));
vi.mock(
	"../../../../packages/api/src/generated/@tanstack/react-query.gen",
	() => ({
		releaseNotesControllerMarkReadMutation: () => ({ mutationFn: mocks.mark }),
	}),
);
const latest = "2026-10-01T12:00:00.000Z";
let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
	client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	mocks.user = { did: "reader" };
	mocks.fetch
		.mockReset()
		.mockResolvedValue([{ slug: "new", publishedAt: latest }]);
	mocks.read
		.mockReset()
		.mockResolvedValue({ data: { readThrough: "2026-09-01T00:00:00.000Z" } });
	mocks.mark.mockReset().mockResolvedValue({ readThrough: latest });
});
afterEach(() => {
	cleanup();
	client.clear();
});
describe("Release Notes read behavior", () => {
	it("shows unread on direct links without writing read state", async () => {
		const { result } = renderHook(() => useReleaseNotes(), { wrapper });
		await waitFor(() => expect(result.current.unread).toBe(true));
		expect(mocks.mark).not.toHaveBeenCalled();
	});
	it("marks only the newest displayed entry, and clears all observers", async () => {
		const { result } = renderHook(
			() => ({
				history: useReleaseNotes({ history: true }),
				badge: useReleaseNotes(),
			}),
			{ wrapper },
		);
		await waitFor(() => expect(mocks.mark).toHaveBeenCalledTimes(1));
		expect(mocks.mark.mock.calls[0][0]).toEqual({
			body: { readThrough: latest },
		});
		await waitFor(() => expect(result.current.badge.unread).toBe(false));
	});
	it("does not mark an unsuccessful history load", async () => {
		mocks.fetch.mockRejectedValue(new Error("offline"));
		const { result } = renderHook(() => useReleaseNotes({ history: true }), {
			wrapper,
		});
		await waitFor(() => expect(result.current.isError).toBe(true));
		expect(mocks.mark).not.toHaveBeenCalled();
	});
	it("keeps signed-out readers and caught-up accounts free of unread state", async () => {
		mocks.user = null;
		const { result } = renderHook(() => useReleaseNotes({ history: true }), {
			wrapper,
		});
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.unread).toBe(false);
		expect(mocks.read).not.toHaveBeenCalled();
		expect(mocks.mark).not.toHaveBeenCalled();
	});
	it("retains the unread dot after a failed write and offers an explicit retry", async () => {
		mocks.mark.mockRejectedValueOnce(new Error("offline"));
		const { result } = renderHook(() => useReleaseNotes({ history: true }), {
			wrapper,
		});
		await waitFor(() => expect(result.current.markError).toBe(true));
		expect(result.current.unread).toBe(true);
		expect(mocks.mark).toHaveBeenCalledTimes(1);
		act(() => result.current.retryMark());
		await waitFor(() => expect(result.current.unread).toBe(false));
	});
	it("does not write an old account's delayed acknowledgement into the new account", async () => {
		let resolve!: (value: { readThrough: string }) => void;
		mocks.mark.mockImplementationOnce(
			() =>
				new Promise((done) => {
					resolve = done;
				}),
		);
		const { rerender } = renderHook(
			({ history }) => useReleaseNotes({ history }),
			{ wrapper, initialProps: { history: true } },
		);
		await waitFor(() => expect(mocks.mark).toHaveBeenCalledTimes(1));
		mocks.user = { did: "another-reader" };
		rerender({ history: false });
		await waitFor(() =>
			expect(
				client.getQueryData(["release-notes-read", "another-reader"]),
			).toBeDefined(),
		);
		act(() => resolve({ readThrough: latest }));
		await waitFor(() =>
			expect(client.getQueryData(["release-notes-read", "reader"])).toEqual({
				readThrough: latest,
			}),
		);
		expect(
			client.getQueryData(["release-notes-read", "another-reader"]),
		).toEqual({ readThrough: "2026-09-01T00:00:00.000Z" });
	});
});
