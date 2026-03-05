import { useEffect, useRef, useState } from "react";

export function useDebouncedSearch(value: string, delayMs: number) {
	const [debouncedValue, setDebouncedValue] = useState(value);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}

		debounceRef.current = setTimeout(() => {
			setDebouncedValue(value.trim());
		}, delayMs);

		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, [value, delayMs]);

	return debouncedValue;
}
