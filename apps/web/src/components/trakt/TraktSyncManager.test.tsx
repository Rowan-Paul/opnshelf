import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TraktSyncManager } from "./TraktSyncManager";

const mocks = vi.hoisted(() => ({
	configure: vi.fn(async () => ({})),
	resolve: vi.fn(async () => ({})),
	importStatus: "paused",
	issue: false,
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
			status: "paused",
			username: "fixture",
			direction: "both",
			watches: true,
			ratings: true,
			historyScope: "all",
			publicationConsent: false,
			needsAttention: 0,
			ignored: 0,
			importStatus: mocks.importStatus,
		},
	}),
	traktSyncControllerIssues: async () => ({
		data: {
			items: mocks.issue
				? [
						{
							id: "one",
							kind: "watch",
							ignored: false,
							issue:
								"Both services changed this Watch. Choose which version to keep.",
							opnshelf: { title: "Fixture", displayValue: "2020-01-01" },
							candidates: [],
						},
					]
				: [],
			total: mocks.issue ? 1 : 0,
		},
	}),
	traktSyncControllerConfigureMutation: () => ({ mutationFn: mocks.configure }),
	traktSyncControllerResolveMutation: () => ({ mutationFn: mocks.resolve }),
}));
function mount(connectionFailed = false) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	render(
		<QueryClientProvider client={client}>
			<TraktSyncManager connectionFailed={connectionFailed} />
		</QueryClientProvider>,
	);
}
afterEach(cleanup);
beforeEach(() => {
	vi.clearAllMocks();
	mocks.importStatus = "paused";
	mocks.issue = false;
});
describe("Trakt Sync setup and conflict choices", () => {
	it("shows an OAuth callback failure after returning to the app", async () => {
		mount(true);
		expect(
			await screen.findByText("Trakt could not connect. Try connecting again."),
		).toBeTruthy();
	});

	it("requires publication consent, Import handoff, and a concrete review before enabling", async () => {
		mount();
		const review = (await screen.findByRole("button", {
			name: "Review sync settings",
		})) as HTMLButtonElement;
		expect(review.disabled).toBe(true);
		fireEvent.click(screen.getByLabelText(/I understand that Watches/));
		expect(review.disabled).toBe(true);
		fireEvent.click(screen.getByLabelText(/Continue my unfinished Import/));
		expect(review.disabled).toBe(false);
		fireEvent.click(review);
		expect(mocks.configure).not.toHaveBeenCalled();
		fireEvent.click(
			screen.getByRole("button", { name: "Confirm and enable sync" }),
		);
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
