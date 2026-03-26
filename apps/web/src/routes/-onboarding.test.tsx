// @vitest-environment jsdom

import { usersControllerGetMyCurrentTraktImportOptions } from "@opnshelf/api";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OnboardingPage } from "./onboarding";

const mockNavigate = vi.fn();
const mockUseQuery = vi.fn();
const mockInvalidateQueries = vi.fn();
const mockPrefetchQuery = vi.fn();
const mockSetQueryData = vi.fn();
const mockFetchTrakt = vi.fn();
const mockStartTraktImport = vi.fn();
const mockUpdateProfile = vi.fn();
const mockUpdateSettings = vi.fn();
const mockImportHistory = vi.fn();
const mockImportBlueskyFollows = vi.fn();
const mockCompleteOnboarding = vi.fn();
const mockUploadAvatar = vi.fn();

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => () => ({}),
	useNavigate: () => mockNavigate,
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@tanstack/react-query")>();

	return {
		...actual,
		useQuery: (...args: unknown[]) => mockUseQuery(...args),
		useQueryClient: () => ({
			invalidateQueries: mockInvalidateQueries,
			prefetchQuery: mockPrefetchQuery,
			setQueryData: mockSetQueryData,
		}),
		useMutation: (options: { mutationKey?: unknown[] }) => {
			const mutationKey = JSON.stringify(options.mutationKey ?? []);

			switch (mutationKey) {
				case JSON.stringify(["users", "trakt", "history", "fetch"]):
					return { mutateAsync: mockFetchTrakt, isPending: false };
				case JSON.stringify(["users", "trakt", "history", "start"]):
					return { mutateAsync: mockStartTraktImport, isPending: false };
				case JSON.stringify(["users", "profile", "update"]):
					return { mutateAsync: mockUpdateProfile, isPending: false };
				case JSON.stringify(["users", "settings", "update"]):
					return { mutateAsync: mockUpdateSettings, isPending: false };
				case JSON.stringify(["users", "history", "import"]):
					return { mutateAsync: mockImportHistory, isPending: false };
				case JSON.stringify(["users", "bluesky", "follows", "import"]):
					return { mutateAsync: mockImportBlueskyFollows, isPending: false };
				case JSON.stringify(["users", "onboarding", "complete"]):
					return { mutateAsync: mockCompleteOnboarding, isPending: false };
				case JSON.stringify(["users", "profile", "avatar", "upload"]):
					return { mutateAsync: mockUploadAvatar, isPending: false };
				default:
					return { mutateAsync: vi.fn(), isPending: false };
			}
		},
	};
});

vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
		message: vi.fn(),
	},
}));

declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const user = {
	did: "did:plc:test",
	handle: "alice",
	displayName: "Alice Example",
	avatar: null,
	needsOnboarding: true,
};

const settings = {
	timezone: "UTC",
	timeFormat: "24h" as const,
};

const traktPreview = {
	profile: {
		username: "alice",
		slug: "alice",
		name: "Alice on Trakt",
		isPrivate: false,
		isVip: true,
		avatarUrl: undefined,
	},
	importableCount: 2,
	previewItems: [
		{
			type: "movie" as const,
			title: "Arrival",
			subtitle: "2016",
			watchedAt: "2026-03-20T10:00:00.000Z",
		},
	],
	items: [
		{
			type: "movie" as const,
			movieTmdbId: 329865,
			watchedAt: "2026-03-20T10:00:00.000Z",
			action: "watch" as const,
		},
		{
			type: "movie" as const,
			movieTmdbId: 603,
			watchedAt: "2026-03-19T10:00:00.000Z",
			action: "watch" as const,
		},
	],
	skipped: [],
	sourceCount: 4,
};

const startedImport = {
	profile: traktPreview.profile,
	previewItems: traktPreview.previewItems,
	sourcePreviewCount: 4,
	job: {
		id: "job-1",
		traktUsername: "alice",
		status: "queued" as const,
		currentPage: 0,
		totalPages: undefined,
		sourceCount: 0,
		normalizedCount: 0,
		importedCount: 0,
		skippedCount: 0,
		failedCount: 0,
		nextRunAt: "2026-03-24T10:00:00.000Z",
		lastError: undefined,
		profileUsername: "alice",
		profileSlug: "alice",
		profileName: "Alice on Trakt",
		profileAvatarUrl: undefined,
		startedAt: undefined,
		completedAt: undefined,
		createdAt: "2026-03-24T10:00:00.000Z",
		updatedAt: "2026-03-24T10:00:00.000Z",
	},
};

