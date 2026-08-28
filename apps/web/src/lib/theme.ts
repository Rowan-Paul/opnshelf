import { useSyncExternalStore } from "react";

/**
 * User-facing appearance preference, mirroring Mobile's `ThemePreference`.
 * The stored value stays `auto` rather than Mobile's `system` because the
 * inline theme script in `__root.tsx` and existing visitors' localStorage
 * already speak `auto`; only the label says "System".
 */
export type ThemeMode = "light" | "dark" | "auto";

/** Color scheme actually applied to the document. */
export type ThemeScheme = "light" | "dark";

const STORAGE_KEY = "theme";
const DEFAULT_MODE: ThemeMode = "auto";

function isThemeMode(value: string | null): value is ThemeMode {
	return value === "light" || value === "dark" || value === "auto";
}

function readStoredMode(): ThemeMode {
	if (typeof window === "undefined") return DEFAULT_MODE;
	try {
		const stored = window.localStorage.getItem(STORAGE_KEY);
		return isThemeMode(stored) ? stored : DEFAULT_MODE;
	} catch {
		return DEFAULT_MODE;
	}
}

/**
 * The OS dark-mode query, or null where `matchMedia` is unavailable (SSR and
 * the test environment). Callers then fall back to light.
 */
function darkModeQuery(): MediaQueryList | null {
	if (typeof window === "undefined") return null;
	if (typeof window.matchMedia !== "function") return null;
	return window.matchMedia("(prefers-color-scheme: dark)");
}

/** Resolve `auto` against the OS preference. */
export function resolveScheme(mode: ThemeMode): ThemeScheme {
	if (mode !== "auto") return mode;
	return darkModeQuery()?.matches ? "dark" : "light";
}

function applyMode(mode: ThemeMode) {
	if (typeof document === "undefined") return;
	const resolved = resolveScheme(mode);
	const root = document.documentElement;

	root.classList.remove("light", "dark");
	root.classList.add(resolved);

	if (mode === "auto") {
		root.removeAttribute("data-theme");
	} else {
		root.setAttribute("data-theme", mode);
	}

	root.style.colorScheme = resolved;
}

// Module-level store so every theme control on the page — the header toggle and
// Settings > Preferences > Appearance — reads and writes one source of truth.
let mode: ThemeMode = DEFAULT_MODE;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
	for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
	listeners.add(listener);

	// The first subscriber adopts the persisted preference and starts following
	// the OS while the mode is `auto`.
	const media = darkModeQuery();
	const onOsChange = () => {
		if (mode === "auto") {
			applyMode("auto");
			emit();
		}
	};
	media?.addEventListener("change", onOsChange);

	if (!hydrated) {
		hydrated = true;
		mode = readStoredMode();
		applyMode(mode);
		emit();
	}

	return () => {
		listeners.delete(listener);
		media?.removeEventListener("change", onOsChange);
	};
}

// The snapshot carries the hydration flag so a first read that returns the
// default mode still re-renders subscribers once localStorage has been read.
type Snapshot = `${"0" | "1"}:${ThemeMode}`;

function getSnapshot(): Snapshot {
	return `${hydrated ? "1" : "0"}:${mode}`;
}

function getServerSnapshot(): Snapshot {
	return `0:${DEFAULT_MODE}`;
}

/** Persist and apply a new appearance preference. */
export function setThemeMode(next: ThemeMode) {
	mode = next;
	hydrated = true;
	applyMode(next);
	try {
		window.localStorage.setItem(STORAGE_KEY, next);
	} catch {
		// A blocked localStorage still gets the applied theme for this session.
	}
	emit();
}

/**
 * The current appearance preference. `hydrated` is false until the client has
 * read localStorage, so controls can render a neutral state instead of
 * flashing the wrong selection during hydration.
 */
export function useThemeMode(): {
	mode: ThemeMode;
	scheme: ThemeScheme;
	hydrated: boolean;
	setMode: (next: ThemeMode) => void;
} {
	const snapshot = useSyncExternalStore(
		subscribe,
		getSnapshot,
		getServerSnapshot,
	);
	const [flag, current] = snapshot.split(":") as ["0" | "1", ThemeMode];
	return {
		mode: current,
		scheme: resolveScheme(current),
		hydrated: flag === "1",
		setMode: setThemeMode,
	};
}
