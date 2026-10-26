import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { useMarkEpisodeWatched } from "./useMedia";
import { useWatchActions } from "./useWatchActions";

const mocks = vi.hoisted(() => ({
	read: vi.fn(),
	celebrate: vi.fn(),
	mark: vi.fn(),
	success: vi.fn(),
	warning: vi.fn(),
	error: vi.fn(),
}));
vi.mock("@opnshelf/api", async (original) => ({
	...(await original<typeof import("@opnshelf/api")>()),
	showsControllerMarkWatched: mocks.mark,
	showsControllerMarkSeasonWatchedMutation: () => ({ mutationFn: mocks.mark }),
	showsControllerMarkShowWatchedMutation: () => ({ mutationFn: mocks.mark }),
}));
vi.mock("#/lib/watch-completion", () => ({
	readCompletionProgress: mocks.read,
	celebrateWatchCompletion: mocks.celebrate,
}));
vi.mock("#/lib/auth-context", () => ({
	useAuth: () => ({ isAuthenticated: true, user: { did: "did:plc:test" } }),
}));
vi.mock("#/integrations/posthog/provider", () => ({
	posthog: { capture: vi.fn() },
}));
vi.mock("sonner", () => ({
	toast: { success: mocks.success, warning: mocks.warning, error: mocks.error },
}));
function wrapper({ children }: { children: ReactNode }) {
	return (
		<QueryClientProvider
			client={
				new QueryClient({ defaultOptions: { mutations: { retry: false } } })
			}
		>
			{children}
		</QueryClientProvider>
	);
}
afterEach(() => {
	cleanup();
	vi.resetAllMocks();
});
it("checks completion from the Episode action used by Season rows and Up Next", async () => {
	const before = { showId: "42" };
	mocks.read.mockResolvedValue(before);
	mocks.mark.mockResolvedValue({ data: {} });
	const { result } = renderHook(useMarkEpisodeWatched, { wrapper });
	await act(async () => {
		await result.current.mutateAsync({
			body: { showId: "42", seasonNumber: 3, episodeNumber: 4 },
		});
	});
	expect(mocks.celebrate).toHaveBeenCalledWith(before, 3);
	expect(mocks.mark).toHaveBeenCalledWith(
		expect.objectContaining({ throwOnError: true }),
	);
});
it("does not celebrate a failed Episode write", async () => {
	mocks.mark.mockRejectedValue(new Error("offline"));
	const { result } = renderHook(useMarkEpisodeWatched, { wrapper });
	await act(async () => {
		await expect(
			result.current.mutateAsync({
				body: { showId: "42", seasonNumber: 1, episodeNumber: 2 },
			}),
		).rejects.toThrow("offline");
	});
	expect(mocks.celebrate).not.toHaveBeenCalled();
});
it.each([
	{ count: 2, requested: 2, celebrates: true },
	{ count: 1, requested: 2, celebrates: false },
	{ count: 0, requested: 2, celebrates: false },
])("only checks completion for a full bulk result ($count/$requested)", async ({
	count,
	requested,
	celebrates,
}) => {
	const before = { showId: "42" };
	mocks.read.mockResolvedValue(before);
	mocks.mark.mockResolvedValue({ count, requested });
	const { result } = renderHook(
		() => useWatchActions({ mediaType: "show", showId: "42" }),
		{ wrapper },
	);
	act(() => result.current.markSeasonWatched(3));
	await waitFor(() =>
		expect(
			count === requested ? mocks.success : count ? mocks.warning : mocks.error,
		).toHaveBeenCalled(),
	);
	if (celebrates) expect(mocks.celebrate).toHaveBeenCalledWith(before, 3);
	else expect(mocks.celebrate).not.toHaveBeenCalled();
});
