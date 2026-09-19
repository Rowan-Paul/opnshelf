import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBatchRatingsQuery } from "./useRatings";

const mocks = vi.hoisted(() => ({ getBatchRatings: vi.fn() }));

// Stands in for the generated `queryOptions`: an id-keyed key plus a queryFn
// that calls the GET. The hook must supply both from the batch it asked for.
vi.mock("@opnshelf/api", () => ({
	ratingsControllerGetBatchRatingsOptions: (options: {
		query: { mediaType: "movie" | "show"; mediaIds: string[] };
	}) => ({
		queryKey: [
			{ _id: "ratingsControllerGetBatchRatings", query: options.query },
		],
		queryFn: async () => {
			const { data } = await mocks.getBatchRatings({
				...options,
				throwOnError: true,
			});
			return data;
		},
	}),
}));

vi.mock("#/integrations/posthog/provider", () => ({
	posthog: { capture: vi.fn() },
}));

function RatingProbe({ id }: { id: string }) {
	// A fresh array every render, the way a route body builds one.
	const { ratingFor } = useBatchRatingsQuery([{ id, type: "movie" }]);
	return <output>{ratingFor("movie", id)?.averageRating ?? "loading"}</output>;
}

function createQueryClient() {
	return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("useBatchRatingsQuery", () => {
	afterEach(() => {
		cleanup();
		mocks.getBatchRatings.mockReset();
	});

	it("reuses one request across renders that rebuild the items array", async () => {
		mocks.getBatchRatings.mockResolvedValue({
			data: { items: [{ mediaId: "42", averageRating: 8, ratingCount: 3 }] },
		});
		const client = createQueryClient();

		const view = render(
			<QueryClientProvider client={client}>
				<RatingProbe id="42" />
			</QueryClientProvider>,
		);
		await waitFor(() =>
			expect(screen.getByRole("status").textContent).toBe("8"),
		);

		view.rerender(
			<QueryClientProvider client={client}>
				<RatingProbe id="42" />
			</QueryClientProvider>,
		);

		expect(mocks.getBatchRatings).toHaveBeenCalledTimes(1);
		expect(mocks.getBatchRatings).toHaveBeenCalledWith({
			query: { mediaType: "movie", mediaIds: ["42"] },
			throwOnError: true,
		});
	});

	it("keeps a movie and a show that share a TMDB id apart", async () => {
		mocks.getBatchRatings.mockImplementation(({ query }) =>
			Promise.resolve({
				data: {
					items: [
						{
							mediaId: "550",
							averageRating: query.mediaType === "movie" ? 8 : 4,
							ratingCount: 1,
						},
					],
				},
			}),
		);

		render(
			<QueryClientProvider client={createQueryClient()}>
				<CollisionProbe />
			</QueryClientProvider>,
		);

		await waitFor(() =>
			expect(screen.getByRole("status").textContent).toBe("8/4"),
		);
	});

	it("asks for movies and shows separately, deduped", async () => {
		mocks.getBatchRatings.mockResolvedValue({ data: { items: [] } });

		render(
			<QueryClientProvider client={createQueryClient()}>
				<MixedProbe />
			</QueryClientProvider>,
		);

		await waitFor(() => expect(mocks.getBatchRatings).toHaveBeenCalledTimes(2));
		expect(mocks.getBatchRatings).toHaveBeenCalledWith({
			query: { mediaType: "movie", mediaIds: ["1"] },
			throwOnError: true,
		});
		expect(mocks.getBatchRatings).toHaveBeenCalledWith({
			query: { mediaType: "show", mediaIds: ["2"] },
			throwOnError: true,
		});
	});
});

function CollisionProbe() {
	const { ratingFor } = useBatchRatingsQuery([
		{ id: "550", type: "movie" },
		{ id: "550", type: "show" },
	]);
	return (
		<output>
			{`${ratingFor("movie", "550")?.averageRating ?? "-"}/${
				ratingFor("show", "550")?.averageRating ?? "-"
			}`}
		</output>
	);
}

function MixedProbe() {
	useBatchRatingsQuery([
		{ id: 1, type: "movie" },
		{ id: "1", type: "movie" },
		{ id: 2, type: "show" },
	]);
	return null;
}
