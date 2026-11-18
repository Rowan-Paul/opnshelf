import type { SyncStatusDto } from "@opnshelf/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { IntegrationsStep } from "./IntegrationsStep";

const api = vi.hoisted(() => ({
	trakt: { status: vi.fn(), connect: vi.fn() },
	popfeed: { status: vi.fn(), connect: vi.fn() },
	bingers: { status: vi.fn(), connect: vi.fn() },
}));
vi.mock("@opnshelf/api", async (original) => {
	const actual = await original<typeof import("@opnshelf/api")>();
	return {
		...actual,
		INTEGRATIONS: actual.INTEGRATIONS.map((integration) => ({
			...integration,
			api: { ...integration.api, ...api[integration.id] },
		})),
	};
});
vi.mock("#/components/integrations/IntegrationSyncManager", () => ({
	SyncSettings: ({ integration }: { integration: { name: string } }) => (
		<p>{integration.name} settings</p>
	),
}));

const status = (overrides: Partial<SyncStatusDto> = {}) =>
	({
		configured: true,
		status: "disconnected",
		direction: "inbound",
		watches: true,
		ratings: true,
		historyScope: "all",
		publicationConsent: false,
		remaining: 0,
		needsAttention: 0,
		ignored: 0,
		...overrides,
	}) as SyncStatusDto;

function setup(props: Partial<Parameters<typeof IntegrationsStep>[0]> = {}) {
	const onNext = vi.fn();
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	render(
		<QueryClientProvider client={client}>
			<IntegrationsStep onNext={onNext} {...props} />
		</QueryClientProvider>,
	);
	return { onNext };
}

beforeEach(() => {
	vi.resetAllMocks();
	api.trakt.status.mockResolvedValue(status());
	api.popfeed.status.mockResolvedValue(status());
	api.bingers.status.mockResolvedValue(status());
});
afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

it("offers Trakt, Popfeed and Bingers in one step and can be skipped", async () => {
	const { onNext } = setup();
	expect(
		screen.getByRole("heading", {
			name: "Already on Trakt, Popfeed, or Bingers?",
		}),
	).toBeTruthy();
	expect(
		await screen.findByRole("button", { name: "Set up Trakt Sync" }),
	).toBeTruthy();
	expect(
		screen.getByRole("button", { name: "Set up Popfeed Sync" }),
	).toBeTruthy();
	fireEvent.click(screen.getByRole("button", { name: "Skip" }));
	expect(onNext).toHaveBeenCalled();
});

it("sets Popfeed up in place, then opens its settings", async () => {
	setup();
	api.popfeed.connect.mockResolvedValue({});
	api.popfeed.status.mockResolvedValue(
		status({ status: "paused", username: "reader.test" }),
	);
	fireEvent.click(
		await screen.findByRole("button", { name: "Set up Popfeed Sync" }),
	);
	expect(await screen.findByText("Popfeed settings")).toBeTruthy();
	expect(api.popfeed.connect.mock.calls[0][0]).toEqual({
		platform: "web",
		returnTo: "onboarding",
	});
	expect(screen.getByText("@reader.test")).toBeTruthy();
	expect(screen.queryByText("Trakt settings")).toBeNull();
});

it("resumes at the Integration it left for", async () => {
	api.popfeed.status.mockResolvedValue(status({ status: "paused" }));
	setup({ initialOpen: "popfeed" });
	expect(await screen.findByText("Popfeed settings")).toBeTruthy();
});

it("says which Integrations are on and continues", async () => {
	api.trakt.status.mockResolvedValue(
		status({ status: "active", username: "watcher" }),
	);
	const { onNext } = setup({ connectionFailed: "popfeed" });
	expect(await screen.findByText("On")).toBeTruthy();
	expect(screen.getByRole("alert").textContent).toBe(
		"Popfeed could not connect. Try connecting again.",
	);
	fireEvent.click(screen.getByRole("button", { name: "Continue" }));
	await waitFor(() => expect(onNext).toHaveBeenCalled());
});

it("shows an Integration the server has not configured as unavailable", async () => {
	api.popfeed.status.mockResolvedValue(status({ configured: false }));
	setup();
	expect(await screen.findByText("Unavailable")).toBeTruthy();
});

it("keeps Popfeed setup pending through a busy sync, then opens its settings", async () => {
	let finishConnect!: (result: { url?: string }) => void;
	api.popfeed.connect
		.mockRejectedValueOnce({ statusCode: 409, code: "SYNC_BUSY" })
		.mockImplementationOnce(
			() =>
				new Promise<{ url?: string }>((resolve) => {
					finishConnect = resolve;
				}),
		);
	setup();
	const connect = await screen.findByRole("button", {
		name: "Set up Popfeed Sync",
	});
	vi.useFakeTimers();
	await act(async () => {
		fireEvent.click(connect);
		await vi.advanceTimersByTimeAsync(0);
	});
	expect(api.popfeed.connect).toHaveBeenCalledTimes(1);
	expect(connect.hasAttribute("disabled")).toBe(true);
	expect(connect.textContent).toBe("Setting up…");
	expect(screen.queryByRole("alert")).toBeNull();
	expect(screen.queryByText("Popfeed settings")).toBeNull();
	// A repeated click must not bypass the automatic retry delay.
	fireEvent.click(connect);
	expect(api.popfeed.connect).toHaveBeenCalledTimes(1);
	await act(async () => {
		await vi.advanceTimersByTimeAsync(1999);
	});
	expect(api.popfeed.connect).toHaveBeenCalledTimes(1);
	await act(async () => {
		await vi.advanceTimersByTimeAsync(1);
	});
	expect(api.popfeed.connect).toHaveBeenCalledTimes(2);
	expect(connect.hasAttribute("disabled")).toBe(true);
	expect(connect.textContent).toBe("Setting up…");
	expect(screen.queryByRole("alert")).toBeNull();
	expect(screen.queryByText("Popfeed settings")).toBeNull();
	api.popfeed.status.mockResolvedValue(
		status({ status: "paused", username: "reader.test" }),
	);
	await act(async () => {
		finishConnect({});
		await vi.advanceTimersByTimeAsync(0);
	});
	vi.useRealTimers();
	expect(await screen.findByText("Popfeed settings")).toBeTruthy();
	expect(screen.getByText("@reader.test")).toBeTruthy();
	expect(api.popfeed.connect).toHaveBeenCalledTimes(2);
	expect(api.popfeed.connect.mock.calls.map(([input]) => input)).toEqual([
		{ platform: "web", returnTo: "onboarding" },
		{ platform: "web", returnTo: "onboarding" },
	]);
});
