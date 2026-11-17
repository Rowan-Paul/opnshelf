import { client } from "@opnshelf/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { useUnmarkEpisodeWatched } from "./useMedia";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("#/lib/auth-context", () => ({ useAuth: () => ({}) }));
vi.mock("#/lib/watch-completion", () => ({}));

const originalConfig = client.getConfig();
afterEach(() => {
	cleanup();
	client.setConfig(originalConfig);
	vi.clearAllMocks();
});

it.each([
	"http",
	"network",
	"success",
])("reports the actual Episode removal outcome: %s", async (outcome) => {
	const fetch = vi.fn(async () => {
		if (outcome === "network") throw new TypeError("Synthetic offline");
		return new Response(
			JSON.stringify(
				outcome === "http" ? { message: "Synthetic failure" } : {},
			),
			{
				status: outcome === "http" ? 503 : 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	});
	client.setConfig({ baseUrl: "http://127.0.0.1:3391", fetch });
	const queryClient = new QueryClient({
		defaultOptions: { mutations: { retry: false } },
	});
	const invalidate = vi.spyOn(queryClient, "invalidateQueries");
	const { result } = renderHook(useUnmarkEpisodeWatched, {
		wrapper: ({ children }: { children: ReactNode }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		),
	});
	await act(async () => {
		const removal = result.current.mutateAsync({
			path: { showId: "1399" },
			query: { seasonNumber: 1, episodeNumber: 1, mode: "latest" },
		});
		if (outcome === "success") await removal;
		else await expect(removal).rejects.toBeDefined();
	});
	expect(fetch).toHaveBeenCalledOnce();
	if (outcome === "success") {
		expect(toast.success).toHaveBeenCalledWith("Episode removed from shelf");
		expect(toast.error).not.toHaveBeenCalled();
		expect(invalidate).toHaveBeenCalled();
	} else {
		expect(toast.success).not.toHaveBeenCalled();
		expect(toast.error).toHaveBeenCalledWith(
			outcome === "http"
				? "Failed to remove episode from shelf"
				: "Synthetic offline",
		);
		expect(invalidate).not.toHaveBeenCalled();
	}
	queryClient.clear();
});
