import { useCallback, useRef, useState } from "react";

/**
 * Visibility for a sheet that closes itself when an async save succeeds.
 *
 * Every open and close starts a new opening. `closeIfCurrent()` captures the
 * opening a save started in; calling the returned function later closes the
 * sheet only if that opening is still the current one. A save that finishes
 * after the user closed the sheet, or after they reopened it, leaves it alone.
 */
export function useSheetOpening() {
	const [visible, setVisible] = useState(false);
	const opening = useRef(0);
	const open = useCallback(() => {
		opening.current += 1;
		setVisible(true);
	}, []);
	const close = useCallback(() => {
		opening.current += 1;
		setVisible(false);
	}, []);
	const closeIfCurrent = useCallback(() => {
		const token = opening.current;
		return () => {
			if (opening.current === token) close();
		};
	}, [close]);
	return { visible, open, close, closeIfCurrent };
}
