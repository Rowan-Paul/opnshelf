import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CommunityReviews from "./CommunityReviews";

const mockUseAuth = vi.fn();
const mockUseMediaReviews = vi.fn();
const mockUseToggleReviewLike = vi.fn();

vi.mock("#/lib/auth-context", () => ({
	useAuth: () => mockUseAuth(),
}));

vi.mock("#/lib/hooks/useReviews", () => ({
	useMediaReviews: (opts: unknown) => mockUseMediaReviews(opts),
	useToggleReviewLike: () => mockUseToggleReviewLike(),
	useDeleteReview: () => ({
		mutate: vi.fn(),
		mutateAsync: vi.fn(),
		isPending: false,
	}),
}));

// The edit dialog (Milkdown + a settings query) is exercised by its own tests;
// stub it here so an own-review card renders without a QueryClient/editor.
vi.mock("./ReviewDialog", () => ({
	ReviewDialog: () => null,
}));

// CommunityReviews uses Link + useLocation from the router. Stub them so the
// component renders without a RouterProvider (otherwise useLocation reads a null
// router context and throws "Cannot read properties of null (reading 'isServer')").
vi.mock("@tanstack/react-router", () => ({
	Link: ({ to, children }: { to?: string; children?: ReactNode }) => (
		<a href={typeof to === "string" ? to : "#"}>{children}</a>
	),
	useLocation: ({
		select,
	}: {
		select?: (loc: { hash: string }) => unknown;
	} = {}) => (select ? select({ hash: "" }) : { hash: "" }),
}));

function review(overrides: Record<string, unknown>) {
	return {
		id: "r1",
		reviewTitle: "A title",
		markdown: "Body text",
		userDid: "did:plc:u1",
		userHandle: "user1",
		userDisplayName: undefined,
		userAvatar: null,
		likeCount: 0,
		hasLiked: false,
		createdAt: new Date().toISOString(),
		...overrides,
	};
}