describe("OnboardingPage Trakt flow", () => {
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
	});

	function renderPage() {
		mockUseQuery.mockImplementation((options: { queryKey: unknown[] }) => {
			const queryKey = options.queryKey;
			const firstKey = queryKey?.[0];

			if (
				typeof firstKey === "object" &&
				firstKey !== null &&
				"_id" in firstKey &&
				firstKey._id === "authControllerMe"
			) {
				return { data: user, isLoading: false };
			}

			if (
				typeof firstKey === "object" &&
				firstKey !== null &&
				"_id" in firstKey &&
				firstKey._id === "usersControllerGetMySettings"
			) {
				return { data: settings, isLoading: false };
			}

			if (
				Array.isArray(queryKey) &&
				queryKey[0] === "auth" &&
				queryKey[1] === "me" &&
				queryKey[2] === "bluesky-profile-status"
			) {
				return {
					data: { hasBlueskyProfile: false },
					isLoading: false,
				};
			}

			return { data: undefined, isLoading: false };
		});

		mockUpdateProfile.mockResolvedValue({});
		mockUpdateSettings.mockResolvedValue(settings);
		mockFetchTrakt.mockResolvedValue(traktPreview);
		mockStartTraktImport.mockResolvedValue(startedImport);
		mockCompleteOnboarding.mockResolvedValue({
			onboardingCompletedAt: "2026-03-24T10:00:00.000Z",
			needsOnboarding: false,
		});

		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		act(() => {
			root?.render(<OnboardingPage />);
		});
	}

	function setInputValue(input: HTMLInputElement, value: string) {
		const descriptor = Object.getOwnPropertyDescriptor(
			window.HTMLInputElement.prototype,
			"value",
		);
		descriptor?.set?.call(input, value);
		input.dispatchEvent(new Event("input", { bubbles: true }));
		input.dispatchEvent(new Event("change", { bubbles: true }));
	}

	it("fetches a preview, confirms the import, and clears stale preview state on username change", async () => {
		renderPage();

		const beginSetupButton = Array.from(
			container?.querySelectorAll("button") ?? [],
		).find((button) => button.textContent?.includes("Begin setup"));

		act(() => {
			beginSetupButton?.dispatchEvent(
				new MouseEvent("click", { bubbles: true, cancelable: true }),
			);
		});

		const saveAndContinueButton = Array.from(
			container?.querySelectorAll("button") ?? [],
		).find((button) => button.textContent?.includes("Save and continue"));

		await act(async () => {
			saveAndContinueButton?.dispatchEvent(
				new MouseEvent("click", { bubbles: true, cancelable: true }),
			);
		});

		const usernameInput = container?.querySelector(
			'input[placeholder="your-trakt-handle"]',
		) as HTMLInputElement | null;
		expect(usernameInput).toBeTruthy();

		act(() => {
			if (usernameInput) {
				setInputValue(usernameInput, "alice");
			}
		});

		const fetchPreviewButton = Array.from(
			container?.querySelectorAll("button") ?? [],
		).find((button) => button.textContent?.includes("Fetch preview"));

		await act(async () => {
			fetchPreviewButton?.dispatchEvent(
				new MouseEvent("click", { bubbles: true, cancelable: true }),
			);
		});

		expect(mockFetchTrakt).toHaveBeenCalledWith({
			body: { username: "alice" },
		});
		expect(container?.textContent).toContain(
			"2 importable items found from 4 Trakt history rows.",
		);
		expect(container?.textContent).toContain("Import 2 items");
		expect(container?.textContent).not.toContain("Continue");

		const confirmImportButton = Array.from(
			container?.querySelectorAll("button") ?? [],
		).find((button) => button.textContent?.includes("Import 2 items"));

		await act(async () => {
			confirmImportButton?.dispatchEvent(
				new MouseEvent("click", { bubbles: true, cancelable: true }),
			);
		});

		expect(mockStartTraktImport).toHaveBeenCalledWith({
			body: { username: "alice" },
		});
		expect(mockInvalidateQueries).toHaveBeenCalledWith({
			queryKey: usersControllerGetMyCurrentTraktImportOptions().queryKey,
		});
		expect(container?.textContent).toContain("Background import");
		expect(container?.textContent).toContain("Queued");
		expect(container?.textContent).toContain("Continue");

		act(() => {
			if (usernameInput) {
				setInputValue(usernameInput, "bob");
			}
		});

		expect(container?.textContent).not.toContain("Import 2 items");
		expect(container?.textContent).not.toContain("Queued");
		expect(container?.textContent).toContain("Fetch preview");
		expect(container?.textContent).toContain("Skip import");
	});
});
