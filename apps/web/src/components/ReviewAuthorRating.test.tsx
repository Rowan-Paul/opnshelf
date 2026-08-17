import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ReviewAuthorRating } from "./ReviewAuthorRating";

describe("ReviewAuthorRating", () => {
	test.each([null, undefined, 0])("hides a missing rating (%s)", (rating) => {
		const { container } = render(<ReviewAuthorRating rating={rating} />);

		expect(container.firstChild).toBeNull();
	});

	test("shows a positive rating", () => {
		render(<ReviewAuthorRating rating={8} />);

		expect(
			screen.getByRole("img", { name: "Rating: 4.0 out of 5" }),
		).toBeTruthy();
	});
});
