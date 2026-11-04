import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { deferredCalls, keyboard, step } from "@/test/async-races";
import { NotesTab } from "./NotesTab";

// The note editor sheet's async owner is NoteCard: it closes the sheet when a
// save succeeds. These pin what a late save may and may not do.

const mocks = vi.hoisted(() => ({
	upsert: undefined as unknown as ReturnType<typeof deferredCalls>,
	toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@opnshelf/api", () => ({
	notesControllerDeleteNoteMutation: () => ({ mutationFn: vi.fn() }),
	notesControllerGetNoteQueryKey: () => ["notes", "item"],
	notesControllerUpsertNoteMutation: () => ({ mutationFn: mocks.upsert.fn }),
}));
vi.mock("react-native-keyboard-controller", async () =>
	(await import("@/test/async-races")).keyboardControllerMock(),
);
vi.mock("@/components/ui/bottom-sheet-modal", () => ({
	BottomSheetModal: "modal",
}));
vi.mock("@/components/detail/NoteEditorSheet", async () => ({
	NoteEditorSheet: await (
		await import("@/test/async-races")
	).keyboardSheetStandIn("note-editor"),
}));
vi.mock("@/lib/use-note", () => ({ invalidateUserNotesQueries: vi.fn() }));
vi.mock("@/components/ui/dialog", () => ({
	useDialog: () => ({ showDialog: vi.fn() }),
}));
vi.mock("@/components/ui/toast", () => ({ useToast: () => mocks.toast }));
vi.mock("@/lib/use-public-profile", () => ({
	useInfiniteProfileNotes: () => ({
		data: {
			pages: [
				{
					items: [
						{
							id: "1",
							mediaType: "movie",
							mediaId: "m1",
							mediaLabel: "First",
							content: "First content",
							updatedAt: "2026-07-20T00:00:00.000Z",
							posterPath: null,
						},
					],
				},
			],
		},
		isLoading: false,
		isError: false,
		fetchNextPage: vi.fn(),
		hasNextPage: false,
		isFetchingNextPage: false,
	}),
}));
vi.mock("@/lib/use-end-reached", () => ({ useEndReached: () => {} }));
vi.mock("react-native", () => ({
	ActivityIndicator: "activity-indicator",
	Pressable: "pressable",
	View: "view",
}));
vi.mock("lucide-react-native", () => ({
	Pencil: "icon",
	StickyNote: "icon",
	Trash2: "icon",
}));
vi.mock("@/components/profile/ProfileContentCard", () => ({
	ProfileContentCard: ({ headerRight }: { headerRight: never }) => headerRight,
}));
vi.mock("@/components/ui/load-more", () => ({
	canLoadMore: () => false,
	LoadMoreFooter: () => null,
}));
vi.mock("@/components/ui/skeletons", () => ({ ReviewsSkeleton: () => null }));
vi.mock("@/components/ui/states", () => ({
	EmptyState: () => null,
	ErrorState: () => null,
}));
vi.mock("@/components/ui/text", () => ({ Text: "text" }));
vi.mock("@/lib/media-href", () => ({ mediaHref: () => "/media" }));

let view: ReactTestRenderer;
beforeEach(async () => {
	vi.clearAllMocks();
	mocks.upsert = deferredCalls();
	const client = new QueryClient();
	await step(() => {
		view = create(
			<QueryClientProvider client={client}>
				<NotesTab userDid="did:one" isOwner />
			</QueryClientProvider>,
		);
	});
});
afterEach(() => act(() => view.unmount()));

const shown = () => view.root.findByType("modal" as never).props.visible;
const editor = () => view.root.findByType("note-editor" as never).props;
const openEditor = () =>
	step(() =>
		view.root
			.findAllByType("pressable" as never)
			.find((node) => node.props.accessibilityLabel === "Edit note")
			?.props.onPress(),
	);
const save = (content: string) => step(() => editor().onSave(content));
const close = () => step(() => editor().onDismiss());

it("does nothing to the keyboard when a save finishes after closing", async () => {
	await openEditor();
	await save("Edited");
	await close();
	expect(keyboard.dismiss).toHaveBeenCalledOnce();
	await step(() => mocks.upsert.calls[0].resolve({}));
	expect(shown()).toBe(false);
	expect(keyboard.dismiss).toHaveBeenCalledOnce();
});

it("keeps a reopened editor open when the earlier save finishes", async () => {
	await openEditor();
	await save("Edited");
	await close();
	await openEditor();
	await step(() => mocks.upsert.calls[0].resolve({}));
	expect(editor().visible).toBe(true);
	expect(shown()).toBe(true);
	expect(keyboard.dismiss).toHaveBeenCalledOnce();
});

it("shows no error when an earlier save fails after a newer one succeeded", async () => {
	await openEditor();
	await save("Older");
	await close();
	await openEditor();
	// The Save button is disabled while the earlier save is in flight…
	expect(editor().isSaving).toBe(true);
	// …and even a newer save that gets through supersedes it.
	await save("Newer");
	await step(() => mocks.upsert.calls[1].resolve({}));
	await step(() => mocks.upsert.calls[0].reject(new Error("Network")));
	expect(mocks.toast.error).not.toHaveBeenCalled();
	expect(shown()).toBe(false);
});
