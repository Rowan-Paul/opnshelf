import { fireEvent, render } from "@testing-library/react";
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
