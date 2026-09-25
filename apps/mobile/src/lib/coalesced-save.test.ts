import { describe, expect, it, vi } from "vitest";
import { createCoalescedSaver, sameIdSet } from "./coalesced-save";

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("createCoalescedSaver", () => {
	it("never overlaps writes and sends only the newest value after one settles", async () => {
		const first = deferred<void>();
		const save = vi.fn<(v: number[]) => Promise<void>>();
		save.mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
		const saver = createCoalescedSaver(save, sameIdSet);

		saver.submit([8]);
		saver.submit([8, 337]);
		saver.submit([8, 337, 2]);
		expect(save).toHaveBeenCalledTimes(1);
		expect(saver.isDirty()).toBe(true);

		first.resolve();
		await tick();
		await tick();

		expect(save).toHaveBeenCalledTimes(2);
		expect(save).toHaveBeenLastCalledWith([8, 337, 2]);
		expect(saver.isDirty()).toBe(false);
	});

	it("skips the queued write when it equals what was just sent", async () => {
		const first = deferred<void>();
		const save = vi.fn<(v: number[]) => Promise<void>>();
		save.mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
		const saver = createCoalescedSaver(save, sameIdSet);

		saver.submit([8]);
		saver.submit([8, 337]);
		saver.submit([8]);
		first.resolve();
		await tick();
		await tick();

		expect(save).toHaveBeenCalledTimes(1);
	});

	it("frees the line after a failed save so the next edit still goes out", async () => {
		const first = deferred<void>();
		const save = vi.fn<(v: number[]) => Promise<void>>();
		save.mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
		const saver = createCoalescedSaver(save, sameIdSet);

		saver.submit([8]);
		saver.submit([8, 337]);
		first.reject(new Error("offline"));
		await tick();
		await tick();

		expect(save).toHaveBeenCalledTimes(2);
		expect(save).toHaveBeenLastCalledWith([8, 337]);
	});
});

describe("sameIdSet", () => {
	it("ignores order and rejects different lengths", () => {
		expect(sameIdSet([1, 2], [2, 1])).toBe(true);
		expect(sameIdSet([1, 2], [1])).toBe(false);
	});
});
