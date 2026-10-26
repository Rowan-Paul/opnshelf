import { type ReactNode, useEffect, useRef, useState } from "react";
import { Modal } from "react-native";
import {
	KeyboardController,
	KeyboardProvider,
} from "react-native-keyboard-controller";

/** Longest wait for the keyboard to hide before closing anyway; the hide
 * animation takes about 250 ms. */
const KEYBOARD_HIDE_FALLBACK_MS = 500;

/**
 * Slide-up transparent `<Modal>` for bottom sheets with text inputs.
 *
 * RN <Modal> renders in a separate window outside the root KeyboardProvider
 * (notably on Android), so the keyboard controller receives no events there.
 * Nesting a KeyboardProvider inside the Modal re-bridges those events, letting
 * a KeyboardAvoidingView in `children` lift the sheet above the keyboard.
 *
 * When `visible` turns false the Modal stays up until the keyboard has hidden:
 * closing it with the keyboard open leaves the root KeyboardProvider at
 * keyboard height on Android, so every Screen behind it keeps a blank
 * keyboard-sized gap (#595). Only a visible → hidden change dismisses the
 * keyboard, so a sheet mounted hidden never touches another screen's input.
 */
export function KeyboardSheetModal({
	visible,
	onRequestClose,
	releaseFocus,
	children,
}: {
	visible: boolean;
	onRequestClose: () => void;
	/** Blurs inputs the keyboard controller can't dismiss, such as a WebView. */
	releaseFocus?: () => void;
	children: ReactNode;
}) {
	const [shown, setShown] = useState(visible);
	const latest = useRef(visible);
	const release = useRef(releaseFocus);
	release.current = releaseFocus;

	useEffect(() => {
		const wasVisible = latest.current;
		latest.current = visible;
		if (visible) {
			setShown(true);
			return;
		}
		if (!wasVisible) return;
		release.current?.();
		// dismiss() waits for keyboardDidHide but only hides native inputs; if a
		// keyboard it can't reach stays up, the fallback keeps the sheet from
		// hanging open.
		let fallback: ReturnType<typeof setTimeout> | undefined;
		void Promise.race([
			KeyboardController.dismiss(),
			new Promise((resolve) => {
				fallback = setTimeout(
					() => resolve(undefined),
					KEYBOARD_HIDE_FALLBACK_MS,
				);
			}),
		]).finally(() => {
			clearTimeout(fallback);
			// Reopened while the keyboard was hiding: keep the sheet up.
			if (!latest.current) setShown(false);
		});
	}, [visible]);

	return (
		<Modal
			visible={shown}
			animationType="slide"
			transparent
			onRequestClose={onRequestClose}
		>
			<KeyboardProvider>{children}</KeyboardProvider>
		</Modal>
	);
}
