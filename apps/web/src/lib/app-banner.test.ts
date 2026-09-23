import { afterEach, describe, expect, it, vi } from "vitest";
import { APP_BANNER_SCRIPT } from "./app-banner";
import { DISMISSED_KEY } from "./prompt-state";

const UA = {
	iphoneSafari:
		"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
	iphoneChrome:
		"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1",
	androidChrome:
		"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
	macSafari:
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
};

function runWith(userAgent: string) {
	vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
	new Function(APP_BANNER_SCRIPT)();
	const html = document.documentElement;
	return {
		hidden: html.getAttribute("data-app-banner") === "hidden",
		os: html.getAttribute("data-app-os"),
	};
}

afterEach(() => {
	vi.restoreAllMocks();
	localStorage.clear();
	document.documentElement.removeAttribute("data-app-banner");
	document.documentElement.removeAttribute("data-app-os");
});

describe("APP_BANNER_SCRIPT", () => {
	it("shows the banner with the matching store link on Android and iOS browsers other than Safari", () => {
		expect(runWith(UA.androidChrome)).toEqual({ hidden: false, os: "android" });
		document.documentElement.removeAttribute("data-app-os");
		expect(runWith(UA.iphoneChrome)).toEqual({ hidden: false, os: "ios" });
	});

	it("hides it on desktop and in iOS Safari, which has Apple's own banner", () => {
		expect(runWith(UA.macSafari).hidden).toBe(true);
		document.documentElement.removeAttribute("data-app-banner");
		expect(runWith(UA.iphoneSafari).hidden).toBe(true);
	});

	it("hides it once dismissed on this device", () => {
		localStorage.setItem(DISMISSED_KEY, "1");
		expect(runWith(UA.androidChrome).hidden).toBe(true);
	});
});
