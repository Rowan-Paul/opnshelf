import {
	type IntegrationDefinition,
	type IntegrationIssuesDto,
	POPFEED_INTEGRATION,
	type SyncStatusDto,
	TRAKT_INTEGRATION,
} from "@opnshelf/api";
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
import { IntegrationSyncManager, SyncSettings } from "./IntegrationSyncManager";

const mocks = vi.hoisted(() => ({
	configure: vi.fn(async (..._args: unknown[]) => ({}) as SyncStatusDto),
	action: vi.fn(async (..._args: unknown[]) => ({}) as SyncStatusDto),
	resolve: vi.fn(async (..._args: unknown[]) => ({}) as SyncStatusDto),
	issue: false,
	candidate: false,
	issueRead: vi.fn(),
	issuePages: 1,
	nextPage: undefined as Promise<void> | undefined,
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
const status = async () =>
	({
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
		needsAttention: mocks.issue ? 1 : 0,
		ignored: mocks.ignored ? 1 : 0,
	}) as SyncStatusDto;
const issues = async (query: { view?: string; page?: number }) => {
	mocks.issueRead(query);
	const page = query.page ?? 1;
	if (page > 1) await mocks.nextPage;
	return {
		items: (query.view === "ignored" ? mocks.ignored : mocks.issue)
			? [
					{
						id: page === 1 ? "one" : "two",
						recovery: mocks.uncertain ? "verify" : "choose",
						kind: "watch",
						ignored: query.view === "ignored",
						issue: mocks.uncertain
							? "The outcome of creating this Trakt Review is unknown. Check Trakt, then choose a version before retrying."
							: "Both services changed this Watch. Choose which version to keep.",
						opnshelf: {
							title: page === 1 ? "Fixture" : "Second fixture",
							mediaType: "episode",
							season: 0,
							episode: 2,
							displayValue: "2020-01-01",
						},
						candidates: mocks.candidate
							? [
									{
										key: "existing",
										mediaType: "episode",
										season: 0,
										episode: 2,
										title: "Fixture",
										displayValue: "2026-10-18T19:53:55.311Z",
									},
								]
							: [],
					},
				]
			: [],
		total: (query.view === "ignored" ? mocks.ignored : mocks.issue)
			? mocks.issuePages
			: 0,
		page,
		totalPages: mocks.issuePages,
		hasPreviousPage: page > 1,
		hasNextPage: page < mocks.issuePages,
	} as IntegrationIssuesDto;
};
// Trakt's definition with its transport replaced; payload shapes match the API calls.
const integration: IntegrationDefinition = {
	...TRAKT_INTEGRATION,
	api: {
		...TRAKT_INTEGRATION.api,
		status,
		issues,
		configure: (body) => mocks.configure({ body }, {}),
		action: (action) => mocks.action({ body: { action } }, {}),
		resolve: (id, body) => mocks.resolve({ path: { id }, body }, {}),
	},
};
function mount(connectionFailed = false, embedded = false, issuesOnly = false) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	render(
		<QueryClientProvider client={client}>
			<IntegrationSyncManager
				integration={integration}
				connectionFailed={connectionFailed}
				embedded={embedded}
				issuesOnly={issuesOnly}
			/>
		</QueryClientProvider>,
	);
}
afterEach(cleanup);
beforeEach(() => {
	vi.clearAllMocks();
	mocks.issue = false;
	mocks.issuePages = 1;
	mocks.nextPage = undefined;
	mocks.candidate = false;
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

	it("requires publication consent and a concrete review before enabling", async () => {
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
		expect(confirm.disabled).toBe(false);
		fireEvent.click(confirm);
		await waitFor(() =>
			expect(mocks.configure).toHaveBeenCalledWith(
				expect.objectContaining({
					body: expect.objectContaining({
						publicationConsent: true,
					}),
				}),
				expect.anything(),
			),
		);
	});
	it("shows an existing connection inline without repeating setup or offering another Import", async () => {
		mocks.status = "active";
		mocks.consent = true;
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

	it("saves onboarding settings only after the modal's consent", async () => {
		const saved = vi.fn();
		const client = new QueryClient({
			defaultOptions: { mutations: { retry: false } },
		});
		render(
			<QueryClientProvider client={client}>
				<SyncSettings
					integration={integration}
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
		fireEvent.click(screen.getByRole("button", { name: "Enable sync" }));
		expect(saved).not.toHaveBeenCalled();
		const confirm = screen.getByRole("button", {
			name: "Confirm and enable sync",
		}) as HTMLButtonElement;
		expect(confirm.disabled).toBe(true);
		fireEvent.click(screen.getByLabelText(/I understand that sync/));
		fireEvent.click(confirm);
		await waitFor(() => expect(saved).toHaveBeenCalledOnce());
	});

	it("states deletion explicitly and requires a second confirmation", async () => {
		mocks.issue = true;
		mount(false, false, true);
		fireEvent.click(
			await screen.findByRole("button", {
				name: "Use Trakt (delete the other version)",
			}),
		);
		expect(mocks.resolve).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Confirm choice" }));
		await waitFor(() =>
			expect(mocks.resolve).toHaveBeenCalledWith(
				{ path: { id: "one" }, body: { action: "remote" } },
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
		await screen.findByText("Syncing with Trakt. You can keep using Opnshelf."),
	).toBeTruthy();
	expect(
		screen.queryByRole("button", { name: "Syncing with Trakt…" }),
	).toBeNull();
	expect(screen.queryByRole("button", { name: "Sync now" })).toBeNull();
});

it("checks an uncertain transfer without offering a deletion choice", async () => {
	mocks.issue = true;
	mocks.uncertain = true;
	mount(false, false, true);
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
		return {} as SyncStatusDto;
	});
	mount(false, false, true);
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

it.each([
	"Send after checking Trakt",
	"Remove from Opnshelf",
])("requires a Trakt check before %s", async (label) => {
	mocks.issue = true;
	mocks.uncertain = true;
	mount(false, false, true);
	fireEvent.click(await screen.findByRole("button", { name: label }));
	const confirm = screen.getByRole("button", { name: "Confirm choice" });
	expect(confirm).toHaveProperty("disabled", true);
	fireEvent.click(confirm);
	expect(mocks.resolve).not.toHaveBeenCalled();
	fireEvent.click(
		screen.getByRole("checkbox", {
			name: "I checked Trakt and confirmed this item is missing.",
		}),
	);
	fireEvent.click(confirm);
	await waitFor(() =>
		expect(mocks.resolve).toHaveBeenCalledWith(
			{
				path: { id: "one" },
				body: {
					action: label.startsWith("Send") ? "opnshelf" : "remote",
					confirmedRemoteMissing: true,
				},
			},
			expect.anything(),
		),
	);
});

it.each([
	false,
	true,
])("hides empty attention when disconnected (embedded: %s)", async (embedded) => {
	mocks.status = "disconnected";
	mount(false, embedded);
	await screen.findByRole("button", { name: "Connect Trakt" });
	expect(screen.queryByRole("heading", { name: "Needs attention" })).toBeNull();
});
it("keeps retained attention visible after disconnecting", async () => {
	mocks.status = "disconnected";
	mocks.issue = true;
	mount(false, false, true);
	expect(
		await screen.findByRole("heading", { name: "Needs attention" }),
	).toBeTruthy();
});

it("keeps the queue off the settings page", async () => {
	mocks.issue = true;
	mount();
	expect(await screen.findByText("Review items")).toBeTruthy();
	expect(screen.queryByText(/Both services changed/)).toBeNull();
});
it("explains linking before resolving a possible duplicate Watch", async () => {
	mocks.issue = true;
	mocks.candidate = true;
	mount(false, false, true);
	const link = await screen.findByRole("button", {
		name: "Link this Watch",
	});
	expect(mocks.issueRead).toHaveBeenCalledWith({
		view: "attention",
		page: 1,
		pageSize: 1,
	});
	expect(screen.queryByText("Review item")).toBeNull();
	expect(await screen.findByText("Item 1 of 1")).toBeTruthy();
	expect(link.textContent).toBe("Link this Watch");
	expect(screen.getByText("Existing Watch in Trakt")).toBeTruthy();
	expect(link.getAttribute("aria-describedby")).toBeTruthy();
	expect(screen.getAllByText("Fixture · S0E2").length).toBeGreaterThan(0);
	expect(link.textContent).not.toContain("2026-10-18T");
	fireEvent.click(link);
	expect(screen.getByText(/This step keeps both dates/)).toBeTruthy();
	expect(mocks.resolve).not.toHaveBeenCalled();
	fireEvent.click(screen.getByRole("button", { name: "Confirm choice" }));
	await waitFor(() =>
		expect(mocks.resolve).toHaveBeenCalledWith(
			{
				path: { id: "one" },
				body: { action: "link", candidateKey: "existing" },
			},
			expect.anything(),
		),
	);
});

it("keeps the current review item visible while the next page loads", async () => {
	mocks.issue = true;
	mocks.issuePages = 2;
	let finishPage = () => {};
	mocks.nextPage = new Promise<void>((resolve) => {
		finishPage = resolve;
	});
	mount(false, false, true);
	await screen.findByText("Item 1 of 2");
	const navigation = within(
		screen.getByRole("navigation", { name: "Sync review items" }),
	);
	expect(
		navigation
			.getByRole("button", { name: "Previous" })
			.hasAttribute("disabled"),
	).toBe(true);
	fireEvent.click(navigation.getByRole("button", { name: "Next" }));
	await screen.findByText("Loading item 2…");
	expect(mocks.issueRead).toHaveBeenCalledWith({
		view: "attention",
		page: 2,
		pageSize: 1,
	});
	expect(screen.getByText("Item 1 of 2")).toBeTruthy();
	expect(screen.getAllByText("Fixture · S0E2").length).toBeGreaterThan(0);
	expect(screen.queryByLabelText("Loading sync items")).toBeNull();
	for (const name of ["Previous", "Next"]) {
		expect(
			navigation.getByRole("button", { name }).hasAttribute("disabled"),
		).toBe(true);
	}
	finishPage();
	await screen.findByText("Item 2 of 2");
	expect(screen.getAllByText("Second fixture · S0E2").length).toBeGreaterThan(
		0,
	);
	expect(screen.queryByText("Fixture · S0E2")).toBeNull();
	expect(screen.queryByText("Loading item 2…")).toBeNull();
	expect(
		navigation
			.getByRole("button", { name: "Previous" })
			.hasAttribute("disabled"),
	).toBe(false);
	expect(
		navigation.getByRole("button", { name: "Next" }).hasAttribute("disabled"),
	).toBe(true);
	fireEvent.click(navigation.getByRole("button", { name: "Previous" }));
	await screen.findByText("Item 1 of 2");
	expect(screen.getAllByText("Fixture · S0E2").length).toBeGreaterThan(0);
});

describe("Popfeed Sync", () => {
	const popfeedStatus = (connected: boolean) =>
		({
			configured: true,
			status: connected ? "paused" : "disconnected",
			syncState: "idle",
			username: connected ? "fixture.test" : undefined,
			direction: "inbound",
			watches: true,
			ratings: true,
			historyScope: "all",
			publicationConsent: false,
			remaining: 0,
			needsAttention: 0,
			ignored: 0,
		}) as SyncStatusDto;
	function mountPopfeed(connected: boolean) {
		let current = connected;
		const connect = vi.fn(async () => {
			current = true;
			return {};
		});
		const popfeed: IntegrationDefinition = {
			...POPFEED_INTEGRATION,
			api: {
				...POPFEED_INTEGRATION.api,
				status: async () => popfeedStatus(current),
				connect,
				configure: (body) => mocks.configure({ body }, {}),
			},
		};
		render(
			<QueryClientProvider
				client={
					new QueryClient({
						defaultOptions: {
							queries: { retry: false },
							mutations: { retry: false },
						},
					})
				}
			>
				<IntegrationSyncManager integration={popfeed} />
			</QueryClientProvider>,
		);
		return connect;
	}
	it("connects in place, without leaving Opnshelf", async () => {
		const connect = mountPopfeed(false);
		fireEvent.click(
			await screen.findByRole("button", { name: "Set up Popfeed Sync" }),
		);
		await waitFor(() =>
			expect(connect).toHaveBeenCalledWith(
				{ platform: "web" },
				expect.anything(),
			),
		);
		expect(await screen.findByText("@fixture.test ·")).toBeTruthy();
		expect(
			screen.getByRole("heading", { name: "Your Popfeed records" }),
		).toBeTruthy();
		// Nothing is on before setup, so there is nothing to turn off.
		expect(
			screen.queryByRole("button", { name: "Turn off Popfeed Sync" }),
		).toBeNull();
		expect(screen.queryByRole("button", { name: "Disconnect" })).toBeNull();
	});
	it("asks for write access before sending changes to Popfeed", async () => {
		mountPopfeed(true);
		const radios = await screen.findAllByRole("radio", { name: /→|Both/ });
		expect(radios.map((radio) => radio.getAttribute("aria-label"))).toEqual([
			"Popfeed → Opnshelf",
			"Opnshelf → Popfeed",
			"Both directions",
		]);
		expect(
			screen.queryByRole("button", { name: "Allow Popfeed access" }),
		).toBeNull();
		fireEvent.click(screen.getByRole("radio", { name: "Both directions" }));
		expect(
			await screen.findByRole("button", { name: "Allow Popfeed access" }),
		).toBeTruthy();
		expect(
			screen.getByText(/Other devices then need to sign in again/),
		).toBeTruthy();
		expect(
			(screen.getByRole("button", { name: "Enable sync" }) as HTMLButtonElement)
				.disabled,
		).toBe(true);
		// The grant explains what Popfeed access allows before leaving the page.
		fireEvent.click(
			screen.getByRole("button", { name: "Allow Popfeed access" }),
		);
		expect(
			await screen.findByRole("dialog", {
				name: "Let Opnshelf write to Popfeed",
			}),
		).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Not now" }));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	});
	it("offers Popfeed's record types only", async () => {
		mountPopfeed(true);
		fireEvent.click(
			await screen.findByRole("button", { name: "Choose records" }),
		);
		const dialog = await screen.findByRole("dialog", {
			name: "Choose records",
		});
		expect(
			within(dialog)
				.getAllByRole("checkbox")
				.map((box) => box.parentElement?.textContent),
		).toEqual([
			"Watch history",
			"Ratings",
			"Watchlist",
			"Custom Lists",
			"Reviews",
		]);
	});
});
