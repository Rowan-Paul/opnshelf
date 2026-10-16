import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SyncSettings, TraktSyncManager } from "./TraktSyncManager";

const mocks = vi.hoisted(() => ({
	configure: vi.fn(async () => ({})),
	action: vi.fn(async () => ({})),
	resolve: vi.fn(async () => ({})),
	importStatus: "paused",
	issue: false,
	ignored: false,
	uncertain: false,
	status: "paused",
	consent: false,
	syncState: "idle",
}));
vi.mock("@tanstack/react-router", () => ({
	Link: ({ children }: { children: React.ReactNode }) => (
		<span>{children}</span>
	),
}));
vi.mock("@opnshelf/api", async (original) => ({
	...(await original<typeof import("@opnshelf/api")>()),
	traktSyncControllerStatus: async () => ({
		data: {
			configured: true,
			status: mocks.status,
			syncState: mocks.syncState,
			username: "fixture",
			direction: "both",
			watches: true,
			ratings: true,
			historyScope: "all",
			publicationConsent: mocks.consent,
			remaining: 0,
			needsAttention: 0,
			ignored: 0,
			importStatus: mocks.importStatus,
		},
	}),
	traktSyncControllerIssues: async ({
		query,
	}: {
		query: { view?: string };
	}) => ({
		data: {
			items: (query.view === "ignored" ? mocks.ignored : mocks.issue)
				? [
						{
							id: "one",
							recovery: mocks.uncertain ? "verify" : "choose",
							kind: "watch",
							ignored: query.view === "ignored",
							issue: mocks.uncertain
								? "The outcome of creating this Trakt Review is unknown. Check Trakt, then choose a version before retrying."
								: "Both services changed this Watch. Choose which version to keep.",
							opnshelf: { title: "Fixture", displayValue: "2020-01-01" },
							candidates: [],
						},
					]
				: [],
			total: (query.view === "ignored" ? mocks.ignored : mocks.issue) ? 1 : 0,
		},
	}),
	traktSyncControllerConfigureMutation: () => ({ mutationFn: mocks.configure }),
	traktSyncControllerActionMutation: () => ({ mutationFn: mocks.action }),
	traktSyncControllerResolveMutation: () => ({ mutationFn: mocks.resolve }),
}));
function mount(connectionFailed = false, embedded = false) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	render(
		<QueryClientProvider client={client}>
			<TraktSyncManager
				connectionFailed={connectionFailed}
				embedded={embedded}
			/>
		</QueryClientProvider>,
	);
}
afterEach(cleanup);
beforeEach(() => {
	vi.clearAllMocks();
	mocks.importStatus = "paused";
	mocks.issue = false;
	mocks.ignored = false;
	mocks.uncertain = false;
	mocks.status = "paused";
	mocks.consent = false;
	mocks.syncState = "idle";
});
describe("Trakt Sync setup and conflict choices", () => {
	it("allows disconnecting before setup without enabling sync or consenting", async () => {
		mount(false, true);
		fireEvent.click(await screen.findByRole("button", { name: "Disconnect" }));
		fireEvent.click(screen.getByRole("button", { name: "Confirm disconnect" }));
		await waitFor(() =>
			expect(mocks.action).toHaveBeenCalledWith(
				{ body: { action: "disconnect" } },
				expect.anything(),
			),
		);
		expect(mocks.configure).not.toHaveBeenCalled();
		expect(screen.queryByLabelText(/I understand that sync/)).toBeNull();
	});

	it("shows an OAuth callback failure after returning to the app", async () => {
		mount(true);
		expect(
			await screen.findByText("Trakt could not connect. Try connecting again."),
		).toBeTruthy();
	});

	it("requires publication consent, Import handoff, and a concrete review before enabling", async () => {
		mount();
		const review = await screen.findByRole("button", { name: "Enable sync" });
		expect(screen.queryByLabelText(/I understand that sync/)).toBeNull();
		fireEvent.click(review);
		const confirm = screen.getByRole("button", {
			name: "Confirm and enable sync",
		}) as HTMLButtonElement;
		expect(screen.getByRole("dialog")).toBeTruthy();
		expect(confirm.disabled).toBe(true);
		expect(mocks.configure).not.toHaveBeenCalled();
		fireEvent.click(screen.getByLabelText(/I understand that sync/));
		expect(confirm.disabled).toBe(true);
		fireEvent.click(screen.getByLabelText(/Continue my unfinished Import/));
		expect(confirm.disabled).toBe(false);
		fireEvent.click(confirm);
		await waitFor(() =>
			expect(mocks.configure).toHaveBeenCalledWith(
				expect.objectContaining({
					body: expect.objectContaining({
						publicationConsent: true,
						handoffImport: true,
					}),
				}),
				expect.anything(),
			),
		);
	});
	it("shows an existing connection inline without repeating setup or offering another Import", async () => {
		mocks.status = "active";
		mocks.consent = true;
		mocks.importStatus = "";
		mount(false, true);
		expect(await screen.findByText("Sync is on")).toBeTruthy();
		expect(screen.queryByRole("heading", { name: "Trakt Sync" })).toBeNull();
		expect(screen.queryByText(/Import public history/)).toBeNull();
		expect(screen.queryByLabelText(/I understand that sync/)).toBeNull();
		expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Sync settings" }));
		fireEvent.click(screen.getByRole("radio", { name: "Opnshelf → Trakt" }));
		fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
		expect(screen.getByRole("dialog")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Back" }));
		expect(mocks.configure).not.toHaveBeenCalled();
		expect(screen.getByRole("dialog")).toBeTruthy();
	});

	it("uses Continue in onboarding and saves only after the modal's consent", async () => {
		const saved = vi.fn();
		const client = new QueryClient({
			defaultOptions: { mutations: { retry: false } },
		});
		render(
			<QueryClientProvider client={client}>
				<SyncSettings
					onboarding
					onSaved={saved}
					status={{
						configured: true,
						status: "paused",
						direction: "both",
						watches: true,
						ratings: true,
						historyScope: "all",
						publicationConsent: false,
						remaining: 0,
						needsAttention: 0,
						ignored: 0,
					}}
				/>
			</QueryClientProvider>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Continue" }));
		expect(saved).not.toHaveBeenCalled();
		const confirm = screen.getByRole("button", {
			name: "Enable sync and continue",
		}) as HTMLButtonElement;
		expect(confirm.disabled).toBe(true);
		fireEvent.click(screen.getByLabelText(/I understand that sync/));
		fireEvent.click(confirm);
		await waitFor(() => expect(saved).toHaveBeenCalledOnce());
	});

	it("states deletion explicitly and requires a second confirmation", async () => {
		mocks.importStatus = "completed";
		mocks.issue = true;
		mount();
		fireEvent.click(
			await screen.findByRole("button", {
				name: "Use Trakt (delete the other version)",
			}),
		);
		expect(mocks.resolve).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Confirm choice" }));
		await waitFor(() =>
			expect(mocks.resolve).toHaveBeenCalledWith(
				{ path: { id: "one" }, body: { action: "trakt" } },
				expect.anything(),
			),
		);
	});
});

it.each([
	"lists",
	"favorites",
	"notes",
	"library",
	"reviews",
] as const)("uses one publication checkbox for %s-only sync", async (scope) => {
	mocks.importStatus = "completed";
	mount();
	fireEvent.click(
		await screen.findByRole("button", { name: "Choose records" }),
	);
	fireEvent.click(screen.getByLabelText("Watch history"));
	fireEvent.click(screen.getByLabelText("Ratings"));
	fireEvent.click(
		screen.getByLabelText(
			{
				lists: "Custom Lists",
				favorites: "Favorites",
				notes: "Notes",
				library: "Library",
				reviews: "Reviews",
			}[scope],
		),
	);
	if (scope === "lists") fireEvent.click(screen.getByLabelText("Watchlist"));
	fireEvent.click(screen.getByRole("button", { name: "Done" }));
	fireEvent.click(screen.getByRole("button", { name: "Enable sync" }));
	const confirm = screen.getByRole("button", {
		name: "Confirm and enable sync",
	});
	expect(confirm.hasAttribute("disabled")).toBe(true);
	expect(
		screen.getAllByRole("checkbox", { name: /I understand/ }),
	).toHaveLength(1);
	fireEvent.click(screen.getByLabelText(/I understand that sync/));
	expect(confirm.hasAttribute("disabled")).toBe(false);
	fireEvent.click(confirm);
	await waitFor(() =>
		expect(mocks.configure).toHaveBeenCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({
					watches: false,
					ratings: false,
					lists: scope === "lists",
					watchlist: scope === "lists",
					favorites: scope === "favorites",
					notes: scope === "notes",
					library: scope === "library",
					reviews: scope === "reviews",
					contentPublicationConsent: true,
					publicationConsent: true,
					listPublicationConsent: true,
				}),
			}),
			expect.anything(),
		),
	);
});

