import { act } from "@testing-library/react";
import { vi } from "vitest";

/**
 * Helpers for testing async races in dialogs: a save that finishes after its
 * dialog closed, or after the dialog reopened. Settle `deferredCalls` results
 * out of order and watch whether a later opening closes or changes.
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

/**
 * Runs one step of a race inside act, then flushes the promise chains it
 * starts and TanStack Query's batched notifications (a zero-delay timeout).
 */
export async function step(run: () => unknown) {
	await act(async () => {
		await run();
		await new Promise((done) => setTimeout(done, 0));
	});
}
