import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { act, create } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWatchStatus } from "./use-watch-status";

const api = vi.hoisted(() => ({
	getMovieHistory: vi.fn(),
	getShowHistory: vi.fn(),
	getUserMovies: vi.fn(),
}));

vi.mock("@opnshelf/api", () => ({
	moviesControllerGetMovieWatchHistoryOptions: () => ({
		queryKey: ["movie-history"],
		queryFn: api.getMovieHistory,
	}),
	moviesControllerGetUserMoviesOptions: () => ({
		queryKey: ["user-movies"],
		queryFn: api.getUserMovies,
	}),
	showsControllerGetShowWatchHistoryOptions: () => ({
		queryKey: ["show-history"],
		queryFn: api.getShowHistory,
	}),
}));

vi.mock("@/lib/auth-context", () => ({
	useAuth: () => ({ isAuthenticated: true, user: { did: "did:plc:viewer" } }),
}));

function ShowStatusProbe({ skipHistory }: { skipHistory: boolean }) {
	useWatchStatus({ mediaType: "show", showId: "show-1", skipHistory });
	return createElement("show-status-probe" as never);
}

describe("useWatchStatus", () => {
	afterEach(() => {
		api.getMovieHistory.mockReset();
		api.getShowHistory.mockReset();
		api.getUserMovies.mockReset();
	});

	it("does not fetch full show history when aggregate progress owns the surface", async () => {
		api.getShowHistory.mockResolvedValue([]);
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false, gcTime: Infinity } },
		});

		let renderer: ReturnType<typeof create> | undefined;
		act(() => {
			renderer = create(
				<QueryClientProvider client={client}>
					<ShowStatusProbe skipHistory />
				</QueryClientProvider>,
			);
		});
		await act(async () => await Promise.resolve());

		expect(api.getShowHistory).not.toHaveBeenCalled();
		act(() => renderer?.unmount());
		client.clear();
	});

	it("fetches full show history when episode state needs it", async () => {
		api.getShowHistory.mockResolvedValue([]);
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false, gcTime: Infinity } },
		});

		let renderer: ReturnType<typeof create> | undefined;
		act(() => {
			renderer = create(
				<QueryClientProvider client={client}>
					<ShowStatusProbe skipHistory={false} />
				</QueryClientProvider>,
			);
		});
		await act(async () => {
			await vi.waitFor(() =>
				expect(api.getShowHistory).toHaveBeenCalledTimes(1),
			);
		});
		act(() => renderer?.unmount());
		client.clear();
	});
});
