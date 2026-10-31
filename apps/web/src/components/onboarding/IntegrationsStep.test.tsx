import type { SyncStatusDto } from "@opnshelf/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
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
});
afterEach(cleanup);

it("offers Trakt and Popfeed in one step and can be skipped", async () => {
	const { onNext } = setup();
	expect(
		screen.getByRole("heading", { name: "Already on Trakt or Popfeed?" }),
	).toBeTruthy();
	expect(
		await screen.findByRole("button", { name: "Connect Trakt" }),
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
