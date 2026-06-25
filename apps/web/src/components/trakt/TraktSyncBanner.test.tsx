import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TraktSyncBanner } from "./TraktSyncBanner";

const mockUseAuth = vi.fn();
const mockUseQuery = vi.fn();

vi.mock("#/lib/auth-context", () => ({
	useAuth: () => mockUseAuth(),
}));

// Mock only useQuery so we control the job; the real @opnshelf/api status
// helpers (isActiveTraktImportStatus, progress, getRetryReason) run for real.
vi.mock("@tanstack/react-query", () => ({
	useQuery: (opts: unknown) => mockUseQuery(opts),
}));

// Keep the real status helpers, but stub the generated query-options builder —
// calling it touches the unconfigured API client and throws under test.
vi.mock("@opnshelf/api", async (importActual) => ({
	...(await importActual<typeof import("@opnshelf/api")>()),
	usersControllerGetMyCurrentTraktImportOptions: () => ({
		queryKey: ["trakt-import-current"],
	}),
}));

function job(overrides: Record<string, unknown>) {
	return {
		id: "job-1",
		status: "running",
		currentPage: 5,
		totalPages: 10,
		importedCount: 0,
		skippedCount: 0,
		failedCount: 0,
		...overrides,
	};
}

describe("TraktSyncBanner", () => {
	beforeEach(() => {
		mockUseAuth.mockReturnValue({ isAuthenticated: true });
	});
	afterEach(() => cleanup());

	it("renders nothing when there is no active import", () => {
		mockUseQuery.mockReturnValue({ data: undefined });
		const { container } = render(<TraktSyncBanner />);
		expect(container.firstChild).toBeNull();
	});

	it("renders nothing when the job is terminal", () => {
		mockUseQuery.mockReturnValue({ data: job({ status: "completed" }) });
		const { container } = render(<TraktSyncBanner />);
		expect(container.firstChild).toBeNull();
	});

	it("shows a background-sync message with progress while running", () => {
		mockUseQuery.mockReturnValue({ data: job({ status: "running" }) });
		render(<TraktSyncBanner />);
		expect(
			screen.getByText(/Importing your Trakt history in the background/),
		).toBeTruthy();
		expect(screen.getByText(/50%/)).toBeTruthy();
		expect(screen.getByText(/keep using the site/)).toBeTruthy();
	});

	it("shows the pause reason and a live countdown when waiting on the budget", () => {
		mockUseQuery.mockReturnValue({
			data: job({
				status: "waiting_retry",
				lastError:
					"Pausing so your account stays under its PDS write limit. Retrying in 30 minutes.",
				nextRunAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
			}),
		});
		render(<TraktSyncBanner />);
		expect(screen.getByText(/stays under its PDS write limit/)).toBeTruthy();
		expect(screen.getByText(/Resuming in/)).toBeTruthy();
	});
});
