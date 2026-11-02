import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BottomSheetModal } from "./bottom-sheet-modal";

vi.mock("react-native", () => ({
	Modal: "modal",
	View: "view",
}));

let view: ReactTestRenderer;
function render(visible: boolean) {
	const sheet = (
		<BottomSheetModal visible={visible} onRequestClose={vi.fn()}>
			sheet
		</BottomSheetModal>
	);
	if (view) view.update(sheet);
	else view = create(sheet);
}
function shown() {
	return view.root.findByType("modal" as never).props.visible;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
	act(() => view.unmount());
	view = undefined as never;
	vi.useRealTimers();
});

it("keeps the sheet up until the close animation has finished", async () => {
	await act(async () => render(true));
	expect(shown()).toBe(true);
	await act(async () => render(false));
	expect(shown()).toBe(true);
	await act(async () => {
		await vi.advanceTimersByTimeAsync(250);
	});
	expect(shown()).toBe(false);
});

it("stays open when reopened while closing", async () => {
	await act(async () => render(true));
	await act(async () => render(false));
	await act(async () => render(true));
	await act(async () => {
		await vi.advanceTimersByTimeAsync(250);
	});
	expect(shown()).toBe(true);
});

it("stays hidden when mounted hidden", async () => {
	await act(async () => render(false));
	expect(shown()).toBe(false);
});

it("reports the close once the sheet is gone, not when mounted hidden", async () => {
	const onClosed = vi.fn();
	const sheet = (visible: boolean) => (
		<BottomSheetModal
			visible={visible}
			onRequestClose={vi.fn()}
			onClosed={onClosed}
		>
			sheet
		</BottomSheetModal>
	);
	await act(async () => {
		view = create(sheet(false));
		await vi.advanceTimersByTimeAsync(250);
	});
	expect(onClosed).not.toHaveBeenCalled();
	await act(async () => view.update(sheet(true)));
	await act(async () => view.update(sheet(false)));
	expect(onClosed).not.toHaveBeenCalled();
	await act(async () => {
		await vi.advanceTimersByTimeAsync(250);
	});
	expect(onClosed).toHaveBeenCalledOnce();
	expect(shown()).toBe(false);
});
