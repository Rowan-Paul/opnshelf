import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { ProfileReviewRating } from "./ProfileReviewRating";

vi.mock("@/components/detail/StarRating", async () => {
	const { createElement } = await import("react");
	return {
		StarRating: (props: Record<string, unknown>) =>
			createElement("star-rating", props),
	};
});

function render(authorRating?: number | null) {
	let renderer!: ReactTestRenderer;
	act(() => {
		renderer = create(<ProfileReviewRating authorRating={authorRating} />);
	});
	return renderer;
}

describe("ProfileReviewRating", () => {
	it("shows a positive author rating", () => {
		const rating = render(8).root.findByType("star-rating" as never);

		expect(rating.props.rating).toBe(8);
		expect(rating.props.size).toBe(14);
	});

	it.each([null, 0, undefined])("hides an absent rating for %s", (value) => {
		expect(render(value).toJSON()).toBeNull();
	});
});
