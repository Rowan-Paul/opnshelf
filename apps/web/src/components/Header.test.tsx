import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Header from "./Header";

// jsdom has no layout, so Tailwind's md:hidden never hides anything here. These
// tests cover the state logic: crossing the 768 px breakpoint must unmount a
// menu whose trigger the breakpoint hides. `pnpm dev:scenarios:check` covers
// the geometry in a real browser.

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to }: { children: ReactNode; to: string }) => (
		<a href={to}>{children}</a>
	),
	CatchBoundary: ({ children }: { children: ReactNode }) => children,
	useRouterState: () => ({ location: { pathname: "/" } }),
}));
vi.mock("#/lib/auth-context", () => ({
	useAuth: () => ({
		user: { did: "did:plc:test", handle: "test.handle", displayName: "Test" },
		isAuthenticated: true,
		isLoading: false,
		logout: vi.fn(),
	}),
}));
vi.mock("#/lib/use-release-notes", () => ({
	useReleaseNotes: () => ({ unread: true }),
}));
vi.mock("#/lib/search-dialog-context", () => ({
	useSearchDialog: () => ({ open: false, setOpen: vi.fn() }),
}));
vi.mock("./SearchCommand", () => ({ default: () => null }));
vi.mock("./ThemeToggle", () => ({ default: () => null }));
// The real menu is a Radix dropdown that portals out; the Header decides
// whether it is mounted at all, which is what this test checks.
vi.mock("./UserMenu", () => ({
	default: () => <div role="menu">Desktop dropdown</div>,
}));

let desktop: boolean;
const listeners = new Set<() => void>();

function crossBreakpoint(toDesktop: boolean) {
	desktop = toDesktop;
	act(() => {
		for (const listener of listeners) listener();
	});
}

beforeEach(() => {
	listeners.clear();
	vi.stubGlobal(
		"matchMedia",
		vi.fn((query: string) => ({
			get matches() {
				return query === "(min-width: 768px)" ? desktop : false;
			},
			addEventListener: (_: string, listener: () => void) =>
				listeners.add(listener),
			removeEventListener: (_: string, listener: () => void) =>
				listeners.delete(listener),
		})),
	);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("Header menus across the desktop breakpoint", () => {
	it("unmounts the avatar dropdown when its trigger is hidden below 768 px", async () => {
		desktop = true;
		render(<Header />);
		fireEvent.click(
			screen.getByRole("button", { name: "User menu, unread release notes" }),
		);
		expect(await screen.findByRole("menu")).toBeTruthy();

		crossBreakpoint(false);

		expect(screen.queryByRole("menu")).toBeNull();
	});

	it("unmounts the compact navigation when its trigger is hidden from 768 px", () => {
		desktop = false;
		render(<Header />);
		fireEvent.click(
			screen.getByRole("button", { name: "Open menu, unread release notes" }),
		);
		expect(screen.getByRole("navigation", { name: "Menu" })).toBeTruthy();

		crossBreakpoint(true);

		expect(screen.queryByRole("navigation", { name: "Menu" })).toBeNull();
		expect(
			screen
				.getByRole("button", { name: "Open menu, unread release notes" })
				.getAttribute("aria-expanded"),
		).toBe("false");
	});

	it("keeps an open menu while the viewport stays on its side", () => {
		desktop = false;
		render(<Header />);
		fireEvent.click(
			screen.getByRole("button", { name: "Open menu, unread release notes" }),
		);

		crossBreakpoint(false);

		expect(screen.getByRole("navigation", { name: "Menu" })).toBeTruthy();
	});
});
