import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
}));

function review(overrides: Record<string, unknown>) {
	return {
		id: "r1",
		title: "A title",
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
						title: "Great movie!",
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
		expect(screen.getByText("@user1")).toBeTruthy();
		expect(screen.getByText("Great movie!")).toBeTruthy();
		expect(screen.getByText("Loved every minute.")).toBeTruthy();
		expect(screen.getByText("3")).toBeTruthy();
	});

	it("shows own review with Your Review badge", () => {
		mockUseAuth.mockReturnValue({ user: { did: "did:plc:me" } });
		mockUseMediaReviews.mockReturnValue({
			data: {
				items: [
					review({
						id: "r2",
						title: "Good",
						userDid: "did:plc:u2",
						userHandle: "other",
						likeCount: 2,
					}),
					review({
						id: "r1",
						title: "My take",
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
		expect(screen.getByText("@me")).toBeTruthy();
		expect(screen.getByText("Good")).toBeTruthy();
		expect(screen.getByText("@other")).toBeTruthy();
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
		mockUseMediaReviews.mockReturnValue({
			data: { items: [review({ likeCount: 5, hasLiked: true })] },
			isLoading: false,
		});

		render(<CommunityReviews mediaType="movie" mediaId="123" />);
		const likeButton = screen.getByLabelText("Unlike review");
		expect(likeButton).toBeTruthy();
	});

	it("calls likeReview when like button is clicked", () => {
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
});
