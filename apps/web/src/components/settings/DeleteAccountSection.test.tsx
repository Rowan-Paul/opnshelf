import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DeleteAccountSection } from "./DeleteAccountSection";

const mocks = vi.hoisted(() => ({ deleteAccount: vi.fn(), logout: vi.fn() }));

vi.mock("@opnshelf/api", async (importActual) => ({
	...(await importActual<typeof import("@opnshelf/api")>()),
	usersControllerDeleteMyAccountMutation: () => ({
		mutationFn: mocks.deleteAccount,
	}),
}));
vi.mock("#/lib/auth-context", () => ({
	useAuth: () => ({ user: null, logout: mocks.logout }),
}));
vi.mock("#/lib/use-account-deletion", async (importActual) => ({
	...(await importActual<typeof import("#/lib/use-account-deletion")>()),
	useAccountDeletionJob: () => null,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

it("keeps deletion visible while waiting for sync and allows dismissal after failure", async () => {
	let rejectDeletion: (reason: Error) => void = () => {};
	mocks.deleteAccount
		.mockRejectedValueOnce({ statusCode: 409, code: "SYNC_BUSY" })
		.mockImplementationOnce(
			() =>
				new Promise((_, reject) => {
					rejectDeletion = reject;
				}),
		);
	const client = new QueryClient();
	render(
		<QueryClientProvider client={client}>
			<DeleteAccountSection />
		</QueryClientProvider>,
	);
	fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));
	fireEvent.click(screen.getByRole("checkbox", { name: /I understand/ }));
	fireEvent.click(
		screen.getByRole("button", { name: "Permanently Delete Account" }),
	);
	await screen.findByText("Waiting for the current sync to finish…");

	const cancel = screen.getByRole<HTMLButtonElement>("button", {
		name: "Cancel",
	});
	expect(cancel.disabled).toBe(true);
	fireEvent.click(cancel);
	expect(screen.getByRole("dialog")).toBeDefined();
	fireEvent.click(screen.getByRole("button", { name: "Close" }));
	expect(screen.getByRole("dialog")).toBeDefined();
	fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
	expect(screen.getByRole("dialog")).toBeDefined();
	expect(mocks.logout).not.toHaveBeenCalled();

	await waitFor(() => expect(mocks.deleteAccount).toHaveBeenCalledTimes(2), {
		timeout: 4000,
	});
	expect(mocks.deleteAccount.mock.calls[0][0]).toEqual({
		body: { deletePDSData: false },
	});
	rejectDeletion(new Error("Synthetic deletion failure"));
	await screen.findByText("Synthetic deletion failure");
	expect(cancel.disabled).toBe(false);
	expect(mocks.logout).not.toHaveBeenCalled();
	fireEvent.click(cancel);
	expect(screen.queryByRole("dialog")).toBeNull();
	client.clear();
});
