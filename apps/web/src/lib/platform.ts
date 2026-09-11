import { useSyncExternalStore } from "react";

export type Platform = {
	/** Which Store Listing to offer. "other" means show both badges. */
	os: "ios" | "android" | "other";
	/** Phone or tablet. Decides whether the Banner may show at all. */
	isMobile: boolean;
	/**
	 * iOS Safari specifically, not iOS. Only Safari renders Apple's Smart App
	 * Banner, so iOS Chrome/Firefox and in-app webviews need our own Banner.
	 */
	isIosSafari: boolean;
};

export const DESKTOP: Platform = {
	os: "other",
	isMobile: false,
	isIosSafari: false,
};

/**
 * Best-effort platform from a User-Agent string.
 *
 * Order matters, same trap as `device.ts`: every iPhone UA contains
 * "like Mac OS X" and every Android UA contains "Linux", so the mobile checks
 * come first.
 *
 * Known ceiling: a UA is a claim. "Request desktop site" on Android Firefox
 * sends an X11/Linux UA and this reports desktop, which shows both badges
 * instead of just Play. That is the benign failure, and the alternative is
 * fingerprinting, which we don't do.
 */
export function platformFromUserAgent(ua: string): Platform {
	const isIos = /iPhone|iPad|iPod/i.test(ua);
	const isAndroid = /Android/i.test(ua);
	const isMobile = isIos || isAndroid || /Mobile|Tablet/i.test(ua);

	// Every third-party iOS browser is WebKit but tags itself: CriOS (Chrome),
	// FxiOS (Firefox), EdgiOS (Edge), OPiOS/OPT (Opera), GSA (Google app).
	// In-app webviews (Instagram, FBAN) omit "Safari" entirely.
	const isIosSafari =
		isIos &&
		/Safari/i.test(ua) &&
		!/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|FBAN|FBAV|Instagram|Line\//i.test(
			ua,
		);

	return {
		os: isIos ? "ios" : isAndroid ? "android" : "other",
		isMobile,
		isIosSafari,
	};
}

/**
 * Best-effort platform from the live `navigator`, or desktop where there is no
 * navigator (SSR). Not for use during render: see `usePlatform`.
 */
function detectPlatform(): Platform {
	if (typeof navigator === "undefined") return DESKTOP;
	return platformFromUserAgent(navigator.userAgent);
}

// The User-Agent never changes for the life of the page, so one read serves
// every subscriber. `useSyncExternalStore` also requires a stable snapshot.
let detected: Platform | undefined;
function getSnapshot(): Platform {
	detected ??= detectPlatform();
	return detected;
}
function getServerSnapshot(): Platform {
	return DESKTOP;
}
function subscribe(): () => void {
	return () => {};
}

/**
 * The visiting device's platform, safe to branch on during render.
 *
 * The server does not know the device and renders desktop, which shows both
 * store badges — the safe default, since it offers more than the visitor needs
 * rather than the wrong one. React hydrates against that same desktop snapshot
 * and only then re-renders with the real platform, so a phone narrows to its
 * own badge a frame later. Reading `navigator` straight from render instead
 * made the first client tree differ from the server HTML on every phone that
 * opened the landing page, which React reports as error #418 and repairs by
 * throwing the server HTML away and re-rendering the page.
 */
export function usePlatform(): Platform {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