describe("CommunityReviews", () => {
	afterEach(() => {
		cleanup();
	});

	beforeEach(() => {
		mockUseAuth.mockReturnValue({ user: null });
		mockUseToggleReviewLike.mockReturnValue({
			likeReview: vi.fn(),
			unlikeReview: vi.fn(),
			isLikePending: false,
			isUnlikePending: false,
		});
	});

	it("shows loading state", () => {
		mockUseMediaReviews.mockReturnValue({ data: undefined, isLoading: true });
		render(<CommunityReviews mediaType="movie" mediaId="123" />);
		expect(screen.getByText("Community Reviews")).toBeTruthy();
		expect(
			screen
				.getAllByRole("generic")
				.some((el) => el.className.includes("animate-pulse")),
		).toBe(true);
	});

	it("renders review cards with title and body", () => {
		mockUseMediaReviews.mockReturnValue({
			data: {
				items: [
					review({
						reviewTitle: "Great movie!",
						markdown: "Loved every minute.",
						userDisplayName: "User One",
						likeCount: 3,
					}),
				],
			},
			isLoading: false,
		});

		render(<CommunityReviews mediaType="movie" mediaId="123" />);
		expect(screen.getByText("User One")).toBeTruthy();
		// Handle renders as "@user1 · {time}" in one element, so match a substring.
		expect(screen.getByText(/@user1/)).toBeTruthy();
		expect(screen.getByText("Great movie!")).toBeTruthy();
		expect(screen.getByText("Loved every minute.")).toBeTruthy();
		expect(screen.getByText("3")).toBeTruthy();
	});

	it("clamps a long review and links Read more to the review page", () => {
		const longBody = `${"word ".repeat(120)}END`;
		mockUseMediaReviews.mockReturnValue({
			data: {
				items: [
					review({ markdown: longBody, reviewUrl: "/reviews/user1/rkey1" }),
				],
			},
			isLoading: false,
		});

		render(<CommunityReviews mediaType="movie" mediaId="123" />);
		// Read more opens the review's detail page (no inline expand).
		const link = screen.getByText("Read more");
		expect(link.getAttribute("href")).toBe("/reviews/user1/rkey1");
		expect(screen.queryByText("Show less")).toBeNull();
	});

	it("renders the media poster cover and links the title to the public review URL", () => {
		mockUseMediaReviews.mockReturnValue({
			data: {
				items: [
					review({
						reviewTitle: "Great movie!",
						posterPath: "/abc.jpg",
						reviewUrl: "/reviews/user1/my-rkey",
					}),
				],
			},
			isLoading: false,
		});

		render(<CommunityReviews mediaType="movie" mediaId="123" />);

		const titleLink = screen.getByText("Great movie!").closest("a");
		expect(titleLink).toBeTruthy();
		expect(titleLink?.getAttribute("href")).toBe("/reviews/user1/my-rkey");

		const cover = document.querySelector(
			'img[src="https://image.tmdb.org/t/p/w185/abc.jpg"]',
		);
		expect(cover).toBeTruthy();
	});

	it("shows own review with Your Review badge", () => {
		mockUseAuth.mockReturnValue({ user: { did: "did:plc:me" } });
		mockUseMediaReviews.mockReturnValue({
			data: {
				items: [
					review({
						id: "r2",
						reviewTitle: "Good",
						userDid: "did:plc:u2",
						userHandle: "other",
						likeCount: 2,
					}),
					review({
						id: "r1",
						reviewTitle: "My take",
						userDid: "did:plc:me",
						userHandle: "me",
					}),
				],
			},
			isLoading: false,
		});

		render(<CommunityReviews mediaType="movie" mediaId="123" />);
		expect(screen.getByText("Your Review")).toBeTruthy();
		expect(screen.getByText("My take")).toBeTruthy();
		expect(screen.getByText(/@me\b/)).toBeTruthy();
		expect(screen.getByText("Good")).toBeTruthy();
		expect(screen.getByText(/@other/)).toBeTruthy();
	});

	it("shows empty state with write review button for authenticated users", () => {
		const onAddReview = vi.fn();
		mockUseAuth.mockReturnValue({
			user: { did: "did:plc:me" },
			isAuthenticated: true,
		});
		mockUseMediaReviews.mockReturnValue({
			data: { items: [] },
			isLoading: false,
		});

		render(
			<CommunityReviews
				mediaType="movie"
				mediaId="123"
				onAddReview={onAddReview}
			/>,
		);
		expect(
			screen.getByText("No reviews yet. Be the first to share your thoughts."),
		).toBeTruthy();
		const addButton = screen.getByText("Write a review");
		expect(addButton).toBeTruthy();
		fireEvent.click(addButton);
		expect(onAddReview).toHaveBeenCalled();
	});

	it("shows empty state without write review button for guests", () => {
		mockUseAuth.mockReturnValue({ user: null, isAuthenticated: false });
		mockUseMediaReviews.mockReturnValue({
			data: { items: [] },
			isLoading: false,
		});

		const { container } = render(
			<CommunityReviews mediaType="movie" mediaId="123" />,
		);
		expect(container.textContent).toContain("No reviews yet.");
		expect(screen.queryByText("Write a review")).toBeNull();
	});

	it("shows filled heart when review is liked", () => {
		// Likes are only interactive for a signed-in, non-owner viewer.
		mockUseAuth.mockReturnValue({
			user: { did: "did:plc:viewer" },
			isAuthenticated: true,
		});
		mockUseMediaReviews.mockReturnValue({
			data: { items: [review({ likeCount: 5, hasLiked: true })] },
			isLoading: false,
		});

		render(<CommunityReviews mediaType="movie" mediaId="123" />);
		const likeButton = screen.getByLabelText("Unlike review");
		expect(likeButton).toBeTruthy();
	});

	it("calls likeReview when like button is clicked", () => {
		mockUseAuth.mockReturnValue({
			user: { did: "did:plc:viewer" },
			isAuthenticated: true,
		});
		const likeReview = vi.fn();
		mockUseToggleReviewLike.mockReturnValue({
			likeReview,
			unlikeReview: vi.fn(),
			isLikePending: false,
			isUnlikePending: false,
		});
		mockUseMediaReviews.mockReturnValue({
			data: { items: [review({})] },
			isLoading: false,
		});

		render(<CommunityReviews mediaType="movie" mediaId="123" />);
		const likeButton = screen.getByLabelText("Like review");
		fireEvent.click(likeButton);
		expect(likeReview).toHaveBeenCalledWith("r1");
	});

	it("shares the current media page with this review open", () => {
		mockUseAuth.mockReturnValue({ user: null });
		mockUseMediaReviews.mockReturnValue({
			data: { items: [review({ reviewUrl: "/reviews/user1/rkey1" })] },
			isLoading: false,
		});
		const share = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "share", {
			configurable: true,
			value: share,
		});

		render(<CommunityReviews mediaType="movie" mediaId="123" />);
		fireEvent.click(screen.getByText("Share"));

		expect(share).toHaveBeenCalledWith(
			expect.objectContaining({
				url: `${window.location.origin}/?review=%2Freviews%2Fuser1%2Frkey1`,
			}),
		);
	});
});
