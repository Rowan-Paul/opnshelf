import type { AccountDeletionJobDto } from "@opnshelf/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { act, create } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	isAccountDeletionRunning,
	useAccountDeletionJob,
} from "./use-account-deletion";

const api = vi.hoisted(() => ({ getDeletion: vi.fn() }));
const auth = vi.hoisted(() => ({ signOut: vi.fn() }));

vi.mock("@opnshelf/api", async (importOriginal) => ({
	...(await importOriginal<typeof import("@opnshelf/api")>()),
	usersControllerGetMyAccountDeletionOptions: () => ({
		queryKey: ["users", "me", "account-deletion"],
		queryFn: api.getDeletion,
	}),
}));

vi.mock("@/lib/auth-context", () => ({
	useAuth: () => ({ isAuthenticated: true, signOut: auth.signOut }),
}));

function renderHook() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false, gcTime: Infinity } },
	});
	let current: AccountDeletionJobDto | null = null;

	function TestComponent(): ReactNode {
		current = useAccountDeletionJob();
		return null;
	}

	act(() => {
		create(
			<QueryClientProvider client={client}>
				<TestComponent />
			</QueryClientProvider>,
		);
	});

	return {
		get current() {
			return current;
		},
	};
}

afterEach(() => {
	api.getDeletion.mockReset();
	auth.signOut.mockReset();
});

describe("useAccountDeletionJob", () => {
	it("picks up a job already running on the server (app restart)", async () => {
		api.getDeletion.mockResolvedValue({
			id: "job-1",
			status: "running",
			currentStep: "movies",
		});
		const hook = renderHook();

		await act(async () => {
			await vi.waitFor(() => expect(hook.current?.status).toBe("running"));
		});
		expect(isAccountDeletionRunning(hook.current)).toBe(true);
		expect(auth.signOut).not.toHaveBeenCalled();
	});

	it("signs out once the job completes", async () => {
		api.getDeletion.mockResolvedValue({ id: "job-1", status: "completed" });
		renderHook();

		await act(async () => {
			await vi.waitFor(() => expect(auth.signOut).toHaveBeenCalled());
		});
	});

	it("stays put when there is no deletion job", async () => {
		api.getDeletion.mockResolvedValue(null);
		const hook = renderHook();

		await act(async () => {
			await vi.waitFor(() => expect(api.getDeletion).toHaveBeenCalled());
		});
		expect(isAccountDeletionRunning(hook.current)).toBe(false);
		expect(auth.signOut).not.toHaveBeenCalled();
	});
});
