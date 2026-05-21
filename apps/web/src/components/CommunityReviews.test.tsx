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

vi.mock("./StarRating", () => ({
	default: ({ value }: { value: number }) => (
		<div data-testid="star-rating">{value}</div>
	),
}));

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

	it("renders review cards with correct data", () => {
		mockUseMediaReviews.mockReturnValue({
			data: {
				items: [
					{
						id: "r1",
						rating: 8,
						content: "Great movie!",
						userDid: "did:plc:u1",
						userHandle: "user1",
						userDisplayName: "User One",
						userAvatar: null,
						likeCount: 3,
						hasLiked: false,
						createdAt: new Date().toISOString(),
					},
				],
			},
			isLoading: false,
		});

		render(<CommunityReviews mediaType="movie" mediaId="123" />);
		expect(screen.getByText("User One")).toBeTruthy();
		expect(screen.getByText("@user1")).toBeTruthy();
		expect(screen.getByText("Great movie!")).toBeTruthy();
		expect(screen.getByText("3")).toBeTruthy();
	});

	it("shows own review at the top with Your Review badge", () => {
		mockUseAuth.mockReturnValue({ user: { did: "did:plc:me" } });
		mockUseMediaReviews.mockReturnValue({
			data: {
				items: [
					{
						id: "r2",
						rating: 7,
						content: "Good",
						userDid: "did:plc:u2",
						userHandle: "other",
						likeCount: 2,
						hasLiked: false,
						createdAt: new Date().toISOString(),
					},
					{
						id: "r1",
						rating: 8,
						content: "My take",
						userDid: "did:plc:me",
						userHandle: "me",
						likeCount: 0,
						hasLiked: false,
						createdAt: new Date().toISOString(),
					},
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

	it("shows edit button on own review", () => {
		const onAddReview = vi.fn();
		mockUseAuth.mockReturnValue({ user: { did: "did:plc:me" } });
		mockUseMediaReviews.mockReturnValue({
			data: {
				items: [
					{
						id: "r1",
						rating: 8,
						userDid: "did:plc:me",
						userHandle: "me",
						likeCount: 0,
						hasLiked: false,
						createdAt: new Date().toISOString(),
					},
				],
			},
			isLoading: false,
		});

		render(
			<CommunityReviews
				mediaType="movie"
				mediaId="123"
				onAddReview={onAddReview}
			/>,
		);
		const editButton = screen.getByLabelText("Edit review");
		expect(editButton).toBeTruthy();
		fireEvent.click(editButton);
		expect(onAddReview).toHaveBeenCalled();
	});

	it("shows empty state with add review button for authenticated users", () => {
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
		const addButton = screen.getByText("Add review");
		expect(addButton).toBeTruthy();
		fireEvent.click(addButton);
		expect(onAddReview).toHaveBeenCalled();
	});

	it("shows empty state without add review button for guests", () => {
		mockUseAuth.mockReturnValue({ user: null, isAuthenticated: false });
		mockUseMediaReviews.mockReturnValue({
			data: { items: [] },
			isLoading: false,
		});

		const { container } = render(
			<CommunityReviews mediaType="movie" mediaId="123" />,
		);
		expect(container.textContent).toContain("No reviews yet.");
		expect(screen.queryByText("Add review")).toBeNull();
	});

	it("shows filled heart when review is liked", () => {
		mockUseMediaReviews.mockReturnValue({
			data: {
				items: [
					{
						id: "r1",
						rating: 8,
						content: "Great!",
						userDid: "did:plc:u1",
						userHandle: "user1",
						likeCount: 5,
						hasLiked: true,
						createdAt: new Date().toISOString(),
					},
				],
			},
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
			data: {
				items: [
					{
						id: "r1",
						rating: 8,
						content: "Great!",
						userDid: "did:plc:u1",
						userHandle: "user1",
						likeCount: 0,
						hasLiked: false,
						createdAt: new Date().toISOString(),
					},
				],
			},
			isLoading: false,
		});

		render(<CommunityReviews mediaType="movie" mediaId="123" />);
		const likeButton = screen.getByLabelText("Like review");
		fireEvent.click(likeButton);
		expect(likeReview).toHaveBeenCalledWith("r1");
	});
});
