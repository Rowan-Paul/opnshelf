import { useEffect, useState } from "react";

/**
 * Per-device state for the Mobile App ask and the Home prompt slot.
 *
 * Deliberately `localStorage`, not the server, unlike the two existing Prompts.
 * Installing an app is a per-device act: dismissing "get the app" on the phone
 * you just installed it on must not also hide it on a desktop where you never
 * will. A new browser re-asking is correct — that is a new device.
 */
const DISMISSED_KEY = "opnshelf.mobile-app.dismissed";
const COOLDOWN_KEY = "opnshelf.prompt-cooldown-until";
const COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

function read(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		// Storage blocked (Safari private mode, hardened settings). Treat as
		// "never dismissed" — one extra Banner beats a crash.
		return null;
	}
}

function write(key: string, value: string): void {
	try {
		localStorage.setItem(key, value);
	} catch {
		// Nothing to do. The ask reappears next visit, which is the safe failure.
	}
}

/** One key for both surfaces: the Banner on mobile and the Prompt on desktop
 *  are the same ask, so dismissing at one width must not resurrect the other. */
export function isMobileAppDismissed(): boolean {
	return read(DISMISSED_KEY) === "1";
}

export function dismissMobileApp(): void {
	write(DISMISSED_KEY, "1");
}

/** Silence the whole Home prompt slot for a few days after any dismissal, so
 *  saying no to one card does not immediately produce the next one. */
export function startPromptCooldown(): void {
	write(COOLDOWN_KEY, String(Date.now() + COOLDOWN_MS));
}

export function isPromptCooldownActive(): boolean {
	const until = read(COOLDOWN_KEY);
	return until ? Number(until) > Date.now() : false;
}

/**
 * False during SSR and the first client render, true afterwards.
 *
 * `localStorage` does not exist on the server, so anything reading it must wait
 * for hydration or React reports a mismatch. This only ever delays showing an
 * ask, never hides one that should be visible.
 */
export function useHydrated(): boolean {
	const [hydrated, setHydrated] = useState(false);
	useEffect(() => setHydrated(true), []);
	return hydrated;
}
