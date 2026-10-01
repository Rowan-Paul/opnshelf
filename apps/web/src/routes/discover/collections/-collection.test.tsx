import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationCollectionPage } from "./$id";

const mocks = vi.hoisted(() => ({
	toggle: vi.fn(),
	query: {
		data: undefined as unknown,
		isError: false,
		error: null,
		refetch: vi.fn(),
	},
}));
vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => () => ({ useParams: () => ({ id: "saved" }) }),
	Link: ({
		to,
		children,
		...props
	}: {
		to: string;
		children: React.ReactNode;
	}) => (
		<a href={to} {...props}>
			{children}
		</a>
	),
}));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => mocks.query }));
vi.mock("#/lib/auth-context", () => ({
	useAuth: () => ({
		user: { did: "alice" },
		isAuthenticated: true,
		isLoading: false,
	}),
}));
vi.mock("#/lib/hooks/useListItemStatus", () => ({
	useListItemStatus: () => ({ listsForItem: [], isInWatchlist: false }),
}));
vi.mock("#/lib/hooks/useListActions", () => ({
	useListActions: () => ({ toggleWatchlist: mocks.toggle, isPending: false }),
}));
afterEach(cleanup);

describe("notification collection", () => {
	it("renders every title with its own link and Watchlist action", () => {
		mocks.query.data = {
			id: "saved",
			heading: "This week’s releases",
			periodStart: "2026-09-21",
			periodEnd: "2026-09-27",
			items: [1, 2].map((id) => ({
				mediaId: String(id),
				mediaType: "movie",
				title: `Movie ${id}`,
				posterPath: null,
				overview: "A story",
				releaseDate: null,
				seasonNumber: null,
				path: `/movies/${id}/movie-${id}`,
			})),
		};
		render(<NotificationCollectionPage />);
		expect(
			screen.getByRole("link", { name: "Movie 2" }).getAttribute("href"),
		).toBe("/movies/2/movie-2");
		fireEvent.click(
			screen.getByRole("button", { name: "Add Movie 2 to Watchlist" }),
		);
		expect(mocks.toggle).toHaveBeenCalledWith(false);
		mocks.query.isError = true;
		cleanup();
		render(<NotificationCollectionPage />);
		expect(
			screen.getByRole("heading", { name: "This week’s releases" }),
		).toBeTruthy();
	});
	it("shows a skeleton before content arrives", () => {
		mocks.query.data = undefined;
		mocks.query.isError = false;
		render(<NotificationCollectionPage />);
		expect(
			screen.getByLabelText("Loading notification collection"),
		).toBeTruthy();
	});
	it("opens a recap with Watch totals and episode highlights instead of release actions", () => {
		mocks.query.data = {
			id: "saved",
			heading: "Your September 2026 in review",
			periodStart: "2026-09-01",
			periodEnd: "2026-09-30",
			recap: {
				movieWatches: 1,
				episodeWatches: 2,
				timezone: "Europe/Amsterdam",
				firstWatch: {
					title: "A Show · S1 E2",
					path: "/shows/24/a-show/seasons/1/episodes/2",
					watchedAt: "2026-09-23T12:00:00Z",
				},
				lastWatch: null,
			},
			items: [
				{
					mediaId: "24",
					mediaType: "show",
					title: "A Show",
					posterPath: null,
					overview: "",
					releaseDate: null,
					seasonNumber: null,
					path: "/shows/24/a-show",
					watchCount: 2,
				},
			],
		};
		render(<NotificationCollectionPage />);
		expect(screen.getByText("Movie Watches")).toBeTruthy();
		expect(screen.getByText("Show · 2 episode Watches")).toBeTruthy();
		expect(
			screen.getByRole("link", { name: "A Show · S1 E2" }).getAttribute("href"),
		).toBe("/shows/24/a-show/seasons/1/episodes/2");
		expect(screen.queryByRole("button", { name: /Watchlist/ })).toBeNull();
		expect(screen.queryByText(/Date unavailable/)).toBeNull();
	});
});
