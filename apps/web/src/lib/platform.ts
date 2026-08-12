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
 * The visiting device's platform. Client-side only.
 *
 * This used to read the request header during SSR so the right badge landed in
 * the server HTML. That branch was dead: every caller is either behind a
 * `localStorage` check (the Banner and the Prompt) or on a page that renders
 * client-side anyway, so it never ran. Deleted rather than kept warm.
 *
 * On the server it reports desktop, which shows both badges — the safe default,
 * since it offers more than the visitor needs rather than the wrong one.
 */
export function detectPlatform(): Platform {
	if (typeof navigator === "undefined") return DESKTOP;
	return platformFromUserAgent(navigator.userAgent);
}
