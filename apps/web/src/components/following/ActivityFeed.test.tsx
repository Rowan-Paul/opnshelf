import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ActivityFeed } from "./ActivityFeed";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children }: { children: React.ReactNode }) => (
		<a href="/fixture">{children}</a>
	),
}));

it("shows ActivityCard-shaped skeletons while the first page loads", () => {
	render(<ActivityFeed activities={[]} isLoading error={null} />);
	expect(screen.getAllByTestId("activity-card-skeleton")).toHaveLength(3);
});

it("uses the shared error copy when the feed fails to load", () => {
	render(
		<ActivityFeed activities={[]} isLoading={false} error={new Error("x")} />,
	);
	expect(screen.getByText("Couldn't load activity.")).toBeTruthy();
});
