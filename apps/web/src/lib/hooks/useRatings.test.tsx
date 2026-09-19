import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBatchRatingsQuery } from "./useRatings";

const mocks = vi.hoisted(() => ({ getBatchRatings: vi.fn() }));

vi.mock("@opnshelf/api", () => ({
	ratingsControllerGetBatchRatings: mocks.getBatchRatings,
}));

vi.mock("#/integrations/posthog/provider", () => ({
	posthog: { capture: vi.fn() },
}));

function RatingProbe({ id }: { id: string }) {
	// A fresh array every render, the way a route body builds one.
	const { ratings } = useBatchRatingsQuery([{ id, type: "movie" }]);
	return <output>{ratings.get(id)?.averageRating ?? "loading"}</output>;
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
			body: { mediaType: "movie", mediaIds: ["42"] },
			throwOnError: true,
		});
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
			body: { mediaType: "movie", mediaIds: ["1"] },
			throwOnError: true,
		});
		expect(mocks.getBatchRatings).toHaveBeenCalledWith({
			body: { mediaType: "show", mediaIds: ["2"] },
			throwOnError: true,
		});
	});
});

function MixedProbe() {
	useBatchRatingsQuery([
		{ id: 1, type: "movie" },
		{ id: "1", type: "movie" },
		{ id: 2, type: "show" },
	]);
	return null;
}
