/**
 * Serialises whole-set saves so quick successive edits cannot race.
 *
 * Every submit records the latest desired value. While a save is in flight no
 * second request starts; when it settles, the newest desired value is sent if
 * it differs from what was last sent. Two toggles therefore produce two
 * ordered writes at most, and the last one always carries the full set, so
 * an earlier write can never land after a later one and undo it.
 */
export interface CoalescedSaver<T> {
	/** Record the desired value and save it as soon as the line is free. */
	submit(value: T): void;
	/** True while a save is in flight or another is queued behind it. */
	isDirty(): boolean;
}

export function createCoalescedSaver<T>(
	save: (value: T) => Promise<unknown>,
	isEqual: (a: T, b: T) => boolean = Object.is,
): CoalescedSaver<T> {
	let inFlight = false;
	let lastSent: T | undefined;
	let pending: { value: T } | null = null;

	const flush = async (value: T): Promise<void> => {
		inFlight = true;
		lastSent = value;
		try {
			await save(value);
		} catch {
			// The caller's mutation reports the failure; the queue only cares
			// that the line is free again.
		} finally {
			inFlight = false;
		}
		const next = pending;
		pending = null;
		if (next && (lastSent === undefined || !isEqual(next.value, lastSent))) {
			await flush(next.value);
		}
	};

	return {
		submit(value) {
			if (inFlight) {
				pending = { value };
				return;
			}
			void flush(value);
		},
		isDirty() {
			return inFlight || pending !== null;
		},
	};
}

export function sameIdSet(a: number[], b: number[]): boolean {
	if (a.length !== b.length) return false;
	const set = new Set(a);
	return b.every((id) => set.has(id));
}
