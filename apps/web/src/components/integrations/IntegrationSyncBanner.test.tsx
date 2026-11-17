import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IntegrationSyncBanner } from "./IntegrationSyncBanner";

const mockUseAuth = vi.fn();
const mockUseSyncQuery = vi.fn();
vi.mock("#/lib/auth-context", () => ({ useAuth: () => mockUseAuth() }));
// One status per Integration, in INTEGRATIONS order: Trakt, Popfeed, Bingers.
const mockOthers = vi.fn((): unknown[] => [
	{ data: undefined },
	{ data: undefined },
]);
vi.mock("@tanstack/react-query", () => ({
	useQueries: () => [mockUseSyncQuery(), ...mockOthers()],
}));
vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
		<a href={to}>{children}</a>
	),
}));
describe("IntegrationSyncBanner", () => {
	beforeEach(() => {
		mockUseAuth.mockReturnValue({ isAuthenticated: true });
		mockUseSyncQuery.mockReturnValue({ data: undefined });
	});
	afterEach(() => {
		cleanup();
		mockOthers.mockReset();
		mockOthers.mockReturnValue([{ data: undefined }, { data: undefined }]);
	});
	it("reports a Popfeed problem, ahead of Trakt still catching up", () => {
		mockUseSyncQuery.mockReturnValue({
			data: { status: "active", remaining: 15 },
		});
		mockOthers.mockReturnValue([
			{ data: { status: "active", remaining: 0, needsAttention: 2 } },
			{ data: undefined },
		]);
		render(<IntegrationSyncBanner />);
		const link = screen.getByRole("link", {
			name: /Popfeed sync needs attention.*View details/,
		});
		expect(link).toBeTruthy();
		expect(screen.queryByText(/Syncing with Trakt/)).toBeNull();
	});
	it("reports Bingers reconnecting when nothing else needs the User", () => {
		mockOthers.mockReturnValue([
			{ data: undefined },
			{ data: { status: "reconnect", remaining: 0, lastError: "Reconnect." } },
		]);
		render(<IntegrationSyncBanner />);
		expect(
			screen.getByRole("link", { name: /Bingers sync error/ }),
		).toBeTruthy();
	});
	it("renders nothing when logged out", () => {
		mockUseAuth.mockReturnValue({ isAuthenticated: false });
		mockUseSyncQuery.mockReturnValue({ data: { status: "preparing" } });
		expect(render(<IntegrationSyncBanner />).container.firstChild).toBeNull();
	});
	describe("Trakt Sync catch-up", () => {
		const sync = (overrides: Record<string, unknown>) => ({
			data: { status: "active", remaining: 0, ...overrides },
		});
		it("shows a sync error instead of comparison progress", () => {
			mockUseSyncQuery.mockReturnValue(
				sync({
					status: "preparing",
					lastError: "Trakt could not finish the request.",
				}),
			);
			render(<IntegrationSyncBanner />);
			expect(
				screen.getByRole("link", { name: /Trakt sync error.*View details/ }),
			).toBeTruthy();
			expect(screen.queryByText(/Comparing with Trakt/)).toBeNull();
			expect(document.querySelector(".animate-spin")).toBeNull();
			expect(
				screen.queryByText(/Trakt could not finish the request/),
			).toBeNull();
		});
		it("shows Needs attention while other records catch up", () => {
			mockUseSyncQuery.mockReturnValue(
				sync({ remaining: 15, needsAttention: 1 }),
			);
			render(<IntegrationSyncBanner />);
			expect(
				screen.getByRole("link", {
					name: /Trakt sync needs attention.*View details/,
				}),
			).toBeTruthy();
			expect(screen.queryByText(/Syncing with Trakt/)).toBeNull();
		});

		it("shows progress while sync works through a backlog", () => {
			mockUseSyncQuery.mockReturnValue(sync({ remaining: 15, progress: 40 }));
			render(<IntegrationSyncBanner />);
			expect(screen.getByText(/Syncing with Trakt — 40%/)).toBeTruthy();
		});

		it("shows the first comparison", () => {
			mockUseSyncQuery.mockReturnValue(sync({ status: "preparing" }));
			render(<IntegrationSyncBanner />);
			expect(screen.getByText(/Comparing with Trakt/)).toBeTruthy();
		});

		it("renders nothing once sync has caught up", () => {
			mockUseSyncQuery.mockReturnValue(sync({}));
			const { container } = render(<IntegrationSyncBanner />);
			expect(container.firstChild).toBeNull();
		});
	});
});
