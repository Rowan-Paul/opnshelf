import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PosterProgress } from "./PosterProgress";

describe("PosterProgress", () => {
	it.each([0, 47, 100])("renders authoritative %s%% progress", (percentage) => {
		render(
			<div className="relative">
				<PosterProgress
					progress={{
						episodesWatched: percentage,
						episodesTotal: 100,
						percentage,
					}}
					label="Show progress"
				/>
			</div>,
		);

		expect(
			screen
				.getByRole("progressbar", { name: /show progress/i })
				.getAttribute("aria-valuenow"),
		).toBe(String(percentage));
	});

	it("hides progress when there are no aired episodes", () => {
		const { container } = render(
			<PosterProgress
				progress={{ episodesWatched: 0, episodesTotal: 0, percentage: 0 }}
				label="Season progress"
			/>,
		);

		expect(container.innerHTML).toBe("");
	});

	it("reserves the strip while loading without announcing zero progress", () => {
		const { container } = render(
			<PosterProgress label="Show progress" isLoading />,
		);

		expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe(
			"true",
		);
		expect(screen.queryByRole("progressbar")).toBeNull();
	});
});
