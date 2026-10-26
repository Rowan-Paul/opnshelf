import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProfileListsPage } from "./ProfileListsPage";

vi.mock("#/components/settings/PrivacySection", () => ({
	PrivacySection: () => null,
}));

const mocks = vi.hoisted(() => ({
	mutate: vi.fn(),
	uri: undefined as string | undefined,
	empty: false,
}));
const { mutate } = mocks;
vi.mock("@tanstack/react-query", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-query")>()),
	useQuery: () => ({
		data: {
			name: "Test list",
			uri: mocks.uri,
			updatedAt: "2026-09-01",
			total: mocks.empty ? 0 : 4,
			items: mocks.empty
				? []
				: [
						...["Alpha", "Beta", "Gamma"].map((title) => ({
							id: title,
							mediaType: "movie",
							media: { title },
						})),
						{
							id: "Delta",
							mediaType: "episode",
							media: { name: "Stranger Things" },
							seasonNumber: 1,
							episodeNumber: 2,
							episodeName: "Chapter Two",
						},
					],
		},
	}),
	useMutation: () => ({ mutate }),
	useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@tanstack/react-router", () => ({
	Link: ({ children }: { children: React.ReactNode }) => (
		<span>{children}</span>
	),
	useNavigate: () => vi.fn(),
}));
vi.mock("#/lib/auth-context", () => ({
	useAuth: () => ({ isAuthenticated: true }),
}));
vi.mock("#/integrations/posthog/provider", () => ({
	posthog: { capture: vi.fn() },
}));
vi.mock("#/components/AddListItemsDialog", () => ({ default: () => null }));
vi.mock("../../components/ActionableMediaCard", () => ({
	default: () => null,
}));
vi.mock("#/lib/hooks", () => ({
	ShowProgressScope: ({ children }: { children: React.ReactNode }) => children,
}));
afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	mutate.mockClear();
	mocks.uri = undefined;
	mocks.empty = false;
});

it.each([
	["pointerup", ["Beta", "Gamma", "Alpha", "Delta"]],
	["pointercancel", ["Alpha", "Beta", "Gamma", "Delta"]],
	["lostpointercapture", ["Alpha", "Beta", "Gamma", "Delta"]],
])("handles touch drag ending with %s", (ending, ids) => {
	render(
		<ProfileListsPage
			userDid="did:test"
			handle="test"
			selectedListSlug="test"
			isOwner
		/>,
	);
	fireEvent.click(screen.getByRole("button", { name: "Reorder" }));
	const source = screen.getByText("Alpha").parentElement;
	const target = screen.getByText("Gamma").parentElement;
	if (!source || !target) throw new Error("Missing reorder cards");
	Object.defineProperty(document, "elementFromPoint", {
		configurable: true,
		value: vi.fn(() => target),
	});
	source.setPointerCapture = vi.fn();
	source.releasePointerCapture = vi.fn();
	// jsdom has no PointerEvent constructor; supply the pointer fields on the event.
	const touch = (type: string) => {
		const event = new MouseEvent(type, {
			bubbles: true,
			clientX: 200,
			clientY: 100,
		});
		Object.defineProperties(event, {
			pointerId: { value: 1 },
			pointerType: { value: "touch" },
			isPrimary: { value: true },
		});
		fireEvent(source, event);
	};
	touch("pointerdown");
	touch("pointermove");
	touch(ending);
	// A release after cancellation must not complete the stale drag.
	if (ending !== "pointerup") touch("pointerup");
	fireEvent.click(screen.getByRole("button", { name: "Done" }));
	expect(mutate).toHaveBeenCalledWith({
		path: { slug: "test" },
		body: { ids },
	});
});

it("keeps the episode scope on reorder cards", () => {
	render(
		<ProfileListsPage
			userDid="did:test"
			handle="test"
			selectedListSlug="test"
			isOwner
		/>,
	);
	fireEvent.click(screen.getByRole("button", { name: "Reorder" }));
	// getBy* throws when it finds nothing, so these are the assertions.
	screen.getByText("S1E2 — Chapter Two");
	screen.getByText("Stranger Things");
	screen.getByRole("button", {
		name: "Move Stranger Things S1E2 — Chapter Two earlier",
	});
});

it.each([
	["at://did:test/xyz.opnshelf.list/favorites", "Public"],
	["at://did:test/space/private/xyz.opnshelf.list/favorites", "Private"],
])("shows a visitor the visibility of %s", (uri, visibility) => {
	mocks.uri = uri;
	render(
		<ProfileListsPage
			userDid="did:test"
			handle="test"
			selectedListSlug="test"
			isOwner={false}
		/>,
	);
	expect(screen.getByText(visibility)).toBeTruthy();
	expect(
		screen.queryByText(visibility === "Public" ? "Private" : "Public"),
	).toBeNull();
});

it("gives a visitor search with the shared no-match copy", () => {
	render(
		<ProfileListsPage
			userDid="did:test"
			handle="test"
			selectedListSlug="test"
			isOwner={false}
		/>,
	);
	fireEvent.change(screen.getByPlaceholderText("Search list..."), {
		target: { value: "zzz" },
	});
	screen.getByText("No matches");
	screen.getByText("Try adjusting your search or filters.");
});

it.each([
	[true, true],
	[false, false],
])("titles an empty list for owner=%s, add hint shown=%s", (isOwner, hint) => {
	mocks.empty = true;
	render(
		<ProfileListsPage
			userDid="did:test"
			handle="test"
			selectedListSlug="test"
			isOwner={isOwner}
		/>,
	);
	screen.getByText("Empty list");
	// The add hint is owner-only: a visitor can't add to someone else's list.
	expect(
		screen.queryByText(
			"Add movies and shows to this list to see them here.",
		) !== null,
	).toBe(hint);
});
