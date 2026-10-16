import { useState } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type NotificationStage, NotificationStep } from "./notification-step";

const mocks = vi.hoisted(() => ({
	noData: false,
	loadFailed: false,
	settings: {
		email: null as string | null,
		emailVerified: false,
		pushDeviceCount: 0,
		pushWatchlistReleases: false,
		pushNewSeasons: false,
		pushNewReleases: false,
		pushStats: false,
		emailWatchlistReleases: true,
		emailNewSeasons: true,
		emailNewReleases: true,
		emailStats: true,
	},
	request: vi.fn(),
	confirm: vi.fn(),
	update: vi.fn(),
	push: vi.fn(),
	refresh: vi.fn(),
	next: vi.fn(),
	busy: vi.fn(),
}));
vi.mock("@opnshelf/api", () => ({
	getErrorMessage: (error: { message?: string }, fallback: string) =>
		error.message ?? fallback,
	notificationsControllerSettingsOptions: () => ({
		queryKey: ["notifications"],
	}),
	notificationsControllerRequestEmailMutation: () => ({
		mutationFn: mocks.request,
	}),
	notificationsControllerConfirmEmailMutation: () => ({
		mutationFn: mocks.confirm,
	}),
	notificationsControllerUpdateSettingsMutation: () => ({
		mutationFn: mocks.update,
	}),
}));
vi.mock("@tanstack/react-query", () => ({
	useQuery: () => ({
		data: mocks.noData ? undefined : mocks.settings,
		isError: mocks.loadFailed,
	}),
	useMutation: (options: { mutationFn: unknown }) => ({
		mutateAsync: options.mutationFn,
	}),
	useQueryClient: () => ({ invalidateQueries: mocks.refresh }),
}));
vi.mock("expo-device", () => ({ isDevice: true }));
vi.mock("@/lib/push-notifications", () => ({
	requestAndRegisterPush: mocks.push,
}));
vi.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ bottom: 0 }),
}));
vi.mock("react-native", async () => {
	const { createElement } = await import("react");
	const host = (name: string) => (props: Record<string, unknown>) =>
		createElement(name, props, props.children as never);
	return {
		View: host("view"),
		Pressable: host("pressable"),
		ScrollView: host("scroll"),
	};
});
vi.mock("lucide-react-native", () => ({
	Bell: () => null,
	Mail: () => null,
	Check: () => null,
}));
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

function Harness() {
	const [stage, setStage] = useState<NotificationStage>("topics");
	return (
		<NotificationStep
			stage={stage}
			onStageChange={setStage}
			onBusyChange={mocks.busy}
			onNext={mocks.next}
		/>
	);
}
function render() {
	let renderer!: ReactTestRenderer;
	act(() => {
		renderer = create(<Harness />);
	});
	return renderer;
}
function button(renderer: ReactTestRenderer, label: string) {
	return renderer.root.find(
		(node) =>
			(node.type === "button" && node.props.label === label) ||
			(String(node.type) === "pressable" &&
				node.props.accessibilityLabel === label),
	);
}
async function press(renderer: ReactTestRenderer, label: string) {
	await act(async () => {
		button(renderer, label).props.onPress();
	});
}
function input(renderer: ReactTestRenderer, label: string, value: string) {
	act(() => {
		renderer.root
			.find((node) => node.type === "input" && node.props.label === label)
			.props.onChangeText(value);
	});
}
const mobileTopics = {
	pushWatchlistReleases: true,
	pushNewSeasons: true,
	pushNewReleases: false,
	pushStats: false,
};
const noEmail = {
	emailWatchlistReleases: false,
	emailNewSeasons: false,
	emailNewReleases: false,
	emailStats: false,
};

beforeEach(() => {
	vi.resetAllMocks();
	mocks.noData = false;
	mocks.loadFailed = false;
	mocks.settings.email = null;
	mocks.settings.emailVerified = false;
	mocks.push.mockResolvedValue(true);
	mocks.request.mockResolvedValue(undefined);
	mocks.confirm.mockResolvedValue({});
	mocks.update.mockResolvedValue({});
	mocks.refresh.mockResolvedValue(undefined);
});

