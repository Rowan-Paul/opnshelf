import { cleanup, render } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Route } from "./index";

const state = vi.hoisted(() => ({
	averageRating: undefined as number | undefined,
	voteAverage: undefined as number | undefined,
	timezone: undefined as string | undefined,
}));
vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: object) => ({
		options,
		useParams: () => ({ movieId: "1", movieName: "fixture-film-1" }),
	}),
	Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
	useNavigate: () => vi.fn(),
}));
vi.mock("#/lib/auth-context", () => ({
	useAuth: () => ({
		isAuthenticated: false,
		userSettings: { timezone: state.timezone },
	}),
}));
vi.mock("#/lib/hooks/useRatings", () => ({
	useMediaRating: () => ({
		data: { averageRating: state.averageRating, ratingCount: 0 },
	}),
}));
vi.mock("#/lib/hooks", () => ({
	useMovieDetails: () => ({
		data: {
			id: 1,
			title: "Fixture film",
			release_date: "2026-01-01",
			vote_average: state.voteAverage,
		},
	}),
	useMovieRecommendations: () => ({}),
	useMediaWatchStatus: () => ({}),
	useMovieWatchProviders: () => ({}),
	useWatchActions: () => ({}),
}));
vi.mock("../../../../components/CommunityReviews", () => ({
	default: () => null,
}));
vi.mock("../../../../components/FriendWatchers", () => ({
	FriendWatchers: () => null,
}));
vi.mock("../../../../components/MediaActionsBar", () => ({
	default: () => null,
}));
vi.mock("../../../../components/ReviewDialog", () => ({
	ReviewDialog: () => null,
}));
vi.mock("../../../../components/YourActivity", () => ({
	YourActivity: () => null,
}));
vi.mock("../../../../components/WatchProviders", () => ({
	default: () => null,
}));
vi.mock("../../../../components/SimilarMediaGrid", () => ({
	default: () => null,
}));

afterEach(() => {
	state.timezone = undefined;
	cleanup();
});

it("hydrates the catalogue release day across server and user timezones", () => {
	const Page = Route.options.component as ComponentType;
	const container = document.createElement("div");
	container.innerHTML = renderToString(<Page />);
	state.timezone = "America/Los_Angeles";
	const onRecoverableError = vi.fn();
	const view = render(<Page />, {
		container,
		hydrate: true,
		onRecoverableError,
	});
	expect(view.getAllByText("January 1, 2026")).toHaveLength(2);
	expect(onRecoverableError).not.toHaveBeenCalled();
});

describe("Movie hero rating", () => {
	it.each([
		{ average: 8, vote: 6.4, expected: "8.0" },
		{ average: undefined, vote: 6.4, expected: "6.4" },
		{ average: undefined, vote: undefined, expected: "N/A" },
	])("shows $expected for average $average and TMDB $vote", ({
		average,
		vote,
		expected,
	}) => {
		state.averageRating = average;
		state.voteAverage = vote;
		const Page = Route.options.component as ComponentType;
		const view = render(<Page />);
		expect(view.container.querySelector(".font-semibold")?.textContent).toBe(
			expected,
		);
		expect(view.container.textContent).not.toContain("NaN");
	});
});
