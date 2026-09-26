import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RatingDialog } from "./RatingDialog";

const mutations = vi.hoisted(() => ({ set: vi.fn(), clear: vi.fn() }));
vi.mock("#/lib/hooks/useRatings", () => ({
	useRating: () => ({ data: { id: "rating-1", rating: 9 } }),
	useSetRating: () => ({ mutate: mutations.set, isPending: false }),
	useClearRating: () => ({ mutate: mutations.clear, isPending: false }),
}));
afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("RatingDialog scale", () => {
	it("shows the stored score out of 10 and submits half-star choices unchanged", () => {
		render(
			<RatingDialog
				open
				onOpenChange={vi.fn()}
				userDid="did:example:alice"
				mediaType="show"
				mediaId="123"
				seasonNumber={2}
				episodeNumber={3}
			/>,
		);
		expect(screen.getByText("9")).toBeTruthy();
		expect(screen.getByText("/10")).toBeTruthy();
		const slider = screen.getByRole("slider", { name: "Set rating" });
		expect(slider.getAttribute("aria-valuetext")).toBe("9 out of 10");
		fireEvent.keyDown(slider, { key: "ArrowRight" });
		expect(mutations.set).toHaveBeenCalledWith({
			body: {
				mediaType: "episode",
				mediaId: "123",
				seasonNumber: 2,
				episodeNumber: 3,
				rating: 10,
			},
		});
		fireEvent.click(screen.getByRole("button", { name: "Clear rating" }));
		expect(mutations.clear).toHaveBeenCalledWith(
			{ path: { ratingId: "rating-1" } },
			expect.any(Object),
		);
	});
});
