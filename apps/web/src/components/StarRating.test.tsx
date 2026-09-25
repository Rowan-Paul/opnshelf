import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import StarRating from "./StarRating";

test("uses the clicked star position when no hover event preceded the click", () => {
	const onChange = vi.fn();
	const { container } = render(<StarRating onChange={onChange} />);
	const hitAreas = container.querySelectorAll("button");
	const secondStar = hitAreas[1];

	Object.defineProperty(secondStar, "getBoundingClientRect", {
		value: () => ({ left: 0, width: 20 }),
	});

	// A direct click must not submit the default hover value (zero).
	fireEvent.click(secondStar, { clientX: 15 });

	expect(onChange).toHaveBeenCalledWith(4);
});

test.each([
	1, 5, 8, 10,
])("displays and announces %s out of 10 by default", (value) => {
	render(<StarRating value={value} readOnly />);
	expect(
		screen.getByRole("img", { name: `Rating: ${value} out of 10` }),
	).toBeTruthy();
	expect(screen.getByText(`${value}/10`)).toBeTruthy();
});

test("maps every half-star click to the original 1–10 score", () => {
	const onChange = vi.fn();
	const { container } = render(<StarRating onChange={onChange} />);
	container.querySelectorAll("button").forEach((button, index) => {
		Object.defineProperty(button, "getBoundingClientRect", {
			value: () => ({ left: 0, width: 20 }),
		});
		for (const [clientX, offset] of [
			[5, 1],
			[15, 2],
		]) {
			fireEvent.click(button, { clientX });
			expect(onChange).toHaveBeenLastCalledWith(index * 2 + offset);
		}
	});
});
