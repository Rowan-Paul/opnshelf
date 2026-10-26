import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { KeyboardSheetModal } from "./keyboard-sheet-modal";

const mocks = vi.hoisted(() => ({
	dismissKeyboard: vi.fn(() => Promise.resolve()),
}));
vi.mock("react-native", () => ({ Modal: "modal" }));
vi.mock("react-native-keyboard-controller", () => ({
	KeyboardController: { dismiss: mocks.dismissKeyboard },
	KeyboardProvider: "keyboard",
}));

let view: ReactTestRenderer;
function render(visible: boolean) {
	const sheet = (
		<KeyboardSheetModal visible={visible} onRequestClose={vi.fn()}>
			sheet
		</KeyboardSheetModal>
	);
	if (view) view.update(sheet);
	else view = create(sheet);
}
function shown() {
	return view.root.findByType("modal" as never).props.visible;
}
function deferDismiss() {
	let done!: () => void;
	mocks.dismissKeyboard.mockReturnValueOnce(
		new Promise<void>((resolve) => {
			done = resolve;
		}),
	);
	return () => done();
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
	act(() => view.unmount());
	view = undefined as never;
});

it("leaves other screens' keyboards alone while mounted hidden", async () => {
	await act(async () => render(false));
	await act(async () => render(false));
	expect(shown()).toBe(false);
	expect(mocks.dismissKeyboard).not.toHaveBeenCalled();
});

it("keeps the sheet up until the keyboard has hidden", async () => {
	await act(async () => render(true));
	const keyboardHidden = deferDismiss();
	await act(async () => render(false));
	expect(mocks.dismissKeyboard).toHaveBeenCalledOnce();
	expect(shown()).toBe(true);
	await act(async () => keyboardHidden());
	expect(shown()).toBe(false);
});

it("stays open when reopened while the keyboard is hiding", async () => {
	await act(async () => render(true));
	const keyboardHidden = deferDismiss();
	await act(async () => render(false));
	await act(async () => render(true));
	await act(async () => keyboardHidden());
	expect(shown()).toBe(true);
});

it("releases WebView focus before hiding the keyboard", async () => {
	const releaseFocus = vi.fn();
	await act(async () => {
		view = create(
			<KeyboardSheetModal
				visible
				onRequestClose={vi.fn()}
				releaseFocus={releaseFocus}
			>
				sheet
			</KeyboardSheetModal>,
		);
	});
	expect(releaseFocus).not.toHaveBeenCalled();
	await act(async () =>
		view.update(
			<KeyboardSheetModal
				visible={false}
				onRequestClose={vi.fn()}
				releaseFocus={releaseFocus}
			>
				sheet
			</KeyboardSheetModal>,
		),
	);
	expect(releaseFocus).toHaveBeenCalledOnce();
	expect(releaseFocus.mock.invocationCallOrder[0]).toBeLessThan(
		mocks.dismissKeyboard.mock.invocationCallOrder[0],
	);
});

it("closes anyway when the keyboard-hidden event never arrives", async () => {
	vi.useFakeTimers();
	await act(async () => render(true));
	mocks.dismissKeyboard.mockReturnValueOnce(new Promise<void>(() => {}));
	await act(async () => render(false));
	expect(shown()).toBe(true);
	await act(async () => {
		await vi.advanceTimersByTimeAsync(500);
	});
	expect(shown()).toBe(false);
	vi.useRealTimers();
});
