import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { deferredCalls, step } from "#/test/async-races";
import { ReviewDialog } from "./ReviewDialog";

// ReviewDialog closes itself and scrolls to the review when a save succeeds.
// These pin what a late save may and may not do to a dialog the user has
// since closed or reopened.

const mocks = vi.hoisted(() => ({
	update: undefined as unknown as ReturnType<typeof deferredCalls>,
	onOpenChange: vi.fn(),
	scrollIntoView: vi.fn(),
	toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@opnshelf/api", async (importOriginal) => ({
	...(await importOriginal<typeof import("@opnshelf/api")>()),
	reviewsControllerUpdateReviewMutation: () => ({
		mutationFn: mocks.update.fn,
	}),
	reviewsControllerCreateReviewMutation: () => ({ mutationFn: vi.fn() }),
	usersControllerGetMySettingsOptions: () => ({
		queryKey: ["settings"],
		queryFn: () => Promise.resolve({}),
	}),
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("#/integrations/posthog/provider", () => ({
	posthog: { capture: vi.fn() },
}));
vi.mock("#/lib/auth-context", () => ({
	useAuth: () => ({ user: { did: "did:example:one" } }),
}));
vi.mock("#/lib/hooks/useRatings", () => ({
	useRating: () => ({ data: undefined }),
	useSetRating: () => ({ mutate: vi.fn(), isPending: false }),
	useClearRating: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("./MarkdownEditor", () => ({
	default: ({ value }: { value: string }) => (
		<textarea aria-label="Review body" defaultValue={value} />
	),
}));

const review = { id: "r1", title: "Existing", markdown: "Existing body" };

function Harness() {
	const [open, setOpen] = useState(false);
	return (
		<>
			<div id="community-reviews" />
			<button type="button" onClick={() => setOpen(true)}>
				Edit review
			</button>
			<ReviewDialog
				open={open}
				onOpenChange={(value) => {
					mocks.onOpenChange(value);
					setOpen(value);
				}}
				mediaType="movie"
				mediaId="m1"
				review={review}
			/>
		</>
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.update = deferredCalls();
	Element.prototype.scrollIntoView = mocks.scrollIntoView;
	vi.stubGlobal("requestAnimationFrame", (run: FrameRequestCallback) => {
		run(0);
		return 0;
	});
	render(
		<QueryClientProvider client={new QueryClient()}>
			<Harness />
		</QueryClientProvider>,
	);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const titleInput = () =>
	screen.getByPlaceholderText("Give your review a title") as HTMLInputElement;
const saveButton = () =>
	screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
const openDialog = async () => {
	await step(() => fireEvent.click(screen.getByText("Edit review")));
	await screen.findByLabelText("Review body");
};
const type = (title: string) =>
	step(() => fireEvent.change(titleInput(), { target: { value: title } }));
const save = () => step(() => fireEvent.click(saveButton()));
const close = () =>
	step(() => fireEvent.click(screen.getByRole("button", { name: "Cancel" })));
const isOpen = () => screen.queryByRole("dialog") !== null;

it("does nothing when a save finishes after closing", async () => {
	await openDialog();
	await type("Edited");
	await save();
	await close();
	expect(mocks.onOpenChange).toHaveBeenCalledTimes(1);
	await step(() => mocks.update.calls[0].resolve({}));
	expect(isOpen()).toBe(false);
	expect(mocks.onOpenChange).toHaveBeenCalledTimes(1);
	expect(mocks.scrollIntoView).not.toHaveBeenCalled();
});

it("keeps a reopened dialog open and untouched when the earlier save finishes", async () => {
	await openDialog();
	await type("Edited");
	await save();
	await close();
	await openDialog();
	await type("New draft");
	await step(() => mocks.update.calls[0].resolve({}));
	expect(isOpen()).toBe(true);
	expect(titleInput().value).toBe("New draft");
	expect(mocks.onOpenChange).toHaveBeenCalledTimes(1);
	expect(mocks.scrollIntoView).not.toHaveBeenCalled();
});

it("still closes and scrolls when a save finishes in the same opening", async () => {
	await openDialog();
	await type("Edited");
	await save();
	await step(() => mocks.update.calls[0].resolve({}));
	expect(isOpen()).toBe(false);
	expect(mocks.onOpenChange).toHaveBeenCalledWith(false);
	expect(mocks.scrollIntoView).toHaveBeenCalledOnce();
});

it("blocks a newer save while the earlier one is in flight, so its failure is never stale", async () => {
	await openDialog();
	await type("Older");
	await save();
	await close();
	await openDialog();
	// Unlike Mobile, Web cannot start a newer save to supersede the earlier
	// one: Save stays disabled until it settles.
	expect(saveButton().disabled).toBe(true);
	await step(() => mocks.update.calls[0].reject(new Error("Network")));
	expect(mocks.update.fn).toHaveBeenCalledOnce();
	// Nothing replaced the failed save, so its error is still the user's news,
	// and it never lands in the reopened dialog's own error slot.
	expect(mocks.toast.error).toHaveBeenCalledWith("Network");
	expect(screen.queryByRole("alert")).toBeNull();
	expect(isOpen()).toBe(true);
	await waitFor(() => expect(saveButton().disabled).toBe(false));
});
