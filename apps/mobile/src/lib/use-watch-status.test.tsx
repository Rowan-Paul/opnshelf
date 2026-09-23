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

vi.mock("@opnshelf/api", async (importOriginal) => ({
	movieWatchCount: (await importOriginal<typeof import("@opnshelf/api")>())
		.movieWatchCount,
	moviesControllerGetMovieWatchHistoryOptions: () => ({
		queryKey: ["movie-history"],
		queryFn: api.getMovieHistory,
	}),
	moviesControllerGetUserMovieWatchCountsOptions: () => ({
		queryKey: ["movie-watch-counts"],
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

let movieStatus: ReturnType<typeof useWatchStatus> | undefined;
function MovieStatusProbe() {
	movieStatus = useWatchStatus({
		mediaType: "movie",
		movieId: "550",
		skipHistory: true,
	});
	return createElement("movie-status-probe" as never);
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

	it("reads a poster's watch count from the shared counts, without its history", async () => {
		api.getUserMovies.mockResolvedValue([{ movieId: "550", watchCount: 3 }]);
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false, gcTime: Infinity } },
		});

		let renderer: ReturnType<typeof create> | undefined;
		act(() => {
			renderer = create(
				<QueryClientProvider client={client}>
					<MovieStatusProbe />
				</QueryClientProvider>,
			);
		});
		await act(async () => {
			await vi.waitFor(() => expect(movieStatus?.isWatched).toBe(true));
		});

		expect(api.getMovieHistory).not.toHaveBeenCalled();
		expect(movieStatus?.totalMovieWatches).toBe(3);
		act(() => renderer?.unmount());
	});
});
