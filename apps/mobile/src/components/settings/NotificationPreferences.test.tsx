import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationPreferences } from "./NotificationPreferences";

const mocks = vi.hoisted(() => ({
	settings: {
		email: "viewer@example.com",
		emailVerified: true,
		pushSyncErrors: true,
	},
	mutateAsync: vi.fn(),
}));
vi.mock("@opnshelf/api", () => ({
	notificationsControllerSettingsOptions: () => ({
		queryKey: ["notifications"],
	}),
	notificationsControllerConfirmEmailMutation: () => ({}),
	notificationsControllerRequestEmailMutation: () => ({}),
	notificationsControllerTestNotificationMutation: () => ({}),
	notificationsControllerUpdateSettingsMutation: () => ({}),
}));
vi.mock("@tanstack/react-query", () => ({
	useQuery: () => ({ data: mocks.settings, isLoading: false, isError: false }),
	useMutation: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
	useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
beforeEach(() => {
	mocks.settings = {
		email: "viewer@example.com",
		emailVerified: true,
		pushSyncErrors: true,
	};
	vi.clearAllMocks();
});

vi.mock("expo-device", () => ({ isDevice: false }));
vi.mock("expo-notifications", () => ({}));
vi.mock("@/lib/push-notifications", () => ({
	requestAndRegisterPush: vi.fn(),
}));
vi.mock("@/components/ui/toast", () => ({
	useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock("react-native", async () => {
	const { createElement } = await import("react");
	const host = (name: string) => (props: Record<string, unknown>) =>
		createElement(name, props, props.children as never);
	return { View: host("view"), Switch: host("switch"), AppState: {} };
});
vi.mock("@/components/ui/text", async () => {
	const { createElement } = await import("react");
	return {
		Text: (props: Record<string, unknown>) =>
			createElement("text", props, props.children as never),
	};
});
vi.mock("@/components/ui/button", async () => {
	const { createElement } = await import("react");
	return {
		Button: (props: Record<string, unknown>) => createElement("button", props),
	};
});
vi.mock("@/components/ui/text-field", async () => {
	const { createElement } = await import("react");
	return {
		TextField: (props: Record<string, unknown>) =>
			createElement("input", props),
	};
});
vi.mock("@/components/ui/states", () => ({ ErrorState: () => null }));
function render(onboarding = true) {
	let renderer!: ReactTestRenderer;
	act(() => {
		renderer = create(<NotificationPreferences onboarding={onboarding} />);
	});
	return renderer;
}
function buttons(renderer: ReactTestRenderer, label: string) {
	return renderer.root.findAll(
		(node) => node.type === "button" && node.props.label === label,
	);
}
describe("onboarding email disclosure", () => {
	it("opens and closes verified email options with an accessible expanded state", () => {
		const renderer = render();
		expect(buttons(renderer, "Send test email")).toHaveLength(0);
		expect(
			buttons(renderer, "Email options")[0].props.accessibilityState.expanded,
		).toBe(false);
		act(() => buttons(renderer, "Email options")[0].props.onPress());
		expect(buttons(renderer, "Send test email")).toHaveLength(1);
		expect(
			buttons(renderer, "Hide email options")[0].props.accessibilityState
				.expanded,
		).toBe(true);
		act(() => buttons(renderer, "Hide email options")[0].props.onPress());
		expect(buttons(renderer, "Send test email")).toHaveLength(0);
	});
	it("shows unverified setup without an ineffective toggle and collapses after verification", () => {
		mocks.settings.emailVerified = false;
		const renderer = render();
		expect(buttons(renderer, "Email options")).toHaveLength(0);
		expect(renderer.root.findAllByType("input")).toHaveLength(1);
		mocks.settings = {
			...mocks.settings,
			emailVerified: true,
			pushSyncErrors: true,
		};
		act(() => renderer.update(<NotificationPreferences onboarding />));
		expect(renderer.root.findAllByType("input")).toHaveLength(0);
		expect(buttons(renderer, "Email options")).toHaveLength(1);
		expect(renderer.root.findAllByType("switch")).toHaveLength(9);
	});
	it("keeps Settings maintenance options visible without a disclosure", () => {
		const renderer = render(false);
		expect(buttons(renderer, "Send test email")).toHaveLength(1);
		expect(buttons(renderer, "Email options")).toHaveLength(0);
	});
});

it("saves the dedicated sync preference without changing other categories", async () => {
	const renderer = render(false);
	const toggle = renderer.root.findAll(
		(node) =>
			node.type === "switch" &&
			node.props.accessibilityLabel === "Sync errors and disconnections",
	)[0];
	expect(toggle.props.value).toBe(true);
	// Like the other push categories, it needs OS permission first.
	expect(toggle.props.disabled).toBe(true);
	await act(async () => {
		await toggle.props.onValueChange(false);
	});
	expect(mocks.mutateAsync).toHaveBeenCalledWith({
		body: { pushSyncErrors: false },
	});
});
