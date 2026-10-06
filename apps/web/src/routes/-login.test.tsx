import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const { login, navigate } = vi.hoisted(() => ({
	login: vi.fn(),
	navigate: vi.fn(),
}));
vi.mock("#/lib/auth-context", () => ({
	useAuth: () => ({ login, isAuthenticated: false, isLoading: false }),
}));
vi.mock("@tanstack/react-router", async () => ({
	...(await vi.importActual<typeof import("@tanstack/react-router")>(
		"@tanstack/react-router",
	)),
	useNavigate: () => navigate,
	useSearch: () => ({}),
	Link: ({ children }: { children: React.ReactNode }) => (
		<span>{children}</span>
	),
}));
vi.mock("@tanstack/react-query", async () => ({
	...(await vi.importActual<typeof import("@tanstack/react-query")>(
		"@tanstack/react-query",
	)),
	useQuery: () => ({ data: [], isFetching: false }),
}));

import { Route } from "./login";

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
	vi.unstubAllGlobals();
});

it("starts OAuth for a typed local handle even when Bluesky cannot resolve it", async () => {
	const publicLookup = vi.fn().mockResolvedValue({ ok: false, status: 400 });
	vi.stubGlobal("fetch", publicLookup);
	const Page = Route.options.component;
	if (!Page) throw new Error("Missing login page");
	render(<Page />);
	fireEvent.change(screen.getByRole("combobox", { name: "Handle" }), {
		target: { value: " spacesreal.pds.127.0.0.1.nip.io " },
	});
	fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
	await waitFor(() =>
		expect(login).toHaveBeenCalledWith("spacesreal.pds.127.0.0.1.nip.io"),
	);
	expect(publicLookup).not.toHaveBeenCalled();
});
