import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { CalendarSkeleton } from "./skeletons";

it("CalendarSkeleton mirrors a Monday-first month grid", () => {
	render(<CalendarSkeleton />);

	expect(
		screen.getByTestId("calendar-skeleton-weekdays").childElementCount,
	).toBe(7);
	// Five rows of seven cells: the shape a typical month occupies.
	expect(screen.getByTestId("calendar-skeleton-days").childElementCount).toBe(
		35,
	);
});
