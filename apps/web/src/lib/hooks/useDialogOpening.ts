import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Tracks openings of a dialog that closes itself when an async save succeeds.
 * Web port of Mobile's `useSheetOpening`; here the parent owns `open`, so the
 * hook follows the prop instead of holding the state.
 *
 * Every change of `open` starts a new opening. `startSave()` captures the
 * opening a save started in and returns a check that stays true only while
 * that opening is current. A save that finishes after the user closed the
 * dialog, or after they reopened it, should then leave the dialog alone.
 */
export function useDialogOpening(open: boolean) {
	const opening = useRef(0);
	const shown = useRef(open);
	// Layout effect so the new opening is in place before any pending save's
	// callbacks can run against the committed close or reopen.
	useLayoutEffect(() => {
		if (shown.current === open) return;
		shown.current = open;
		opening.current += 1;
	}, [open]);
	return useCallback(() => {
		const token = opening.current;
		return () => opening.current === token;
	}, []);
}
