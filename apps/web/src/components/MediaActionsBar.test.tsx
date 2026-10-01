import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import MediaActionsBar from "./MediaActionsBar";

const mocks = vi.hoisted(() => ({
	query: vi.fn(() => ({
		data: {
			items: [
				{
					id: "newest",
					reviewTitle: "Latest",
					markdown: "Latest body",
					spoiler: true,
					mirrorToBlog: false,
				},
				{ id: "older", reviewTitle: "Older", markdown: "Older body" },
			],
		},
		isPending: false,
		isError: false,
	})),
	create: vi.fn(),
	update: vi.fn(),
}));
vi.mock("#/lib/auth-context", () => ({
	useAuth: () => ({ user: { did: "did:example:viewer" } }),
}));
vi.mock("#/integrations/posthog/provider", () => ({
	posthog: { capture: vi.fn() },
}));
vi.mock("#/lib/hooks", () => ({
	useLibraryForItem: () => ({ data: [] }),
	useListItemStatus: () => ({ customListsWithStatus: [] }),
	useListActions: () => ({}),
}));
vi.mock("#/lib/hooks/useNotes", () => ({ useNote: () => ({}) }));
vi.mock("#/lib/hooks/useRatings", () => ({
	useRating: () => ({}),
	useSetRating: () => ({}),
	useClearRating: () => ({}),
}));
vi.mock("#/lib/hooks/useReviews", () => ({
	useMediaReviews: mocks.query,
	useCreateReview: () => ({ mutate: mocks.create }),
	useUpdateReview: () => ({ mutate: mocks.update }),
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-query")>()),
	useQuery: () => ({}),
}));
vi.mock("./AddToLibraryDialog", () => ({ default: () => null }));
vi.mock("./ManageListsDialog", () => ({ default: () => null }));
vi.mock("./NoteDialog", () => ({ NoteDialog: () => null }));
vi.mock("./MarkdownEditor", () => ({
	default: ({ value }: { value: string }) => (
		<textarea aria-label="Review body" defaultValue={value} />
	),
}));
afterEach(cleanup);
it("opens the newest author-filtered review from the header and saves an update", async () => {
	render(
		<MediaActionsBar
			mediaType="show"
			mediaId="123"
			seasonNumber={3}
			episodeNumber={2}
		/>,
	);
	expect(mocks.query).toHaveBeenCalledWith({
		authorDid: "did:example:viewer",
		enabled: true,
		mediaType: "show",
		mediaId: "123",
		seasonNumber: 3,
		episodeNumber: 2,
	});
	fireEvent.click(screen.getAllByRole("button", { name: /Rate.*review/i })[0]);
	await screen.findByLabelText("Review body");
	expect(
		(
			screen.getByPlaceholderText(
				"Give your review a title",
			) as HTMLInputElement
		).value,
	).toBe("Latest");
	fireEvent.click(screen.getByRole("button", { name: "Save" }));
	expect(mocks.update).toHaveBeenCalledWith({
		path: { reviewId: "newest" },
		body: {
			title: "Latest",
			markdown: "Latest body",
			spoiler: true,
			mirrorToBlog: false,
		},
	});
	expect(mocks.create).not.toHaveBeenCalled();
});