describe("notification onboarding", () => {
	it.each([
		false,
		true,
	])("allows skipping unavailable settings (error: %s)", async (failed) => {
		mocks.noData = true;
		mocks.loadFailed = failed;
		const renderer = render();
		await press(renderer, "Not now");
		expect(mocks.next).toHaveBeenCalledOnce();
		expect(mocks.update).not.toHaveBeenCalled();
	});
	it("turns delivery off explicitly when no channel is selected", async () => {
		const renderer = render();
		await press(renderer, "Choose delivery");
		await press(renderer, "On my mobile");
		await press(renderer, "Continue without alerts");
		expect(mocks.push).not.toHaveBeenCalled();
		expect(mocks.update).toHaveBeenCalledWith({
			body: {
				...noEmail,
				pushWatchlistReleases: false,
				pushNewSeasons: false,
				pushNewReleases: false,
				pushStats: false,
			},
		});
		expect(mocks.next).toHaveBeenCalledOnce();
	});

	it("keeps checkbox choices local, then saves only chosen topics and channels", async () => {
		const renderer = render();
		await press(renderer, "Weekly new releases");
		expect(mocks.update).not.toHaveBeenCalled();
		await press(renderer, "Choose delivery");
		expect(renderer.root.findAllByType("input")).toHaveLength(0);
		await press(renderer, "Continue with mobile");
		expect(mocks.push).toHaveBeenCalledOnce();
		expect(mocks.update).toHaveBeenCalledWith({
			body: { ...mobileTopics, pushNewReleases: true, ...noEmail },
		});
		expect(mocks.next).toHaveBeenCalledOnce();
	});
	it("skips without registering, sending email or changing existing preferences", async () => {
		const renderer = render();
		await press(renderer, "Choose delivery");
		await press(renderer, "In my inbox");
		await press(renderer, "Not now");
		expect(mocks.next).toHaveBeenCalledOnce();
		expect(mocks.push).not.toHaveBeenCalled();
		expect(mocks.request).not.toHaveBeenCalled();
		expect(mocks.update).not.toHaveBeenCalled();
	});
	it("confirms an unverified email before requesting mobile permission and saving both", async () => {
		const renderer = render();
		await press(renderer, "Choose delivery");
		await press(renderer, "In my inbox");
		expect(button(renderer, "Continue with both").props.disabled).toBe(true);
		input(renderer, "Email address", " Viewer@Example.com ");
		await press(renderer, "Continue with both");
		expect(mocks.request).toHaveBeenCalledWith({
			body: { email: "viewer@example.com" },
		});
		expect(mocks.push).not.toHaveBeenCalled();
		expect(mocks.update).not.toHaveBeenCalled();
		input(renderer, "Six-digit code", "123456");
		await press(renderer, "Confirm and continue");
		expect(mocks.confirm).toHaveBeenCalledWith({ body: { code: "123456" } });
		expect(mocks.update).toHaveBeenCalledWith({
			body: {
				...mobileTopics,
				...noEmail,
				emailWatchlistReleases: true,
				emailNewSeasons: true,
			},
		});
		expect(mocks.next).toHaveBeenCalledOnce();
	});
	it("uses a verified address without another confirmation and supports email alone", async () => {
		mocks.settings.email = "viewer@example.com";
		mocks.settings.emailVerified = true;
		const renderer = render();
		await press(renderer, "Choose delivery");
		await press(renderer, "On my mobile");
		await press(renderer, "In my inbox");
		await press(renderer, "Continue with email");
		expect(mocks.push).not.toHaveBeenCalled();
		expect(mocks.request).not.toHaveBeenCalled();
		expect(mocks.update).toHaveBeenCalledWith({
			body: {
				pushWatchlistReleases: false,
				pushNewSeasons: false,
				pushNewReleases: false,
				pushStats: false,
				emailWatchlistReleases: true,
				emailNewSeasons: true,
				emailNewReleases: true,
				emailStats: true,
			},
		});
	});
	it("keeps delivery choices visible after denied permission and permits a retry", async () => {
		mocks.push.mockResolvedValueOnce(false);
		const renderer = render();
		await press(renderer, "Choose delivery");
		await press(renderer, "Continue with mobile");
		expect(mocks.update).not.toHaveBeenCalled();
		expect(mocks.next).not.toHaveBeenCalled();
		expect(
			renderer.root.findAll(
				(node) =>
					node.type === "text" && node.props.accessibilityRole === "alert",
			),
		).toHaveLength(1);
		await press(renderer, "Continue with mobile");
		expect(mocks.next).toHaveBeenCalledOnce();
	});
	it("does not advance on invalid codes or failed saves", async () => {
		mocks.confirm.mockRejectedValueOnce(new Error("Invalid code"));
		mocks.update.mockRejectedValueOnce(new Error("Could not save"));
		const renderer = render();
		await press(renderer, "Choose delivery");
		await press(renderer, "On my mobile");
		await press(renderer, "In my inbox");
		input(renderer, "Email address", "viewer@example.com");
		await press(renderer, "Continue with email");
		input(renderer, "Six-digit code", "123456");
		await press(renderer, "Confirm and continue");
		expect(mocks.update).not.toHaveBeenCalled();
		await press(renderer, "Confirm and continue");
		expect(mocks.next).not.toHaveBeenCalled();
		await press(renderer, "Continue with email");
		expect(mocks.confirm).toHaveBeenCalledTimes(2);
		expect(mocks.request).toHaveBeenCalledOnce();
		expect(mocks.next).toHaveBeenCalledOnce();
	});
	it("guards double submits while setup is in flight", async () => {
		let resolvePush!: (registered: boolean) => void;
		mocks.push.mockReturnValue(
			new Promise<boolean>((resolve) => {
				resolvePush = resolve;
			}),
		);
		const renderer = render();
		await press(renderer, "Choose delivery");
		await act(async () => {
			const submit = button(renderer, "Continue with mobile").props.onPress;
			submit();
			submit();
		});
		expect(mocks.push).toHaveBeenCalledOnce();
		expect(button(renderer, "Not now").props.disabled).toBe(true);
		await act(async () => {
			resolvePush(true);
		});
		expect(mocks.update).toHaveBeenCalledOnce();
	});
});
