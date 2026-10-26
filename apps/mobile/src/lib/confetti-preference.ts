import * as SecureStore from "expo-secure-store";
import { useSyncExternalStore } from "react";

const KEY = "completion_confetti";
let enabled: boolean | null = null;
let loading: Promise<void> | undefined;
const listeners = new Set<() => void>();
function emit() {
	for (const listener of listeners) listener();
}
async function load() {
	loading ??= SecureStore.getItemAsync(KEY)
		.then(
			(value) => {
				enabled = value !== "false";
			},
			() => {
				enabled = true;
			},
		)
		.then(emit);
	await loading;
}
function subscribe(listener: () => void) {
	listeners.add(listener);
	void load();
	return () => {
		listeners.delete(listener);
	};
}
export function useConfettiPreference() {
	return useSyncExternalStore(
		subscribe,
		() => enabled,
		() => null,
	);
}
export async function isConfettiEnabled() {
	await load();
	return enabled === true;
}
export async function setConfettiEnabled(next: boolean) {
	await load();
	await SecureStore.setItemAsync(KEY, String(next));
	enabled = next;
	emit();
}
