import { describe, expect, it } from "vitest";
import { platformFromUserAgent } from "./platform";

const UA = {
	iphoneSafari:
		"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
	iphoneChrome:
		"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1",
	iphoneFirefox:
		"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15",
	iphoneInstagram:
		"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 331.0.0.37.90",
	ipadSafari:
		"Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
	androidChrome:
		"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
	macSafari:
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
	windowsChrome:
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
	androidDesktopMode:
		"Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
};

describe("platformFromUserAgent", () => {
	it("picks the App Store for iOS and Play for Android", () => {
		expect(platformFromUserAgent(UA.iphoneSafari).os).toBe("ios");
		expect(platformFromUserAgent(UA.ipadSafari).os).toBe("ios");
		expect(platformFromUserAgent(UA.androidChrome).os).toBe("android");
	});

	it("shows both badges on desktop", () => {
		expect(platformFromUserAgent(UA.macSafari).os).toBe("other");
		expect(platformFromUserAgent(UA.windowsChrome).os).toBe("other");
	});

	// The trap this file exists for: macOS is not iOS and Android is not Linux.
	it("does not read a Mac as iOS or an Android as desktop", () => {
		expect(platformFromUserAgent(UA.macSafari).isMobile).toBe(false);
		expect(platformFromUserAgent(UA.androidChrome).os).not.toBe("other");
	});

	// Only Safari renders Apple's Smart App Banner. Everything else needs ours.
	it("treats only real iOS Safari as Smart App Banner capable", () => {
		expect(platformFromUserAgent(UA.iphoneSafari).isIosSafari).toBe(true);
		expect(platformFromUserAgent(UA.ipadSafari).isIosSafari).toBe(true);
		expect(platformFromUserAgent(UA.iphoneChrome).isIosSafari).toBe(false);
		expect(platformFromUserAgent(UA.iphoneFirefox).isIosSafari).toBe(false);
		expect(platformFromUserAgent(UA.iphoneInstagram).isIosSafari).toBe(false);
		expect(platformFromUserAgent(UA.androidChrome).isIosSafari).toBe(false);
		expect(platformFromUserAgent(UA.macSafari).isIosSafari).toBe(false);
	});

	// Documented ceiling, asserted so nobody "fixes" it by accident.
	it("reports Android desktop-site mode as desktop", () => {
		expect(platformFromUserAgent(UA.androidDesktopMode).os).toBe("other");
	});

	it("falls back to desktop for an empty or unknown UA", () => {
		expect(platformFromUserAgent("").os).toBe("other");
		expect(platformFromUserAgent("curl/8.4.0").isMobile).toBe(false);
	});
});
