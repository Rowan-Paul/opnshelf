import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TraktSyncBanner } from "./TraktSyncBanner";

const mockUseAuth = vi.fn();
const mockUseSyncQuery = vi.fn();
vi.mock("#/lib/auth-context", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("@tanstack/react-query", () => ({
	useQuery: () => mockUseSyncQuery(),
}));
vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
		<a href={to}>{children}</a>
	),
}));
describe("TraktSyncBanner", () => {
	beforeEach(() => {
		mockUseAuth.mockReturnValue({ isAuthenticated: true });
		mockUseSyncQuery.mockReturnValue({ data: undefined });
	});
	afterEach(() => cleanup());
	it("renders nothing when logged out", () => {
		mockUseAuth.mockReturnValue({ isAuthenticated: false });
		mockUseSyncQuery.mockReturnValue({ data: { status: "preparing" } });
		expect(render(<TraktSyncBanner />).container.firstChild).toBeNull();
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
			render(<TraktSyncBanner />);
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
			render(<TraktSyncBanner />);
			expect(
				screen.getByRole("link", {
					name: /Trakt sync needs attention.*View details/,
				}),
			).toBeTruthy();
			expect(screen.queryByText(/Syncing with Trakt/)).toBeNull();
		});

		it("shows progress while sync works through a backlog", () => {
			mockUseSyncQuery.mockReturnValue(sync({ remaining: 15, progress: 40 }));
			render(<TraktSyncBanner />);
			expect(screen.getByText(/Syncing with Trakt — 40%/)).toBeTruthy();
		});

		it("shows the first comparison", () => {
			mockUseSyncQuery.mockReturnValue(sync({ status: "preparing" }));
			render(<TraktSyncBanner />);
			expect(screen.getByText(/Comparing with Trakt/)).toBeTruthy();
		});

		it("renders nothing once sync has caught up", () => {
			mockUseSyncQuery.mockReturnValue(sync({}));
			const { container } = render(<TraktSyncBanner />);
			expect(container.firstChild).toBeNull();
		});
	});
});
