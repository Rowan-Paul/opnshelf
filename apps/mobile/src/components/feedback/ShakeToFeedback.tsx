import { Accelerometer } from "expo-sensors";
import { useEffect } from "react";
import { useFeedback } from "@/lib/feedback";

/** g-force magnitude above which we treat motion as a shake (rest ≈ 1g). */
const SHAKE_THRESHOLD = 1.8;
/** Min gap between triggers so one shake doesn't reopen the sheet repeatedly. */
const SHAKE_COOLDOWN_MS = 1000;

/**
 * Opens the feedback sheet when the device is shaken. Renders nothing.
 *
 * Mounted inside the authed `(tabs)` layout only — feedback needs auth, and we
 * don't want it firing on login/onboarding. Disabled in dev because a shake
 * there opens React Native's dev menu; test the flow via the Settings entry.
 */
export function ShakeToFeedback() {
	const { open } = useFeedback();

	useEffect(() => {
		if (__DEV__) return;
		Accelerometer.setUpdateInterval(100);
		let last = 0;
		const sub = Accelerometer.addListener(({ x, y, z }) => {
			const g = Math.sqrt(x * x + y * y + z * z);
			const now = Date.now();
			if (g > SHAKE_THRESHOLD && now - last > SHAKE_COOLDOWN_MS) {
				last = now;
				open();
			}
		});
		return () => sub.remove();
	}, [open]);

	return null;
}
