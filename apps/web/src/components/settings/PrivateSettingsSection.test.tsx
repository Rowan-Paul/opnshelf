import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrivateSettingsSection } from "./PrivateSettingsSection";

const mocks = vi.hoisted(() => ({
	state: { enabled: false, status: "disabled" },
	save: vi.fn(),
	permission: vi.fn(),
	remove: vi.fn(),
}));
vi.mock("#/lib/auth-context", () => ({
	useAuth: () => ({
		userSettings: { timeFormat: "24h", privateSettings: mocks.state },
	}),
}));
vi.mock("./use-settings-mutations", () => ({
	usePermissionChange: () => ({
		isPending: false,
		requestPermissionChange: mocks.permission,
	}),
	useUpdateSettings: () => ({ isPending: false, mutate: mocks.save }),
}));
vi.mock("@opnshelf/api", () => ({
	usersControllerGetMySettingsOptions: () => ({ queryKey: ["settings"] }),
	usersControllerDeletePrivateSettingsMutation: () => ({
		mutationFn: mocks.remove,
	}),
}));
function show() {
	return render(
		<QueryClientProvider client={new QueryClient()}>
			<PrivateSettingsSection />
		</QueryClientProvider>,
	);
}
describe("Private Settings", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.state = { enabled: false, status: "disabled" };
	});
	it("stays hidden when disabled", () => {
		show();
		expect(screen.queryByText("Private Settings")).toBeNull();
	});
	it("explains unsupported hosts without offering a connection", () => {
		mocks.state.status = "unsupported";
		show();
		expect(
			screen.getByText("Your PDS does not support Spaces yet."),
		).toBeDefined();
		expect(
			screen.getByRole("button", { name: "Connect" }).hasAttribute("disabled"),
		).toBe(true);
	});
	it("warns about other devices before requesting the Spaces grant", () => {
		mocks.state.status = "available";
		show();
		fireEvent.click(screen.getByRole("button", { name: "Connect" }));
		expect(
			screen.getByText(/Other devices will need to sign in again/),
		).toBeDefined();
		expect(mocks.permission).not.toHaveBeenCalled();
		fireEvent.click(
			screen.getByRole("button", { name: "Continue and connect" }),
		);
		expect(mocks.permission).toHaveBeenCalledWith("spaces", "connect");
	});
	it("creates a missing record only on explicit save", () => {
		mocks.state = { enabled: true, status: "missing" };
		show();
		expect(mocks.save).not.toHaveBeenCalled();
		fireEvent.click(
			screen.getByRole("button", { name: "Save current time format" }),
		);
		expect(mocks.save).toHaveBeenCalledWith({ body: { timeFormat: "24h" } });
	});
	it("offers reconnection after access loss", () => {
		mocks.state = { enabled: true, status: "permissionRequired" };
		show();
		fireEvent.click(
			screen.getByRole("button", { name: "Reconnect Private Settings" }),
		);
		expect(mocks.permission).not.toHaveBeenCalled();
		fireEvent.click(
			screen.getByRole("button", { name: "Continue and reconnect" }),
		);
		expect(mocks.permission).toHaveBeenCalledWith("spaces", "connect");
	});
});
