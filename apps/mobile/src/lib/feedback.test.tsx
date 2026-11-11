import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { holdKeyboardDismiss, keyboard, step } from "@/test/async-races";
import { FeedbackProvider, useFeedback } from "./feedback";

const mocks = vi.hoisted(() => ({
	capture: vi.fn(),
	mutate: vi.fn(),
	error: vi.fn(),
	success: vi.fn(),
	onSuccess: undefined as (() => void) | undefined,
	onError: undefined as ((error: Error) => void) | undefined,
}));
vi.mock("react-native-view-shot", () => ({ captureScreen: mocks.capture }));
vi.mock("@opnshelf/api", () => ({
	feedbackControllerCreateFeedbackMutation: () => ({}),
}));
vi.mock("@tanstack/react-query", () => ({
	useMutation: (options: {
		onSuccess: () => void;
		onError: (error: Error) => void;
	}) => {
		mocks.onSuccess = options.onSuccess;
		mocks.onError = options.onError;
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
// The sheet's close animation is BottomSheetModal's concern; here it hides
// as soon as the keyboard has.
vi.mock("@/components/ui/bottom-sheet-modal", () => ({
	BottomSheetModal: "modal",
}));
vi.mock("react-native-keyboard-controller", async () =>
	(await import("@/test/async-races")).keyboardControllerMock(),
);
vi.mock("@/components/ui/button", () => ({ Button: "button" }));
vi.mock("@/components/ui/text", () => ({ Text: "text" }));
vi.mock("@/components/ui/text-field", () => ({ TextField: "field" }));
vi.mock("@/components/ui/toast", () => ({
	useToast: () => ({ error: mocks.error, success: mocks.success }),
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
	vi.useRealTimers();
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

it("recaptures a busy screen smaller until it fits the upload limit", async () => {
	mocks.capture
		.mockResolvedValueOnce("a".repeat(80001))
		.mockResolvedValueOnce("/9j/small");
	await act(async () => open());
	expect(mocks.capture).toHaveBeenCalledTimes(2);
	const [first, second] = mocks.capture.mock.calls.map(([options]) => options);
	expect(second.width * second.quality).toBeLessThan(
		first.width * first.quality,
	);
	expect(second.height / second.width).toBeCloseTo(first.height / first.width);
	expect(mocks.error).not.toHaveBeenCalled();
	expect(view.root.findByType("image" as never).props.source.uri).toBe(
		"data:image/jpeg;base64,/9j/small",
	);
	await submit();
	expect(mocks.mutate.mock.calls[0][0].body.screenshot).toBe("/9j/small");
});

it("opens text feedback when no recapture fits, after a bounded number of tries", async () => {
	mocks.capture.mockResolvedValue("a".repeat(80001));
	await act(async () => open());
	expect(mocks.capture.mock.calls.length).toBeGreaterThan(1);
	expect(mocks.capture.mock.calls.length).toBeLessThanOrEqual(3);
	expect(modal().props.visible).toBe(true);
	expect(mocks.error).toHaveBeenCalledOnce();
	await submit();
	expect(mocks.mutate.mock.calls[0][0].body.screenshot).toBeUndefined();
});

it("shares one timeout across recaptures and stops capturing once the sheet opens", async () => {
	vi.useFakeTimers();
	let resolve!: (image: string) => void;
	mocks.capture
		.mockImplementationOnce(
			() =>
				new Promise<string>((done) => {
					setTimeout(() => done("a".repeat(80001)), 2000);
				}),
		)
		.mockReturnValueOnce(
			new Promise<string>((done) => {
				resolve = done;
			}),
		);
	await act(async () => open());
	await act(async () => {
		await vi.advanceTimersByTimeAsync(2000);
	});
	expect(mocks.capture).toHaveBeenCalledTimes(2);
	expect(modal().props.visible).toBe(false);
	await act(async () => {
		await vi.advanceTimersByTimeAsync(1000);
	});
	expect(modal().props.visible).toBe(true);
	expect(mocks.error).toHaveBeenCalledOnce();
	// The late oversize result must not start a capture of the open sheet.
	await act(async () => resolve("a".repeat(80001)));
	expect(mocks.capture).toHaveBeenCalledTimes(2);
	expect(view.root.findAllByType("image" as never)).toHaveLength(0);
	expect(vi.getTimerCount()).toBe(0);
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

it("opens text feedback after a capture timeout and ignores its late result", async () => {
	vi.useFakeTimers();
	let resolve!: (image: string) => void;
	mocks.capture.mockReturnValue(
		new Promise<string>((done) => {
			resolve = done;
		}),
	);
	await act(async () => open());
	expect(modal().props.visible).toBe(false);
	await act(async () => {
		await vi.advanceTimersByTimeAsync(3000);
	});
	expect(modal().props.visible).toBe(true);
	expect(mocks.error).toHaveBeenCalledOnce();
	await submit();
	expect(mocks.mutate.mock.calls[0][0].body.screenshot).toBeUndefined();
	await act(async () => modal().props.onRequestClose());
	mocks.capture.mockResolvedValue("/9j/fresh");
	await act(async () => open());
	await act(async () => resolve("/9j/stale"));
	expect(view.root.findByType("image" as never).props.source.uri).toBe(
		"data:image/jpeg;base64,/9j/fresh",
	);
	expect(vi.getTimerCount()).toBe(0);
});

it("hides the keyboard before closing so screens behind keep their height", async () => {
	await act(async () => open());
	const keyboardHidden = holdKeyboardDismiss();
	await act(async () => modal().props.onRequestClose());
	expect(keyboard.dismiss).toHaveBeenCalledOnce();
	expect(modal().props.visible).toBe(true);
	await act(async () => keyboardHidden.resolve());
	expect(modal().props.visible).toBe(false);
});

it("leaves other screens' keyboards alone when a send finishes after closing", async () => {
	await act(async () => open());
	await submit();
	await act(async () => modal().props.onRequestClose());
	expect(keyboard.dismiss).toHaveBeenCalledOnce();
	await act(async () => mocks.onSuccess?.());
	expect(keyboard.dismiss).toHaveBeenCalledOnce();
	expect(modal().props.visible).toBe(false);
});

it("opens a fresh sheet after a send finished while closed", async () => {
	await act(async () => open());
	await submit();
	await step(() => modal().props.onRequestClose());
	await step(() => mocks.onSuccess?.());
	expect(keyboard.dismiss).toHaveBeenCalledOnce();
	mocks.capture.mockResolvedValue("/9j/fresh");
	await step(() => open());
	expect(modal().props.visible).toBe(true);
	expect(view.root.findByType("field" as never).props.value).toBe("");
	expect(keyboard.dismiss).toHaveBeenCalledOnce();
});

it("leaves a reopened sheet alone when the earlier send and keyboard settle late", async () => {
	await act(async () => open());
	await submit();
	const finishEarlierSend = mocks.onSuccess;
	const keyboardHidden = holdKeyboardDismiss();
	await step(() => modal().props.onRequestClose());
	await step(() => open());
	await step(() =>
		view.root.findByType("field" as never).props.onChangeText("New draft"),
	);
	await step(() => finishEarlierSend?.());
	await step(() => keyboardHidden.resolve());
	expect(modal().props.visible).toBe(true);
	expect(view.root.findByType("field" as never).props.value).toBe("New draft");
	expect(keyboard.dismiss).toHaveBeenCalledOnce();
});

it("still reports an earlier send that fails after a newer one succeeded", async () => {
	await act(async () => open());
	await submit();
	const failEarlierSend = mocks.onError;
	await step(() => modal().props.onRequestClose());
	await step(() => open());
	await submit();
	await step(() => mocks.onSuccess?.());
	expect(modal().props.visible).toBe(false);
	// Each send is its own report, so the newer one does not replace it: the
	// user must hear that the earlier report was lost.
	await step(() => failEarlierSend?.(new Error("Network")));
	expect(mocks.error).toHaveBeenCalledWith("Network");
	expect(modal().props.visible).toBe(false);
	expect(keyboard.dismiss).toHaveBeenCalledTimes(2);
});
