import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
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
	}) => {
		const [text, setText] = useState(value);
		return (
			<textarea
				aria-label="Review body"
				value={text}
				onChange={(event) => {
					setText(event.target.value);
					onChange(event.target.value);
				}}
			/>
		);
	},
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

describe("ReviewDialog editing and new review", () => {
	afterEach(cleanup);
	beforeEach(() => vi.clearAllMocks());
	function Editor() {
		const [review, setReview] = useState<
			{ id: string; title: string; markdown: string } | undefined
		>({ id: "latest", title: "Existing", markdown: "Existing body" });
		return (
			<ReviewDialog
				open
				onOpenChange={vi.fn()}
				mediaType="show"
				mediaId="123"
				seasonNumber={3}
				episodeNumber={2}
				review={review}
				onNewReview={() => setReview(undefined)}
			/>
		);
	}
	it("updates the selected review without creating another", async () => {
		render(<Editor />);
		await screen.findByLabelText("Review body");
		fireEvent.click(screen.getByRole("button", { name: "Save" }));
		expect(mocks.update).toHaveBeenCalledWith(
			expect.objectContaining({
				path: { reviewId: "latest" },
				body: expect.objectContaining({
					title: "Existing",
					markdown: "Existing body",
				}),
			}),
		);
		expect(mocks.create).not.toHaveBeenCalled();
	});
	it("protects edits, then clears the editor and creates a new review after confirmation", async () => {
		const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
		render(<Editor />);
		await screen.findByLabelText("Review body");
		fireEvent.change(screen.getByLabelText("Review body"), {
			target: { value: "Unsaved body" },
		});
		fireEvent.click(screen.getByRole("button", { name: "New review" }));
		expect(
			(screen.getByLabelText("Review body") as HTMLTextAreaElement).value,
		).toBe("Unsaved body");
		confirm.mockReturnValue(true);
		fireEvent.click(screen.getByRole("button", { name: "New review" }));
		expect(
			(screen.getByLabelText("Review body") as HTMLTextAreaElement).value,
		).toBe("");
		fireEvent.change(screen.getByPlaceholderText("Give your review a title"), {
			target: { value: "New title" },
		});
		fireEvent.change(screen.getByLabelText("Review body"), {
			target: { value: "New body" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Publish" }));
		expect(mocks.create).toHaveBeenCalledWith({
			body: expect.objectContaining({
				mediaType: "episode",
				mediaId: "123",
				seasonNumber: 3,
				episodeNumber: 2,
				title: "New title",
				markdown: "New body",
			}),
		});
		expect(mocks.update).not.toHaveBeenCalled();
		confirm.mockRestore();
	});
});