it("opens record choices separately and retains changes when closed", async () => {
	mocks.importStatus = "completed";
	mount();
	const choose = await screen.findByRole("button", { name: "Choose records" });
	expect(screen.queryByRole("dialog", { name: "Choose records" })).toBeNull();
	expect(screen.queryByRole("checkbox", { name: "Notes" })).toBeNull();
	fireEvent.click(choose);
	fireEvent.click(screen.getByLabelText("Notes", { exact: true }));
	fireEvent.click(screen.getByRole("button", { name: "Done" }));
	expect(screen.getByText("Watch history, Ratings, Notes")).toBeTruthy();
	expect(screen.queryByRole("checkbox", { name: "Notes" })).toBeNull();
	fireEvent.click(screen.getByRole("button", { name: "Choose records" }));
	expect(
		(screen.getByLabelText("Notes", { exact: true }) as HTMLInputElement)
			.checked,
	).toBe(true);
	expect(mocks.configure).not.toHaveBeenCalled();
});

it("does not offer another Sync now request while the worker is running", async () => {
	mocks.status = "active";
	mocks.consent = true;
	mocks.syncState = "running";
	mount();
	expect(
		await screen.findByRole("button", { name: "Syncing with Trakt…" }),
	).toHaveProperty("disabled", true);
	expect(screen.queryByRole("button", { name: "Sync now" })).toBeNull();
});

