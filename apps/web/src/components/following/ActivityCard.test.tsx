import type { FollowedActivityItemDto } from "@opnshelf/api";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ActivityCard } from "./ActivityCard";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children }: { children: React.ReactNode }) => (
		<a href="/fixture">{children}</a>
	),
}));
vi.mock("#/components/FeedItemActions", () => ({ default: () => null }));
vi.mock("#/components/SpoilerShield", () => ({
	SpoilerShield: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("#/components/StarRating", () => ({ default: () => null }));
vi.mock("./UserAvatar", () => ({ UserAvatar: () => null }));

it("expands all episode Watches without hiding their separate times", () => {
	const latest: FollowedActivityItemDto = {
		id: "latest",
		type: "episode",
		actor: {
			did: "alex",
			handle: "alex.test",
			followersCount: 0,
			followingCount: 0,
		},
		showId: "1",
		showTitle: "Severance",
		seasonNumber: 2,
		episodeNumber: 1,
		episodeName: "Hello",
		activityAt: "2026-10-25T10:00:00.000Z",
		createdAt: "2026-10-25T10:00:00.000Z",
	};
	const older = {
		...latest,
		id: "older",
		seasonNumber: 1,
		episodeNumber: 9,
		episodeName: "Goodbye",
		activityAt: "2026-10-25T09:00:00.000Z",
	};
	render(
		<ActivityCard
			activity={latest}
			episodes={[latest, older]}
			userTimezone="UTC"
			userTimeFormat="24h"
		/>,
	);
	expect(screen.getByText("watched 2 episodes of")).toBeTruthy();
	expect(screen.queryByText("S1E9 · Goodbye")).toBeNull();
	const toggle = screen.getByRole("button", { name: "Show episodes" });
	expect(toggle.getAttribute("aria-expanded")).toBe("false");
	fireEvent.click(toggle);
	expect(screen.getByText("S1E9 · Goodbye")).toBeTruthy();
	expect(screen.getByText("S2E1 · Hello")).toBeTruthy();
	expect(
		screen
			.getByRole("button", { name: "Hide episodes" })
			.getAttribute("aria-expanded"),
	).toBe("true");
	fireEvent.click(screen.getByRole("button", { name: "Hide episodes" }));
	expect(screen.queryByText("S1E9 · Goodbye")).toBeNull();
});

const actor = {
	did: "alex",
	handle: "alex.test",
	followersCount: 0,
	followingCount: 0,
};

it("shows the type pill and the show overview on an episode bundle", () => {
	const latest: FollowedActivityItemDto = {
		id: "latest",
		type: "episode",
		actor,
		showId: "1",
		showTitle: "Severance",
		overview: "Office workers split their memories.",
		episodeOverview: "Mark returns.",
		seasonNumber: 2,
		episodeNumber: 1,
		activityAt: "2026-10-25T10:00:00.000Z",
		createdAt: "2026-10-25T10:00:00.000Z",
	};
	render(
		<ActivityCard
			activity={latest}
			episodes={[latest, { ...latest, id: "older", episodeNumber: 2 }]}
			userTimezone="UTC"
		/>,
	);
	expect(screen.getByText("TV")).toBeTruthy();
	expect(screen.getByText("Office workers split their memories.")).toBeTruthy();
	expect(screen.queryByText("Mark returns.")).toBeNull();
});

it("shows a Review's text when it has no Rating", () => {
	render(
		<ActivityCard
			activity={{
				id: "review",
				type: "review",
				actor,
				movieId: "2",
				title: "Arrival",
				overview: "Linguist meets aliens.",
				reviewContent: "Quietly devastating.",
				activityAt: "2026-10-25T10:00:00.000Z",
				createdAt: "2026-10-25T10:00:00.000Z",
			}}
			userTimezone="UTC"
		/>,
	);
	expect(screen.getByText("Movie")).toBeTruthy();
	expect(screen.getByText("Quietly devastating.")).toBeTruthy();
	expect(screen.queryByText("Linguist meets aliens.")).toBeNull();
});
