import { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@/test/render-hook";
import { useDebounce } from "./use-debounce";

afterEach(() => {
	vi.runOnlyPendingTimers();
	vi.useRealTimers();
});

describe("useDebounce", () => {
	it("returns the initial value immediately", () => {
		vi.useFakeTimers();
		const hook = renderHook(
			({ value, delayMs }) => useDebounce(value, delayMs),
			{ value: "first", delayMs: 250 },
		);

		expect(hook.result.current).toBe("first");
		hook.unmount();
	});

	it("keeps the previous value until the delay elapses", () => {
		vi.useFakeTimers();
		const hook = renderHook(
			({ value, delayMs }) => useDebounce(value, delayMs),
			{ value: "first", delayMs: 250 },
		);

		hook.rerender({ value: "second", delayMs: 250 });
		act(() => {
			vi.advanceTimersByTime(249);
		});
		expect(hook.result.current).toBe("first");

		act(() => {
			vi.advanceTimersByTime(1);
		});
		expect(hook.result.current).toBe("second");
		hook.unmount();
	});

	it("cancels the previous timer when rerendered", () => {
		vi.useFakeTimers();
		const hook = renderHook(
			({ value, delayMs }) => useDebounce(value, delayMs),
			{ value: "first", delayMs: 250 },
		);

		hook.rerender({ value: "second", delayMs: 250 });
		act(() => {
			vi.advanceTimersByTime(200);
		});
		hook.rerender({ value: "third", delayMs: 250 });
		act(() => {
			vi.advanceTimersByTime(50);
		});
		expect(hook.result.current).toBe("first");

		act(() => {
			vi.advanceTimersByTime(200);
		});
		expect(hook.result.current).toBe("third");
		hook.unmount();
	});

	it("clears its pending timer when unmounted", () => {
		vi.useFakeTimers();
		const hook = renderHook(
			({ value, delayMs }) => useDebounce(value, delayMs),
			{ value: "first", delayMs: 250 },
		);

		hook.rerender({ value: "second", delayMs: 250 });
		expect(vi.getTimerCount()).toBe(1);
		hook.unmount();
		expect(vi.getTimerCount()).toBe(0);
	});
});
