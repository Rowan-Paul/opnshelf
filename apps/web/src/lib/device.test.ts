import { describe, expect, it } from "vitest";
import { labelFromUserAgent } from "./device";

describe("labelFromUserAgent", () => {
	it("names mobile platforms before the desktop ones they mention", () => {
		// Every iOS UA says "like Mac OS X"; Android's says "Linux".
		expect(
			labelFromUserAgent(
				"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
			),
		).toBe("Safari on iOS");
		expect(
			labelFromUserAgent(
				"Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/121.0 Mobile/15E148 Safari/604.1",
			),
		).toBe("Chrome on iOS");
		expect(
			labelFromUserAgent(
				"Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0",
			),
		).toBe("Firefox on Android");
	});

	it("names the desktop combinations", () => {
		expect(
			labelFromUserAgent(
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
			),
		).toBe("Chrome on macOS");
		expect(
			labelFromUserAgent(
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
			),
		).toBe("Edge on Windows");
		expect(
			labelFromUserAgent(
				"Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0",
			),
		).toBe("Firefox on Linux");
	});

	it("reports what a spoofed desktop-mode UA claims, not the real device", () => {
		// Android Firefox with "Request desktop site" is indistinguishable from
		// desktop Firefox. Documented ceiling, not a bug to chase.
		expect(
			labelFromUserAgent(
				"Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0",
			),
		).toBe("Firefox on Linux");
	});

	it("returns undefined when nothing is recognisable", () => {
		expect(labelFromUserAgent("curl/8.4.0")).toBeUndefined();
	});
});
