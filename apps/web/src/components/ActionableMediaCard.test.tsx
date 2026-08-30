import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ActionableMediaCard from "./ActionableMediaCard";

const mocks = vi.hoisted(() => ({
	showProgress: {
		episodesWatched: 2,
		episodesTotal: 2,
		state: "complete",
		percentage: 100,
		remainingEpisodes: 0,
	},
	markShowWatched: vi.fn(),
}));

afterEach(() => {
	mocks.showProgress = {
		episodesWatched: 2,
		episodesTotal: 2,
		state: "complete",
		percentage: 100,
		remainingEpisodes: 0,
	};
	mocks.markShowWatched.mockReset();
});

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
		markShowWatched: mocks.markShowWatched,
		isMarkShowPending: false,
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
	useShowProgressForShow: () => ({
		data: {
			items: [{ showId: "1", ...mocks.showProgress, seasons: [] }],
		},
		isLoading: false,
		isError: false,
	}),
}));

describe("ActionableMediaCard Watch count", () => {
	it("renders partial show progress as a percentage", () => {
		mocks.showProgress = {
			episodesWatched: 135,
			episodesTotal: 159,
			state: "partial",
			percentage: 85,
			remainingEpisodes: 24,
		};
		render(
			<ActionableMediaCard id="1" title="Test Show" posterUrl="" type="show" />,
		);

		expect(
			screen.getByRole("button", {
				name: "135 of 159 episodes watched. Mark remaining watched",
			}).textContent,
		).toBe("85%");
	});

	it("confirms before marking the remaining show episodes watched", () => {
		mocks.showProgress = {
			episodesWatched: 135,
			episodesTotal: 159,
			state: "partial",
			percentage: 85,
			remainingEpisodes: 24,
		};
		render(
			<ActionableMediaCard id="1" title="Test Show" posterUrl="" type="show" />,
		);

		fireEvent.click(
			screen.getByRole("button", {
				name: "135 of 159 episodes watched. Mark remaining watched",
			}),
		);

		expect(mocks.markShowWatched).not.toHaveBeenCalled();
		expect(
			screen.getByRole("heading", {
				name: "Mark remaining episodes watched?",
			}),
		).toBeTruthy();
		expect(
			screen.getByText(
				"This will add Watches for the 24 remaining aired episodes of Test Show.",
			),
		).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Mark remaining" }));
		expect(mocks.markShowWatched).toHaveBeenCalledTimes(1);
	});

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
