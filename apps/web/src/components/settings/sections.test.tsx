import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AccountSection } from "./AccountSection";
import { BlueskyCrossPostsSection } from "./BlueskyCrossPostsSection";
import { DeleteAccountSection } from "./DeleteAccountSection";
import { PreferencesSections } from "./PreferencesSections";

// The sections read their own state instead of taking it as props, so the
// context and the network layer are the only things a smoke test has to fake.
vi.mock("#/lib/auth-context", () => ({
	useAuth: () => ({
		user: null,
		userSettings: {
			timezone: "Europe/Amsterdam",
			timeFormat: "24h",
			watchCountry: "NL",
			alwaysShowSpoilers: false,
			blueskyCrossPostEnabled: false,
		},
		isAuthenticated: true,
		isLoading: false,
		logout: vi.fn(),
	}),
}));

function Wrapper({ children }: { children: ReactNode }) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
}

const user = {
	did: "did:plc:test",
	handle: "rowan.opnshelf.social",
	displayName: "Rowan",
	avatar: null,
	blueskyProfileUrl: "https://bsky.app/profile/rowan.opnshelf.social",
	tangledProfileUrl: null,
	showBlueskyOnProfile: true,
	showTangledOnProfile: true,
	// biome-ignore lint/suspicious/noExplicitAny: partial UserDto is enough here
} as any;

describe("settings sections", () => {
	it("renders the preference sections with the stored settings", () => {
		render(<PreferencesSections />, { wrapper: Wrapper });

		expect(screen.getByText("Appearance")).toBeDefined();
		expect(screen.getByText("Time & Region")).toBeDefined();
		expect(screen.getByText("Streaming")).toBeDefined();
		expect(screen.getByText("Reviews")).toBeDefined();
		// timeFormat "24h" → the 24-hour switch is on.
		expect(screen.getByRole("switch", { name: /24-hour time/i })).toBeDefined();
	});

	it("marks the picked appearance and persists it for the header toggle", () => {
		render(<PreferencesSections />, { wrapper: Wrapper });

		const dark = screen.getByRole("button", { name: "Dark" });
		act(() => dark.click());

		expect(dark.getAttribute("aria-pressed")).toBe("true");
		expect(
			screen
				.getByRole("button", { name: "System" })
				.getAttribute("aria-pressed"),
		).toBe("false");
		// The header ThemeToggle reads the same store, keyed on this entry.
		expect(window.localStorage.getItem("theme")).toBe("dark");
	});

	it("renders the account section from the passed user", () => {
		render(<AccountSection user={user} />, { wrapper: Wrapper });

		expect(
			(screen.getByLabelText("Display name") as HTMLInputElement).value,
		).toBe("Rowan");
		expect((screen.getByLabelText("Handle") as HTMLInputElement).value).toBe(
			"@rowan.opnshelf.social",
		);
		// Only Bluesky resolved, so its toggle is live and Tangled's is disabled.
		expect(screen.getByText("View profile")).toBeDefined();
		expect(screen.getAllByText("Not found")).toHaveLength(1);
	});

	it("renders the Bluesky integration as disconnected", () => {
		render(<BlueskyCrossPostsSection />, { wrapper: Wrapper });

		expect(
			screen.getByRole("heading", { name: "Bluesky Cross-posts" }),
		).toBeDefined();
		expect(screen.getByRole("button", { name: "Connect" })).toBeDefined();
	});

	it("renders the danger zone without an active deletion job", () => {
		render(<DeleteAccountSection />, { wrapper: Wrapper });

		expect(screen.getByText("Danger Zone")).toBeDefined();
		expect(
			screen.getByRole("button", { name: /Delete Account/ }),
		).toBeDefined();
		// No job yet, so neither dialog is mounted.
		expect(screen.queryByRole("dialog")).toBeNull();
	});
});
