// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./profile.$handle.settings";

const mockNavigate = vi.fn();
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockUseQueryClient = vi.fn();
const mockPublishSignedOutAuthState = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockCapture = vi.fn();
const mockReset = vi.fn();

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => () => ({}),
	redirect: vi.fn(),
	useRouter: () => ({
		navigate: mockNavigate,
	}),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@tanstack/react-query")>();

	return {
		...actual,
		useQuery: (...args: unknown[]) => mockUseQuery(...args),
		useMutation: (...args: unknown[]) => mockUseMutation(...args),
		useQueryClient: () => mockUseQueryClient(),
	};
});

vi.mock("@posthog/react", () => ({
	usePostHog: () => ({
		capture: mockCapture,
		reset: mockReset,
	}),
}));

vi.mock("sonner", () => ({
	toast: {
		success: (...args: unknown[]) => mockToastSuccess(...args),
		error: (...args: unknown[]) => mockToastError(...args),
	},
}));

vi.mock("@/components/theme-provider", () => ({
	useTheme: () => ({ seedColor: "#336699" }),
}));

vi.mock("@/components/AuthLoadingState", () => ({
	AuthLoadingState: ({ className }: { className?: string }) => (
		<div className={className}>Loading...</div>
	),
}));

vi.mock("@/components/ui/dialog", () => ({
	Dialog: ({
		children,
		open,
	}: {
		children: React.ReactNode;
		open?: boolean;
	}) => (open ? <div>{children}</div> : null),
	DialogContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DialogDescription: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DialogFooter: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DialogHeader: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DialogTitle: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("@/components/ui/m3-button", () => ({
	M3Button: ({
		children,
		...props
	}: {
		children: React.ReactNode;
		[key: string]: unknown;
	}) => <button {...props}>{children}</button>,
}));

vi.mock("@/components/ui/m3-card", () => ({
	M3Card: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	M3CardContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	M3CardDescription: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	M3CardHeader: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	M3CardTitle: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("@/components/ui/select", () => ({
	Select: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	SelectContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	SelectItem: ({
		children,
		value,
	}: {
		children: React.ReactNode;
		value: string;
	}) => <option value={value}>{children}</option>,
	SelectTrigger: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	SelectValue: ({ placeholder }: { placeholder?: string }) => (
		<span>{placeholder}</span>
	),
}));

vi.mock("@/components/ui/label", () => ({
	Label: ({
		children,
		...props
	}: {
		children: React.ReactNode;
		[key: string]: unknown;
	}) => <span {...props}>{children}</span>,
}));

vi.mock("@/components/ui/skeleton", () => ({
	Skeleton: ({ className }: { className?: string }) => (
		<div className={className} />
	),
}));

vi.mock("@/components/ui/switch", () => ({
	Switch: ({
		checked,
		onCheckedChange,
		disabled,
	}: {
		checked: boolean;
		onCheckedChange: (checked: boolean) => void;
		disabled?: boolean;
	}) => (
		<input
			type="checkbox"
			checked={checked}
			onChange={(event) => onCheckedChange(event.target.checked)}
			disabled={disabled}
		/>
	),
}));

vi.mock("@/lib/auth-cache", () => ({
	publishSignedOutAuthState: (...args: unknown[]) =>
		mockPublishSignedOutAuthState(...args),
}));

vi.mock("@/lib/avatar-upload", () => ({
	AVATAR_UPLOAD_HELP_TEXT: "Upload help",
	getAvatarUploadErrorMessage: vi.fn(),
	validateAvatarFile: vi.fn(),
}));

vi.mock("@/lib/profile-routes", () => ({
	getProfileRoute: vi.fn(),
	isOwnerProfile: vi.fn(() => true),
}));

vi.mock("@/lib/ssr-auth-headers", () => ({
	getSsrAuthHeaders: vi.fn(),
}));

vi.mock("@/lib/timezones", () => ({
	TIMEZONE_GROUPS: [],
}));

declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("SettingsPage account deletion", () => {
	let container: HTMLDivElement | null = null;
	let root: Root | null = null;

	afterEach(() => {
		vi.clearAllMocks();

		if (root) {
			act(() => {
				root?.unmount();
			});
		}

		container?.remove();
		container = null;
		root = null;
		document.body.innerHTML = "";
		window.localStorage.clear();
	});

	it("shows the account deleted toast only once for completed background deletions", async () => {
		const user = {
			did: "did:plc:alice",
			handle: "alice",
			displayName: "Alice",
			avatar: null,
			needsOnboarding: false,
		};
		const settings = {
			timezone: "UTC",
			timeFormat: "24h" as const,
		};
		const queryClient = {
			invalidateQueries: vi.fn(),
			setQueryData: vi.fn(),
		};

		mockUseQueryClient.mockReturnValue(queryClient);
		mockPublishSignedOutAuthState.mockResolvedValue(undefined);

		mockUseQuery.mockImplementation(
			(options: { enabled?: boolean; queryKey?: Array<{ _id?: string }> }) => {
				const queryId = options.queryKey?.[0]?._id;

				if (queryId === "authControllerMe") {
					return { data: user, isLoading: false };
				}

				if (queryId === "usersControllerGetMySettings") {
					return { data: settings, isLoading: false };
				}

				if (queryId === "usersControllerGetMyAccountDeletion") {
					if (!options.enabled) {
						return { data: undefined, error: null, isLoading: false };
					}

					return {
						data: {
							id: "job-1",
							status: "completed" as const,
							totalRecords: 10,
							deletedRecords: 10,
							currentStep: "completed",
							createdAt: "2026-03-27T12:00:00.000Z",
						},
						error: null,
						isLoading: false,
					};
				}

				return { data: undefined, error: null, isLoading: false };
			},
		);

		mockUseMutation.mockImplementation(
			(options: {
				mutationKey?: unknown[];
				onSuccess?: (data?: unknown) => Promise<void> | void;
			}) => {
				const mutationKey = JSON.stringify(options.mutationKey ?? []);

				if (mutationKey === JSON.stringify(["users", "account", "delete"])) {
					return {
						isPending: false,
						mutate: () => {
							void options.onSuccess?.({
								id: "job-1",
								status: "queued",
								totalRecords: 10,
								deletedRecords: 0,
								currentStep: "movies",
								createdAt: "2026-03-27T12:00:00.000Z",
							});
						},
					};
				}

				return {
					isPending: false,
					mutate: vi.fn(),
				};
			},
		);

		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root?.render(<SettingsPage />);
		});

		const openDeleteDialogButton = Array.from(
			document.querySelectorAll("button"),
		).find((button) => button.textContent?.includes("Delete Account"));

		expect(openDeleteDialogButton).toBeDefined();

		await act(async () => {
			openDeleteDialogButton?.dispatchEvent(
				new MouseEvent("click", { bubbles: true, cancelable: true }),
			);
		});

		const deleteButtons = Array.from(
			document.querySelectorAll("button"),
		).filter((button) => button.textContent?.includes("Delete Account"));
		const confirmDeleteButton = deleteButtons.at(-1);

		expect(confirmDeleteButton).toBeDefined();

		await act(async () => {
			confirmDeleteButton?.dispatchEvent(
				new MouseEvent("click", { bubbles: true, cancelable: true }),
			);
		});

		await act(async () => {
			await Promise.resolve();
		});

		expect(mockToastSuccess).toHaveBeenCalledTimes(1);
		expect(mockToastSuccess).toHaveBeenCalledWith("Account deleted");
		expect(mockPublishSignedOutAuthState).toHaveBeenCalledTimes(1);
		expect(mockPublishSignedOutAuthState).toHaveBeenCalledWith(queryClient);
		expect(mockNavigate).toHaveBeenCalledTimes(1);
		expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
		expect(mockCapture).toHaveBeenCalledTimes(1);
		expect(mockCapture).toHaveBeenCalledWith("account_deleted", {
			deleted_pds_data: true,
		});
		expect(mockReset).toHaveBeenCalledTimes(1);
	});
});
