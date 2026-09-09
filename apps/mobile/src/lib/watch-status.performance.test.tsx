import { writeFileSync } from "node:fs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, create } from "react-test-renderer";
import { expect, it, vi } from "vitest";
import { useWatchStatus } from "./use-watch-status";

vi.mock("@opnshelf/api", () => ({
	moviesControllerGetMovieWatchHistoryOptions: () => ({
		queryFn: async () => [],
		queryKey: ["movie-history"],
	}),
	moviesControllerGetUserMoviesOptions: () => ({
		queryFn: async () => [],
		queryKey: ["movies"],
	}),
	showsControllerGetShowWatchHistoryOptions: () => ({
		queryFn: async () => [],
		queryKey: ["history"],
	}),
}));
vi.mock("@/lib/auth-context", () => ({
	useAuth: () => ({ isAuthenticated: true, user: { did: "benchmark" } }),
}));
function Row({ episode }: { episode: number }) {
	const status = useWatchStatus({ mediaType: "show", showId: "1" });
	expect(status.isEpisodeWatched?.(1, episode)).toBe(true);
	return null;
}
it.skipIf(!process.env.OPNSHELF_PERF)(
	"benchmarks 200 episode observers over 10,000 Watches",
	() => {
		const samples: number[] = [];
		for (let iteration = 0; iteration < 25; iteration++) {
			const client = new QueryClient({
				defaultOptions: { queries: { staleTime: Infinity, gcTime: Infinity } },
			});
			client.setQueryData(
				["history"],
				Array.from({ length: 10000 }, (_, i) => ({
					seasonNumber: 1,
					episodeNumber: (i % 200) + 1,
					watchedDate: "2026-09-01T00:00:00.000Z",
				})),
			);
			let renderer: ReturnType<typeof create>;
			const start = performance.now();
			act(() => {
				renderer = create(
					<QueryClientProvider client={client}>
						{Array.from({ length: 200 }, (_, i) => i + 1).map((episode) => (
							<Row key={episode} episode={episode} />
						))}
					</QueryClientProvider>,
				);
			});
			const duration = performance.now() - start;
			if (iteration >= 5) samples.push(duration);
			act(() => renderer.unmount());
			client.clear();
		}
		samples.sort((a, b) => a - b);
		const result = {
			workload:
				"200 real useWatchStatus observers, 10000 cached Watches; React test renderer, not native frames",
			samples: 20,
			warmups: 5,
			medianMs: samples[10],
			p95Ms: samples[18],
		};
		console.log(JSON.stringify(result));
		if (process.env.PERF_OUTPUT)
			writeFileSync(process.env.PERF_OUTPUT, JSON.stringify(result, null, 2));
	},
);
