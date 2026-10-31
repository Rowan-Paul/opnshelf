import {
	POPFEED_INTEGRATION,
	type SyncStatusDto,
	TRAKT_INTEGRATION,
} from "@opnshelf/api";
import type { UseQueryResult } from "@tanstack/react-query";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
import { IntegrationOnboardingRow } from "./integration-onboarding-row";

const mocks = vi.hoisted(() => ({
	mutate: vi.fn(),
	options: undefined as
		| undefined
		| { onSuccess: (result: { url?: string }) => Promise<void> },
	openAuthSession: vi.fn(),
	invalidate: vi.fn(async () => undefined),
}));
vi.mock("@tanstack/react-query", () => ({
	useMutation: (options: typeof mocks.options) => {
		mocks.options = options;
		return { mutate: mocks.mutate, isPending: false, error: null };
	},
	useQueryClient: () => ({ invalidateQueries: mocks.invalidate }),
}));
vi.mock("react-native", () => ({ View: "view" }));
vi.mock("expo-web-browser", () => ({
	openAuthSessionAsync: mocks.openAuthSession,
}));
vi.mock("lucide-react-native", () => ({ Check: "icon" }));
vi.mock("@/theme/colors", () => ({
	useThemeColors: () => ({ success: "green" }),
}));
vi.mock("@/components/ui/text", () => ({ Text: "text" }));
vi.mock("@/components/ui/button", () => ({ Button: "button" }));
vi.mock("@/components/integrations/IntegrationMark", () => ({
	IntegrationMark: "mark",
}));
vi.mock("@/components/integrations/IntegrationSyncManager", () => ({
	SyncSettings: "settings",
}));

const status = (overrides: Partial<SyncStatusDto> = {}) =>
	({
		data: {
			configured: true,
			status: "disconnected",
			direction: "inbound",
			watches: true,
			ratings: true,
			historyScope: "all",
			publicationConsent: false,
			remaining: 0,
			needsAttention: 0,
			ignored: 0,
			...overrides,
		},
		error: null,
		isError: false,
	}) as unknown as UseQueryResult<SyncStatusDto>;

let renderer: ReactTestRenderer;
afterEach(() => {
	act(() => renderer.unmount());
	vi.clearAllMocks();
});
function mount(
	props: Partial<Parameters<typeof IntegrationOnboardingRow>[0]> = {},
) {
	const handlers = { onOpen: vi.fn(), onClose: vi.fn() };
	act(() => {
		renderer = create(
			<IntegrationOnboardingRow
				integration={POPFEED_INTEGRATION}
				status={status()}
				open={false}
				divided={false}
				{...handlers}
				{...props}
			/>,
		);
	});
	return handlers;
}
const button = () => renderer.root.findAllByType("button" as never)[0];

it("sets Popfeed up in place, then opens its settings", async () => {
	const { onOpen } = mount();
	expect(button().props.label).toBe("Set up");
	expect(button().props.accessibilityLabel).toBe("Set up Popfeed Sync");
	act(() => button().props.onPress());
	expect(mocks.mutate).toHaveBeenCalledWith({
		platform: "mobile",
		returnTo: "onboarding",
	});
	await act(async () => {
		await mocks.options?.onSuccess({});
	});
	expect(mocks.openAuthSession).not.toHaveBeenCalled();
	expect(onOpen).toHaveBeenCalled();
});

it("connects Trakt in the auth browser and opens its settings on return", async () => {
	const { onOpen } = mount({ integration: TRAKT_INTEGRATION });
	expect(button().props.label).toBe("Connect");
	expect(button().props.accessibilityLabel).toBe("Connect Trakt");
	mocks.openAuthSession.mockResolvedValue({
		type: "success",
		url: "opnshelf://onboarding?connection=connected",
	});
	await act(async () => {
		await mocks.options?.onSuccess({ url: "https://trakt.example" });
	});
	expect(mocks.openAuthSession).toHaveBeenCalledWith(
		"https://trakt.example",
		"opnshelf://onboarding",
	);
	expect(onOpen).toHaveBeenCalled();
});

it("stays put when the Trakt sign-in is dismissed", async () => {
	const { onOpen } = mount({ integration: TRAKT_INTEGRATION });
	mocks.openAuthSession.mockResolvedValue({ type: "cancel" });
	await act(async () => {
		await mocks.options?.onSuccess({ url: "https://trakt.example" });
	});
	expect(onOpen).not.toHaveBeenCalled();
});

it("shows the settings once open, and On when sync runs", () => {
	mount({
		status: status({ status: "paused", username: "reader.test" }),
		open: true,
	});
	expect(renderer.root.findAllByType("settings" as never)).toHaveLength(1);
	expect(renderer.root.findAllByType("button" as never)).toHaveLength(0);
	act(() =>
		renderer.update(
			<IntegrationOnboardingRow
				integration={POPFEED_INTEGRATION}
				status={status({ status: "active", username: "reader.test" })}
				open={false}
				divided={false}
				onOpen={vi.fn()}
				onClose={vi.fn()}
			/>,
		),
	);
	const texts = renderer.root
		.findAllByType("text" as never)
		.map((node) => node.props.children);
	expect(texts).toContain("On");
	expect(texts).toContain("@reader.test");
});
