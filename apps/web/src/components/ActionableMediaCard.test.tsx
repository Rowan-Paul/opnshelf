import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ActionableMediaCard from "./ActionableMediaCard";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children }: { children: React.ReactNode }) => (
		<a href="/">{children}</a>
	),
}));

vi.mock("#/integrations/posthog/provider", () => ({
	posthog: { capture: vi.fn() },
}));

vi.mock("#/lib/auth-context", () => ({
	useAuth: () => ({ userSettings: undefined }),
}));

vi.mock("#/lib/hooks/useWatchActions", () => ({
	useWatchActions: () => ({
		markMovieWatched: vi.fn(),
		unmarkMovieWatched: vi.fn(),
		markEpisodeWatched: vi.fn(),
		unmarkEpisodeWatched: vi.fn(),
	}),
}));

// Three episode Watches of one show: S1E1 twice, S1E2 once. For a whole-show
// card the 3 is the number of records a removal would delete — not a count of
// times the show was watched, which is why it must not reach the badge.
const showWatchHistory = [
	{ seasonNumber: 1, episodeNumber: 1 },
	{ seasonNumber: 1, episodeNumber: 1 },
	{ seasonNumber: 1, episodeNumber: 2 },
];

vi.mock("#/lib/hooks", () => ({
	useListItemStatus: () => ({
		isInWatchlist: false,
		isInFavorites: false,
		otherLists: [],
		customListsWithStatus: [],
		userLists: [],
		listsForItem: [],
	}),
	useListActions: () => ({
		addToList: vi.fn(),
		removeFromList: vi.fn(),
		toggleWatchlist: vi.fn(),
		toggleFavorites: vi.fn(),
		isPending: false,
	}),
	useMediaWatchStatus: () => ({
		isWatched: true,
		isTracking: true,
		movieWatchHistory: showWatchHistory,
		watchHistory: showWatchHistory,
		isEpisodeWatched: () => true,
	}),
}));

describe("ActionableMediaCard Watch count", () => {
	it("states no count on a whole-show card", () => {
		render(
			<ActionableMediaCard id="1" title="Test Show" posterUrl="" type="show" />,
		);

		expect(
			screen.getByRole("button", { name: "Remove from shelf" }).textContent,
		).not.toContain("3");
	});

	it("states that episode's own count on an episode card of the same show", () => {
		render(
			<ActionableMediaCard
				id="1"
				title="Test Show"
				posterUrl=""
				type="show"
				seasonNumber={1}
				episodeNumber={1}
			/>,
		);

		// 2, not the show's 3: S1E1 was watched twice.
		expect(
			screen.getByRole("button", {
				name: "2 watches logged. Remove from shelf",
			}).textContent,
		).toContain("2");
	});

	it("states the count on a movie card", () => {
		render(
			<ActionableMediaCard
				id="1"
				title="Test Movie"
				posterUrl=""
				type="movie"
			/>,
		);

		expect(
			screen.getByRole("button", {
				name: "3 watches logged. Remove from shelf",
			}).textContent,
		).toContain("3");
	});
});
