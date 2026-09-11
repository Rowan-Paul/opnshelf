import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MediaCard from "./MediaCard";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children }: { children: React.ReactNode }) => (
		<a href="/">{children}</a>
	),
}));

vi.mock("#/integrations/posthog/provider", () => ({
	posthog: { capture: vi.fn() },
}));

describe("MediaCard poster metadata", () => {
	it("shows the Watch count inside the watched control", () => {
		render(
			<MediaCard
				id="1"
				title="Test Movie"
				posterUrl="/poster.jpg"
				type="movie"
				isWatched
				watchCount={3}
				onUnmarkWatched={vi.fn()}
			/>,
		);

		expect(
			screen.getByRole("button", {
				name: "3 watches logged. Remove from shelf",
			}).textContent,
		).toContain("3");
	});

	it("shows the Watch count on a read-only watched poster", () => {
		render(
			<MediaCard
				id="1"
				title="Test Movie"
				posterUrl="/poster.jpg"
				type="movie"
				isWatched
				watchCount={3}
			/>,
		);

		expect(screen.getByLabelText("3 watches logged").textContent).toContain(
			"3",
		);
	});

	it.each([
		{ label: "movie title", episodeInfo: undefined, heading: "Test Movie" },
		{
			label: "episode label",
			episodeInfo: "S1E2 · Test",
			heading: "S1E2 · Test",
		},
	])("shows the watched date before the $label", ({ episodeInfo, heading }) => {
		render(
			<MediaCard
				id="1"
				title="Test Movie"
				posterUrl="/poster.jpg"
				type={episodeInfo ? "show" : "movie"}
				episodeInfo={episodeInfo}
				watchedDate="Aug 15, 2026, 10:53"
			/>,
		);

		const date = screen.getByText("Aug 15, 2026, 10:53");
		const title = screen.getByRole("heading", { name: heading });

		expect(date.compareDocumentPosition(title)).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING,
		);
	});

	it("announces the poster bar against the show's episode counts", () => {
		render(
			<MediaCard
				id="1"
				title="Test Show"
				posterUrl="/poster.jpg"
				type="show"
				episodeProgress={{ watched: 3, total: 12, percentage: 25 }}
			/>,
		);

		const bar = screen.getByRole("progressbar", {
			name: "Show progress: 3 of 12 aired episodes watched",
		});

		expect(bar.getAttribute("aria-valuenow")).toBe("25");
	});

	it("omits the poster bar when the card carries no episode progress", () => {
		render(
			<MediaCard
				id="1"
				title="Test Movie"
				posterUrl="/poster.jpg"
				type="movie"
			/>,
		);

		expect(screen.queryByRole("progressbar")).toBeNull();
	});
});
