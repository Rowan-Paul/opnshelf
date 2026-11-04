import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { deferredCalls, keyboard, step } from "@/test/async-races";
import { OwnListsScreen } from "./OwnListsScreen";

// The list editor sheet closes as soon as a list is submitted; the create
// finishes in the background. These pin what a late create may and may not do.

const mocks = vi.hoisted(() => ({
	createList: undefined as unknown as ReturnType<typeof deferredCalls>,
	toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@opnshelf/api", async (importOriginal) => ({
	...(await importOriginal<typeof import("@opnshelf/api")>()),
	listsControllerCreateListMutation: () => ({
		mutationFn: mocks.createList.fn,
	}),
}));
vi.mock("react-native-keyboard-controller", async () =>
	(await import("@/test/async-races")).keyboardControllerMock(),
);
vi.mock("@/components/ui/bottom-sheet-modal", () => ({
	BottomSheetModal: "modal",
}));
vi.mock("@/components/lists/ListEditorSheet", async () => ({
	ListEditorSheet: await (
		await import("@/test/async-races")
	).keyboardSheetStandIn("list-editor"),
}));
vi.mock("@/lib/use-lists", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/use-lists")>()),
	useUserLists: () => ({
		data: [],
		isLoading: false,
		isError: false,
		isRefetching: false,
		refetch: vi.fn(),
	}),
}));
vi.mock("@/components/ui/toast", () => ({ useToast: () => mocks.toast }));
vi.mock("@/lib/auth-context", () => ({
	useAuth: () => ({ user: { did: "did:one" } }),
}));
vi.mock("@/lib/posthog", () => ({ posthog: undefined }));
vi.mock("expo-haptics", () => ({}));
vi.mock("@/lib/use-tw-style", () => ({ useTwStyle: () => ({}) }));
vi.mock("@shopify/flash-list", () => ({ FlashList: () => null }));
vi.mock("expo-router", () => ({
	// Renders the header's buttons so the test can press "+".
	Stack: {
		Screen: ({ options }: { options: { headerRight: () => ReactNode } }) =>
			options.headerRight(),
	},
}));
vi.mock("react-native", () => ({
	Pressable: "pressable",
	RefreshControl: "refresh",
	View: "view",
}));
vi.mock("lucide-react-native", () => ({ ListPlus: "icon", Plus: "icon" }));
vi.mock("@/components/lists/ListSummaryRow", () => ({
	ListSummaryRow: () => null,
}));
vi.mock("@/components/lists/ListsSortSheet", () => ({
	ListsSortButton: () => null,
	ListsSortSheet: () => null,
}));
vi.mock("@/components/ui/skeletons", () => ({
	ListSummaryRowsSkeleton: () => null,
}));
vi.mock("@/components/ui/states", () => ({
	EmptyState: () => null,
	ErrorState: () => null,
}));

let view: ReactTestRenderer;
beforeEach(async () => {
	vi.clearAllMocks();
	mocks.createList = deferredCalls();
	const client = new QueryClient();
	await step(() => {
		view = create(
			<QueryClientProvider client={client}>
				<OwnListsScreen handle="one" />
			</QueryClientProvider>,
		);
	});
});
afterEach(() => act(() => view.unmount()));

const shown = () => view.root.findByType("modal" as never).props.visible;
const editor = () => view.root.findByType("list-editor" as never).props;
const openEditor = () =>
	step(() => view.root.findByType("pressable" as never).props.onPress());
// Saving closes the sheet at once; the create keeps running.
const save = (name: string) => step(() => editor().onSave({ name }));

it("does nothing to the keyboard when a create finishes after closing", async () => {
	await openEditor();
	await save("Older");
	expect(shown()).toBe(false);
	expect(keyboard.dismiss).toHaveBeenCalledOnce();
	await step(() => mocks.createList.calls[0].resolve({}));
	expect(shown()).toBe(false);
	expect(keyboard.dismiss).toHaveBeenCalledOnce();
	expect(mocks.toast.success).toHaveBeenCalledWith("List created");
});

it("keeps a reopened editor open when the earlier create finishes", async () => {
	await openEditor();
	await save("Older");
	await openEditor();
	await step(() => mocks.createList.calls[0].resolve({}));
	expect(editor().visible).toBe(true);
	expect(shown()).toBe(true);
	expect(keyboard.dismiss).toHaveBeenCalledOnce();
});

it("still reports an earlier create that fails after a newer one succeeded", async () => {
	await openEditor();
	await save("Older");
	await openEditor();
	// The Save button is disabled while the earlier create is in flight.
	expect(editor().isSaving).toBe(true);
	await save("Newer");
	await step(() => mocks.createList.calls[1].resolve({}));
	// Each create is its own List, so the newer one does not replace it: the
	// user must hear that the earlier List was not created.
	await step(() => mocks.createList.calls[0].reject(new Error("Network")));
	expect(mocks.toast.error).toHaveBeenCalledWith("Network");
	expect(shown()).toBe(false);
	expect(keyboard.dismiss).toHaveBeenCalledTimes(2);
});
