import { transferableAbortController } from "node:util";
import { client as apiClient, configureApiClient } from "@opnshelf/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { GenreDiscover } from "./GenreDiscover";

const navigate = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigate,
	Link: ({ children }: { children: ReactNode }) => (
		<a href="/search">{children}</a>
	),
}));
vi.mock("#/components/ActionableMediaCard", () => ({
	default: ({ title }: { title: string }) => <div>{title}</div>,
}));
vi.mock("#/lib/hooks/useShowProgress", () => ({
	ShowProgressScope: ({ children }: { children: ReactNode }) => children,
}));
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
	vi.restoreAllMocks();
});

it.each([
	"movies",
	"shows",
] as const)("requests only genre-filtered %s and preserves the filter when paging", async (type) => {
	// Keep AbortSignal in Node’s realm, matching the Request implementation in jsdom.
	vi.stubGlobal("AbortController", transferableAbortController().constructor);
	vi.spyOn(window, "scrollTo").mockImplementation(() => {});
	configureApiClient("http://local.test");
	const fetch = vi.fn(async (_request: RequestInfo | URL) =>
		Response.json({
			items: [
				{
					id: 924,
					title: "Dawn of the Dead",
					name: "Test Show",
					vote_average: 7.5,
				},
			],
			page: 1,
			totalPages: 2,
			hasNextPage: true,
			total: 21,
			pageSize: 20,
		}),
	);
	vi.stubGlobal("fetch", fetch);
	apiClient.setConfig({ fetch });
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={client}>
			<GenreDiscover
				filter={{ type, genre: 27, genreName: "Horror" }}
				page={1}
			/>
		</QueryClientProvider>,
	);
	await screen.findByText(type === "movies" ? "Dawn of the Dead" : "Test Show");
	await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
	const request = fetch.mock.calls[0][0];
	const url = new URL(
		request instanceof Request ? request.url : String(request),
	);
	expect(url.pathname).toBe(`/${type}/discover`);
	expect(url.searchParams.get("genreId")).toBe("27");
	expect(url.searchParams.get("page")).toBe("1");
	fireEvent.click(screen.getByRole("button", { name: "2" }));
	expect(navigate).toHaveBeenCalledWith({
		to: "/search",
		search: { type, genre: 27, genreName: "Horror", page: 2 },
	});
	expect(
		screen.getByRole("link", { name: "Clear genre" }).getAttribute("href"),
	).toBe("/search");
	client.clear();
});
