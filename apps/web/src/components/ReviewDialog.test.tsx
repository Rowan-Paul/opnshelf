import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewDialog } from "./ReviewDialog";

const mocks = vi.hoisted(() => ({
	create: vi.fn(),
	update: vi.fn(),
}));

const idleMutation = {
	isPending: false,
	isSuccess: false,
	reset: vi.fn(),
};

vi.mock("@tanstack/react-query", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-query")>()),
	useQuery: () => ({ data: undefined }),
}));

vi.mock("#/lib/auth-context", () => ({
	useAuth: () => ({ user: { did: "did:example:reviewer" } }),
}));

vi.mock("#/lib/hooks/useReviews", () => ({
	useCreateReview: () => ({ ...idleMutation, mutate: mocks.create }),
	useUpdateReview: () => ({ ...idleMutation, mutate: mocks.update }),
}));

vi.mock("#/lib/hooks/useRatings", () => ({
	useRating: () => ({ data: undefined }),
	useSetRating: () => ({ mutate: vi.fn(), isPending: false }),
	useClearRating: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("./MarkdownEditor", () => ({
	default: ({
		value,
		onChange,
	}: {
		value: string;
		onChange: (value: string) => void;
	}) => (
		<textarea
			aria-label="Review body"
			value={value}
			onChange={(event) => onChange(event.target.value)}
		/>
	),
}));

describe("ReviewDialog required fields", () => {
	beforeEach(() => vi.clearAllMocks());
	afterEach(cleanup);

	it("marks the title and review body as required", async () => {
		render(
			<ReviewDialog
				open
				onOpenChange={vi.fn()}
				mediaType="movie"
				mediaId="123"
			/>,
		);
		await screen.findByLabelText("Review body");

		expect(
			screen.getByText(/A title and review body are required/),
		).toBeTruthy();
		expect(screen.getByText("Title", { selector: "label" }).textContent).toBe(
			"Title *",
		);
		expect(screen.getByText("Review", { selector: "span" }).textContent).toBe(
			"Review *",
		);
	});

	it("explains the body requirement before publishing", async () => {
		render(
			<ReviewDialog
				open
				onOpenChange={vi.fn()}
				mediaType="movie"
				mediaId="123"
			/>,
		);
		await screen.findByLabelText("Review body");

		fireEvent.change(screen.getByPlaceholderText("Give your review a title"), {
			target: { value: "A title" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Publish" }));

		expect(screen.getByRole("alert").textContent).toBe(
			"Write your review before publishing.",
		);
		expect(mocks.create).not.toHaveBeenCalled();
	});
});
