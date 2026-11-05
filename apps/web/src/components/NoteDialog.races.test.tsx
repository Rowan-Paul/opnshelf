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
import { NoteDialog } from "./NoteDialog";

// NoteDialog closes itself when a save succeeds. These pin what a late save
// may and may not do to a dialog the user has since closed or reopened.

const mocks = vi.hoisted(() => ({
	upsert: undefined as unknown as ReturnType<typeof deferredCalls>,
	onOpenChange: vi.fn(),
	onSuccess: vi.fn(),
	toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@opnshelf/api", () => ({
	notesControllerGetNoteOptions: () => ({
		queryKey: ["note"],
		queryFn: () => Promise.resolve(null),
	}),
	notesControllerGetNoteQueryKey: () => ["note"],
	notesControllerGetUserNotesQueryKey: () => ["notes"],
	notesControllerUpsertNoteMutation: () => ({ mutationFn: mocks.upsert.fn }),
	notesControllerDeleteNoteMutation: () => ({ mutationFn: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("#/lib/auth-context", () => ({
	useAuth: () => ({ user: { did: "did:example:one" } }),
}));

function Harness() {
	const [open, setOpen] = useState(false);
	return (
		<>
			<button type="button" onClick={() => setOpen(true)}>
				Open note
			</button>
			<NoteDialog
				open={open}
				onOpenChange={(value) => {
					mocks.onOpenChange(value);
					setOpen(value);
				}}
				mediaType="movie"
				mediaId="m1"
				onSuccess={mocks.onSuccess}
			/>
		</>
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.upsert = deferredCalls();
	render(
		<QueryClientProvider client={new QueryClient()}>
			<Harness />
		</QueryClientProvider>,
	);
});
afterEach(cleanup);

const textarea = () =>
	screen.getByPlaceholderText(
		"Write your thoughts about this...",
	) as HTMLTextAreaElement;
const saveButton = () =>
	screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
const openDialog = () =>
	step(() => fireEvent.click(screen.getByText("Open note")));
const type = (content: string) =>
	step(() => fireEvent.change(textarea(), { target: { value: content } }));
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
	await step(() => mocks.upsert.calls[0].resolve({}));
	expect(isOpen()).toBe(false);
	expect(mocks.onOpenChange).toHaveBeenCalledTimes(1);
});

it("keeps a reopened dialog open and untouched when the earlier save finishes", async () => {
	await openDialog();
	await type("Edited");
	await save();
	await close();
	await openDialog();
	await type("New draft");
	await step(() => mocks.upsert.calls[0].resolve({}));
	expect(isOpen()).toBe(true);
	expect(textarea().value).toBe("New draft");
	expect(mocks.onOpenChange).toHaveBeenCalledTimes(1);
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
	await step(() => mocks.upsert.calls[0].reject(new Error("Network")));
	expect(mocks.upsert.fn).toHaveBeenCalledOnce();
	// Nothing replaced the failed save, so its error is still the user's news.
	expect(mocks.toast.error).toHaveBeenCalledWith("Network");
	expect(isOpen()).toBe(true);
	await waitFor(() => expect(saveButton().disabled).toBe(false));
});
