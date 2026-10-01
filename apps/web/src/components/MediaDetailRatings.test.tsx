import { cleanup, render, screen, within } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Route as SeasonRoute } from "../routes/shows/$showId/$showName/seasons.$seasonNumber/index";
import { Route as EpisodeRoute } from "../routes/shows/$showId/$showName/seasons.$seasonNumber.episodes.$episodeNumber";

const state = vi.hoisted(() => ({
	averageRating: undefined as number | undefined,
}));
vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: object) => ({
		options,
		useParams: () => ({
			showId: "226698",
			showName: "conan",
			seasonNumber: "3",
			episodeNumber: "2",
		}),
	}),
	Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock("#/lib/auth-context", () => ({
	useAuth: () => ({ isAuthenticated: false }),
}));
vi.mock("#/lib/hooks/useRatings", () => ({
	useMediaRating: () => ({
		data: {
			averageRating: state.averageRating,
			ratingCount: state.averageRating ? 1 : 0,
		},
	}),
}));
vi.mock("#/lib/hooks", () => ({
	useShowDetails: () => ({ data: { name: "Conan", seasons: [] } }),
	useSeasonDetails: () => ({
		data: { name: "Season 3", season_number: 3, vote_average: 5, episodes: [] },
	}),
	useEpisodeDetails: () => ({
		data: { name: "The Netherlands", vote_average: 5 },
	}),
	useShowProgress: () => ({}),
	useShowWatchHistory: () => ({}),
	useShowRecommendations: () => ({}),
	useShowWatchProviders: () => ({}),
	useWatchActions: () => ({}),
	useEpisodeWatchActions: () => ({}),
	useUserUpNext: () => ({}),
}));
vi.mock("./CommunityReviews", () => ({ default: () => null }));
vi.mock("./FriendWatchers", () => ({ FriendWatchers: () => null }));
vi.mock("./MediaActionsBar", () => ({ default: () => null }));
vi.mock("./ReviewDialog", () => ({ ReviewDialog: () => null }));
vi.mock("./YourActivity", () => ({ YourActivity: () => null }));
vi.mock("./WatchProviders", () => ({ default: () => null }));
vi.mock("./SimilarMediaGrid", () => ({ default: () => null }));
vi.mock("./shows/EpisodeList", () => ({ default: () => null }));
vi.mock("./ProgressShelfButton", () => ({ ProgressShelfButton: () => null }));

afterEach(cleanup);

for (const [name, route] of [
	["Episode", EpisodeRoute],
	["Season", SeasonRoute],
] as const) {
	describe(`${name} rating sources`, () => {
		it.each([
			{ average: 8, expected: "8.0" },
			{ average: undefined, expected: "5.0" },
		])("keeps header and details consistent with average $average", ({
			average,
			expected,
		}) => {
			state.averageRating = average;
			const Page = route.options.component as ComponentType;
			const view = render(<Page />);
			const details = screen
				.getByRole("heading", {
					name: name === "Episode" ? "Episode Details" : "Details",
				})
				.closest("section");
			if (!details) throw new Error("Missing details section");
			expect(within(details).getByText(`${expected}/10`)).toBeTruthy();
			expect(view.container.querySelector(".font-semibold")?.textContent).toBe(
				expected,
			);
		});
	});
}
