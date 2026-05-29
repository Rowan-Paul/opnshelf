import { useEffect, useState } from "react";

/**
 * Returns a debounced copy of `value` that only updates after `delayMs` of
 * no further changes. Used to throttle search input so we don't fire a query
 * on every keystroke.
 */
export function useDebounce<T>(value: T, delayMs: number): T {
	const [debounced, setDebounced] = useState(value);

	useEffect(() => {
		const handle = setTimeout(() => setDebounced(value), delayMs);
		return () => clearTimeout(handle);
	}, [value, delayMs]);

	return debounced;
}
