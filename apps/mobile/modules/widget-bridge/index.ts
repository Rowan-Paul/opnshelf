import { requireNativeModule } from "expo";
import { Platform } from "react-native";

/**
 * JS side of the Android Home-Screen Widget bridge (see CONTEXT.md and
 * ADR 0017). Every export is a safe no-op off Android, in Expo Go, and in
 * tests — the native module is looked up lazily and failures are swallowed,
 * since the widget must never take the app down with it.
 */

type WidgetTheme = "system" | "light" | "dark";

interface WidgetBridgeNativeModule {
	setWidgetHandle(handle: string | null): void;
	setWidgetTheme(theme: WidgetTheme): void;
	setWidgetApiUrl(apiUrl: string): void;
	requestWidgetUpdate(): void;
}

let cached: WidgetBridgeNativeModule | null | undefined;

function getModule(): WidgetBridgeNativeModule | null {
	if (cached !== undefined) return cached;
	if (Platform.OS !== "android") {
		cached = null;
		return null;
	}
	try {
		cached = requireNativeModule<WidgetBridgeNativeModule>("WidgetBridge");
	} catch {
		cached = null;
	}
	return cached;
}

/**
 * Point the widget at the signed-in user's profile, or clear it with `null`
 * (sign-out, expired session, account switch). Triggers a widget refresh.
 */
export function setWidgetHandle(handle: string | null): void {
	getModule()?.setWidgetHandle(handle);
}

/** Mirror the in-app appearance preference onto the widget. */
export function setWidgetTheme(theme: WidgetTheme): void {
	getModule()?.setWidgetTheme(theme);
}

/** Hand the build-time API origin to the widget. Call once at app startup. */
export function setWidgetApiUrl(apiUrl: string): void {
	getModule()?.setWidgetApiUrl(apiUrl);
}

/**
 * Ask the widget to refetch and redraw now instead of waiting for the
 * 30-minute periodic tick. Called after watch log/remove mutations.
 */
export function requestWidgetUpdate(): void {
	getModule()?.requestWidgetUpdate();
}
