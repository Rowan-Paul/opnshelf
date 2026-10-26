import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FeedbackProvider, useFeedback } from "./feedback";

const mocks = vi.hoisted(() => ({
	capture: vi.fn(),
	mutate: vi.fn(),
	error: vi.fn(),
	onSuccess: undefined as (() => void) | undefined,
}));
vi.mock("react-native-view-shot", () => ({ captureScreen: mocks.capture }));
vi.mock("@opnshelf/api", () => ({
	feedbackControllerCreateFeedbackMutation: () => ({}),
}));
vi.mock("@tanstack/react-query", () => ({
	useMutation: (options: { onSuccess: () => void }) => {
		mocks.onSuccess = options.onSuccess;
		return { mutate: mocks.mutate, isPending: false };
	},
}));
vi.mock("expo-constants", () => ({
	default: { expoConfig: { version: "test" } },
}));
vi.mock("expo-haptics", () => ({
	notificationAsync: vi.fn(),
	NotificationFeedbackType: { Success: "success" },
}));
vi.mock("expo-router", () => ({ usePathname: () => "/profile" }));
vi.mock("lucide-react-native", () => ({
	Bug: "bug",
	Lightbulb: "idea",
	X: "close",
}));
vi.mock("react-native", () => ({
	Dimensions: { get: () => ({ width: 400, height: 800 }) },
	PixelRatio: { get: () => 3 },
	Image: "image",
	Modal: "modal",
	Pressable: "pressable",
	View: "view",
	ScrollView: "scroll",
	Platform: { OS: "android", Version: 37 },
}));
vi.mock("react-native-keyboard-controller", () => ({
	KeyboardAvoidingView: "avoiding",
	KeyboardProvider: "keyboard",
}));
vi.mock("@/components/ui/button", () => ({ Button: "button" }));
vi.mock("@/components/ui/text", () => ({ Text: "text" }));
vi.mock("@/components/ui/text-field", () => ({ TextField: "field" }));
vi.mock("@/components/ui/toast", () => ({
	useToast: () => ({ error: mocks.error, success: vi.fn() }),
}));
vi.mock("@/lib/posthog", () => ({ posthog: null }));
vi.mock("@/lib/use-tw-style", () => ({ useTwStyle: () => ({}) }));
vi.mock("@/theme/colors", () => ({ useThemeColors: () => ({}) }));

let open: () => void;
let view: ReactTestRenderer;
function Trigger() {
	open = useFeedback().open;
	return null;
}
beforeEach(async () => {
	vi.clearAllMocks();
	mocks.capture.mockResolvedValue("/9j/2Q==");
	await act(async () => {
		view = create(
			<FeedbackProvider>
				<Trigger />
			</FeedbackProvider>,
		);
	});
});
afterEach(() => {
	act(() => view.unmount());
});
function modal() {
	return view.root.findByType("modal" as never);
}
async function submit() {
	await act(async () => {
		view.root.findByType("field" as never).props.onChangeText("Test");
	});
	await act(async () => {
		view.root.findByType("button" as never).props.onPress();
	});
}
it("captures before opening, coalesces triggers, and submits the attachment", async () => {
	let resolve!: (value: string) => void;
	mocks.capture.mockReturnValue(
		new Promise<string>((done) => {
			resolve = done;
		}),
	);
	await act(async () => {
		open();
		open();
	});
	expect(modal().props.visible).toBe(false);
	expect(mocks.capture).toHaveBeenCalledOnce();
	await act(async () => {
		resolve("/9j/2Q==");
	});
	expect(modal().props.visible).toBe(true);
	expect(view.root.findByType("image" as never).props.source.uri).toBe(
		"data:image/jpeg;base64,/9j/2Q==",
	);
	await submit();
	expect(mocks.mutate.mock.calls[0][0].body.screenshot).toBe("/9j/2Q==");
});
it("allows removal and takes a fresh screenshot after closing", async () => {
	await act(async () => open());
	const remove = view.root
		.findAllByType("pressable" as never)
		.find((node) => node.props.accessibilityRole === "button");
	await act(async () => remove?.props.onPress());
	await submit();
	expect(mocks.mutate.mock.calls[0][0].body.screenshot).toBeUndefined();
	await act(async () => modal().props.onRequestClose());
	mocks.capture.mockResolvedValue("/9j/fresh");
	await act(async () => open());
	expect(view.root.findByType("image" as never).props.source.uri).toBe(
		"data:image/jpeg;base64,/9j/fresh",
	);
	expect(view.root.findByType("field" as never).props.value).toBe("");
});
it.each([
	"failure",
	"oversize",
])("opens text feedback on capture %s", async (failure) => {
	if (failure === "failure")
		mocks.capture.mockRejectedValue(new Error("No capture"));
	else mocks.capture.mockResolvedValue("a".repeat(80001));
	await act(async () => open());
	expect(modal().props.visible).toBe(true);
	expect(mocks.error).toHaveBeenCalledOnce();
	await submit();
	expect(mocks.mutate.mock.calls[0][0].body.screenshot).toBeUndefined();
});

it("preserves the closing modal and ignores a send from an earlier opening", async () => {
	await act(async () => open());
	await submit();
	const finishEarlierSend = mocks.onSuccess;
	const previousModal = modal();
	await act(async () => modal().props.onRequestClose());
	expect(modal()).toBe(previousModal);
	expect(modal().props.visible).toBe(false);
	mocks.capture.mockResolvedValue("/9j/fresh");
	await act(async () => open());
	await act(async () =>
		view.root.findByType("field" as never).props.onChangeText("New draft"),
	);
	await act(async () => finishEarlierSend?.());
	expect(modal().props.visible).toBe(true);
	expect(view.root.findByType("field" as never).props.value).toBe("New draft");
	expect(view.root.findByType("image" as never).props.source.uri).toBe(
		"data:image/jpeg;base64,/9j/fresh",
	);
});
