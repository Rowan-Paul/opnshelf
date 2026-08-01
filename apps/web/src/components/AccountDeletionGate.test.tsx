import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountDeletionGate } from "./AccountDeletionGate";

const mockUseQuery = vi.fn();
const mockLogout = vi.fn();

vi.mock("#/lib/auth-context", () => ({
	useAuth: () => ({ isAuthenticated: true, logout: mockLogout }),
}));

vi.mock("@tanstack/react-query", () => ({
	useQuery: (opts: unknown) => mockUseQuery(opts),
}));

// Keep the real status helpers; stub only the generated query-options builder,
// which touches the unconfigured API client under test.
vi.mock("@opnshelf/api", async (importActual) => ({
	...(await importActual<typeof import("@opnshelf/api")>()),
	usersControllerGetMyAccountDeletionOptions: () => ({
		queryKey: ["account-deletion"],
	}),
}));

function job(overrides: Record<string, unknown>) {
	return {
		id: "job-1",
		status: "running",
		totalRecords: 10,
		deletedRecords: 5,
		currentStep: "movies",
		createdAt: "2026-08-01T00:00:00.000Z",
		...overrides,
	};
}

beforeEach(() => {
	mockUseQuery.mockReturnValue({ data: null, error: null });
});

afterEach(() => {
	cleanup();
	mockUseQuery.mockReset();
	mockLogout.mockReset();
});

describe("AccountDeletionGate", () => {
	it("blocks the page for a job already running on the server (page reload)", () => {
		mockUseQuery.mockReturnValue({ data: job({}), error: null });
		render(<AccountDeletionGate />);

		expect(screen.getByText("Deleting your account")).toBeTruthy();
		expect(screen.getByText("Deleting movies…")).toBeTruthy();
		expect(mockLogout).not.toHaveBeenCalled();
	});

	it("logs out once the job completes", async () => {
		mockUseQuery.mockReturnValue({
			data: job({ status: "completed" }),
			error: null,
		});
		render(<AccountDeletionGate />);

		await waitFor(() => expect(mockLogout).toHaveBeenCalled());
		expect(screen.queryByText("Deleting your account")).toBeNull();
	});

	it("renders nothing when there is no deletion job", () => {
		render(<AccountDeletionGate />);

		expect(screen.queryByText("Deleting your account")).toBeNull();
		expect(mockLogout).not.toHaveBeenCalled();
	});
});
