// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "./index";

const mockUseCurrentUser = vi.fn();

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => () => ({}),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
	useCurrentUser: () => mockUseCurrentUser(),
}));

vi.mock("@/components/AuthLoadingState", () => ({
	AuthLoadingState: () => <div>Auth loading</div>,
}));

vi.mock("@/components/home/LandingHomePage", () => ({
	LandingHomePage: () => <div>Landing home</div>,
}));

vi.mock("@/components/home/DashboardHomePage", () => ({
	DashboardHomePage: ({ user }: { user: { handle: string } }) => (
		<div>Dashboard for {user.handle}</div>
	),
}));

declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("HomePage", () => {
	let container: HTMLDivElement | null = null;
	let root: Root | null = null;

	afterEach(() => {
		vi.clearAllMocks();

		if (root) {
			const mountedRoot = root;
			act(() => {
				mountedRoot.unmount();
			});
		}

		container?.remove();
		container = null;
		root = null;
		document.body.innerHTML = "";
	});

	function renderHomePage() {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		act(() => {
			root?.render(<HomePage />);
		});
	}

	it("uses the shared current-user hook while auth is loading", () => {
		mockUseCurrentUser.mockReturnValue({
			data: undefined,
			isLoading: true,
		});

		renderHomePage();

		expect(mockUseCurrentUser).toHaveBeenCalledTimes(1);
		expect(document.body.textContent).toContain("Auth loading");
	});

	it("renders the landing page when there is no current user", () => {
		mockUseCurrentUser.mockReturnValue({
			data: null,
			isLoading: false,
		});

		renderHomePage();

		expect(mockUseCurrentUser).toHaveBeenCalledTimes(1);
		expect(document.body.textContent).toContain("Landing home");
		expect(document.body.textContent).not.toContain("Dashboard for");
	});

	it("renders the dashboard when the current user exists", () => {
		mockUseCurrentUser.mockReturnValue({
			data: {
				did: "did:plc:alice",
				handle: "alice",
				displayName: "Alice",
				avatar: null,
				onboardingCompletedAt: null,
				needsOnboarding: false,
			},
			isLoading: false,
		});

		renderHomePage();

		expect(document.body.textContent).toContain("Dashboard for alice");
		expect(document.body.textContent).not.toContain("Landing home");
	});
});
