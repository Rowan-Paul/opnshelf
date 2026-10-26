import { useSyncExternalStore } from "react";

const KEY = "opnshelf_completion_confetti";
const EVENT = "opnshelf-confetti-preference";
export function isConfettiEnabled() {
	try {
		return window.localStorage.getItem(KEY) !== "false";
	} catch {
		return true;
	}
}
export function setConfettiEnabled(enabled: boolean) {
	window.localStorage.setItem(KEY, String(enabled));
	window.dispatchEvent(new Event(EVENT));
}
function subscribe(listener: () => void) {
	window.addEventListener("storage", listener);
	window.addEventListener(EVENT, listener);
	return () => {
		window.removeEventListener("storage", listener);
		window.removeEventListener(EVENT, listener);
	};
}
export function useConfettiPreference() {
	return useSyncExternalStore(subscribe, isConfettiEnabled, () => true);
}
