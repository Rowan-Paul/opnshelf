// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import Header from "./Header";

const mockNavigate = vi.fn();
const mockPublishSignedOutAuthState = vi.fn();
const mockMutateAsync = vi.fn();
const mockUseMutation = vi.fn();
const mockUseQueryClient = vi.fn();

vi.mock("@tanstack/react-query", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@tanstack/react-query")>();

	return {
		...actual,
		useMutation: (...args: unknown[]) => mockUseMutation(...args),
		useQueryClient: () => mockUseQueryClient(),
	};
});

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		...props
	}: {
		children: React.ReactNode;
		[key: string]: unknown;
	}) => <a {...props}>{children}</a>,
	useLocation: () => ({ pathname: "/" }),
	useNavigate: () => mockNavigate,
}));

vi.mock("@/components/theme-provider", () => ({
	useTheme: () => ({ seedColor: "#abcdef" }),
}));

vi.mock("@/components/ui/m3-button", () => ({
	M3Button: ({
		children,
		asChild,
		...props
	}: {
		children: React.ReactNode;
		asChild?: boolean;
		[key: string]: unknown;
	}) => (asChild ? children : <button {...props}>{children}</button>),
}));

vi.mock("@/components/ui/popover", () => ({
	Popover: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	PopoverTrigger: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	PopoverContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("@/lib/auth-cache", () => ({
	publishSignedOutAuthState: (...args: unknown[]) =>
		mockPublishSignedOutAuthState(...args),
}));

declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("Header logout", () => {
	let container: HTMLDivElement | null = null;
	let root: Root | null = null;

	afterEach(() => {
		vi.clearAllMocks();

		if (root) {
			act(() => {
				root.unmount();
			});
		}

		container?.remove();
		container = null;
		root = null;
		document.body.innerHTML = "";
	});

	function renderHeader(user: {
		did: string;
		handle: string;
		displayName: string;
	}) {
		mockUseQueryClient.mockReturnValue({ name: "query-client" });
		mockPublishSignedOutAuthState.mockResolvedValue(undefined);
		mockUseMutation.mockImplementation(
			(options: { onSuccess?: () => Promise<void> }) => {
				mockMutateAsync.mockImplementation(async () => {
					await options.onSuccess?.();
				});

				return {
					isPending: false,
					mutateAsync: mockMutateAsync,
				};
			},
		);

		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		act(() => {
			root?.render(<Header user={user} isAuthLoading={false} />);
		});
	}

	it("publishes signed-out auth state before navigating home", async () => {
		renderHeader({
			did: "did:plc:alice",
			handle: "alice",
			displayName: "Alice",
		});

		const signOutButton = Array.from(document.querySelectorAll("button")).find(
			(button) => button.textContent?.includes("Sign out"),
		);

		expect(signOutButton).toBeDefined();

		await act(async () => {
			signOutButton?.dispatchEvent(
				new MouseEvent("click", { bubbles: true, cancelable: true }),
			);
		});

		expect(mockMutateAsync).toHaveBeenCalledWith({});
		expect(mockPublishSignedOutAuthState).toHaveBeenCalledWith({
			name: "query-client",
		});
		expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
	});

	it("renders signed-out actions when no user is present", () => {
		mockUseQueryClient.mockReturnValue({ name: "query-client" });
		mockUseMutation.mockReturnValue({
			isPending: false,
			mutateAsync: mockMutateAsync,
		});

		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		act(() => {
			root?.render(<Header user={null} isAuthLoading={false} />);
		});

		expect(document.body.textContent).toContain("Sign in");
		expect(document.body.textContent).not.toContain("Sign out");
	});
});
