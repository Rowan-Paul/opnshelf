import { createElement, type ReactNode } from "react";
import { act } from "react-test-renderer";
import { vi } from "vitest";

/**
 * Helpers for testing async races in sheets: a send that finishes after its
 * sheet closed, or after the sheet reopened. Settle `deferred` results out of
 * order and watch whether the keyboard is dismissed or a later opening closes.
 */

export interface Deferred<T> {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (reason?: unknown) => void;
}

/** A promise the test resolves or rejects on demand. */
export function deferred<T = void>(): Deferred<T> {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((done, fail) => {
		resolve = done;
		reject = fail;
	});
	return { promise, resolve, reject };
}

/** A mock whose every call stays pending; `calls[n]` settles the nth call. */
export function deferredCalls<T = unknown>() {
	const calls: Deferred<T>[] = [];
	const fn = vi.fn((..._args: unknown[]) => {
		const call = deferred<T>();
		calls.push(call);
		return call.promise;
	});
	return { fn, calls };
}

/** Runs one step of a race inside act and flushes the promise chains it starts. */
export async function step(run: () => unknown) {
	await act(async () => {
		await run();
	});
}

/** The keyboard the sheets dismiss; read `keyboard.dismiss` calls in tests. */
export const keyboard = { dismiss: vi.fn(() => Promise.resolve()) };

/** Holds the next keyboard dismissal until the test resolves it. */
export function holdKeyboardDismiss() {
	const hidden = deferred();
	keyboard.dismiss.mockReturnValueOnce(hidden.promise);
	return hidden;
}

function Passthrough({ children }: { children?: ReactNode }) {
	return children ?? null;
}

/**
 * Module for `vi.mock("react-native-keyboard-controller", ...)`. Mock
 * `@/components/ui/bottom-sheet-modal` as a `"modal"` host as well so the
 * shown state is `findByType("modal").props.visible`.
 */
export function keyboardControllerMock() {
	return {
		KeyboardController: keyboard,
		KeyboardProvider: Passthrough,
		KeyboardAvoidingView: Passthrough,
	};
}

/**
 * Stands in for an editor sheet: the real KeyboardSheetModal around a `name`
 * host that carries the sheet's props, so a parent test sees both its
 * keyboard dismissals and the props it passes.
 */
export async function keyboardSheetStandIn(name: string) {
	const { KeyboardSheetModal } = await import(
		"@/components/ui/keyboard-sheet-modal"
	);
	return function SheetStandIn(props: {
		visible: boolean;
		onDismiss: () => void;
	}) {
		return (
			<KeyboardSheetModal
				visible={props.visible}
				onRequestClose={props.onDismiss}
			>
				{createElement(name, props)}
			</KeyboardSheetModal>
		);
	};
}