it("checks an uncertain transfer without offering a deletion choice", async () => {
	mocks.issue = true;
	mocks.uncertain = true;
	mount();
	expect(await screen.findByText("Not confirmed yet")).toBeTruthy();
	expect(
		screen.queryByRole("button", { name: /delete the other version/ }),
	).toBeNull();
	fireEvent.click(screen.getByRole("button", { name: "Check again" }));
	await waitFor(() =>
		expect(mocks.resolve).toHaveBeenCalledWith(
			{ path: { id: "one" }, body: { action: "retry" } },
			expect.anything(),
		),
	);
});

it("opens ignored items in a dialog, restores an item and keeps attention in place", async () => {
	mocks.ignored = true;
	mocks.resolve.mockImplementationOnce(async () => {
		mocks.ignored = false;
		return {};
	});
	mount();
	fireEvent.click(await screen.findByRole("button", { name: "View ignored" }));
	const dialog = await screen.findByRole("dialog", { name: "Ignored items" });
	expect(
		screen.getByRole("heading", { name: "Needs attention", hidden: true }),
	).toBeTruthy();
	fireEvent.click(
		await within(dialog).findByRole("button", { name: "Restore item" }),
	);
	await waitFor(() =>
		expect(mocks.resolve).toHaveBeenCalledWith(
			{ path: { id: "one" }, body: { action: "undo" } },
			expect.anything(),
		),
	);
	expect(await within(dialog).findByText("No ignored items.")).toBeTruthy();
	fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
	expect(screen.queryByRole("dialog")).toBeNull();
	await waitFor(() =>
		expect(document.activeElement).toBe(
			screen.getByRole("button", { name: "View ignored" }),
		),
	);
	expect(
		screen.getByRole("heading", { name: "Needs attention", hidden: true }),
	).toBeTruthy();
});
