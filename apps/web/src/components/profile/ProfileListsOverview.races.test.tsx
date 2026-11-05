import {
	QueryClient,
	QueryClientProvider,
	useMutation,
} from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { deferredCalls, step } from "#/test/async-races";
import { ProfileListsOverview } from "./ProfileListsOverview";

// The Create List dialog closes itself and opens the new List when a create
// succeeds. These pin what a late create may and may not do to a dialog the
// user has since closed or reopened.

const mocks = vi.hoisted(() => ({
	create: undefined as unknown as ReturnType<typeof deferredCalls>,
	navigate: vi.fn(),
	toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@opnshelf/api", () => ({
	listsControllerGetPublicUserListsOptions: () => ({
		queryKey: ["lists"],
		queryFn: () => Promise.resolve([]),
	}),
}));
vi.mock("@tanstack/react-router", () => ({
	Link: () => null,
	useNavigate: () => mocks.navigate,
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("#/lib/hooks", () => ({
	useCreateList: () =>
		useMutation({
			mutationKey: ["lists", "create"],
			mutationFn: mocks.create.fn,
		}),
}));

beforeEach(() => {
	vi.clearAllMocks();
	mocks.create = deferredCalls();
	render(
		<QueryClientProvider client={new QueryClient()}>
			<ProfileListsOverview userDid="did:example:one" handle="one" isOwner />
		</QueryClientProvider>,
	);
});
afterEach(cleanup);

const nameInput = () =>
	screen.getByPlaceholderText("My Awesome List") as HTMLInputElement;
// With no Lists yet, the empty state's "Create List" opens the dialog. While
// the dialog is open the page behind it is hidden, so the same name then
// finds the dialog's own button.
const openDialog = async () => {
	const trigger = await screen.findByRole("button", { name: "Create List" });
	await step(() => fireEvent.click(trigger));
};
const type = (name: string) =>
	step(() => fireEvent.change(nameInput(), { target: { value: name } }));
const create = () =>
	step(() =>
		fireEvent.click(screen.getByRole("button", { name: "Create List" })),
	);
const close = () =>
	step(() => fireEvent.click(screen.getByRole("button", { name: "Cancel" })));
const isOpen = () => screen.queryByRole("dialog") !== null;

it("does nothing when a create finishes after closing", async () => {
	await openDialog();
	await type("Older");
	await create();
	await close();
	await step(() => mocks.create.calls[0].resolve({ slug: "older" }));
	expect(isOpen()).toBe(false);
	expect(mocks.navigate).not.toHaveBeenCalled();
});

it("keeps a reopened dialog open and untouched when the earlier create finishes", async () => {
	await openDialog();
	await type("Older");
	await create();
	await close();
	await openDialog();
	await type("New draft");
	await step(() => mocks.create.calls[0].resolve({ slug: "older" }));
	expect(isOpen()).toBe(true);
	expect(nameInput().value).toBe("New draft");
	expect(mocks.navigate).not.toHaveBeenCalled();
});

it("still reports an earlier create that fails after closing", async () => {
	await openDialog();
	await type("Older");
	await create();
	await close();
	await step(() => mocks.create.calls[0].reject(new Error("Network")));
	// Each create is its own List, so a failure is news even once closed.
	expect(mocks.toast.error).toHaveBeenCalledWith("Network");
});

it("opens a fresh dialog after a create finished while closed", async () => {
	await openDialog();
	await type("Older");
	await create();
	await close();
	await step(() => mocks.create.calls[0].resolve({ slug: "older" }));
	await openDialog();
	expect(nameInput().value).toBe("");
});

it("still closes and opens the new List when a create finishes in the same opening", async () => {
	await openDialog();
	await type("Older");
	await create();
	await step(() => mocks.create.calls[0].resolve({ slug: "older" }));
	expect(isOpen()).toBe(false);
	expect(mocks.navigate).toHaveBeenCalledWith(
		expect.objectContaining({ params: { handle: "one", listSlug: "older" } }),
	);
});
