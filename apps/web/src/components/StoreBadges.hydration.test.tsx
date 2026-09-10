// Own file so the platform module starts cold: `usePlatform` reads the
// User-Agent once per module instance, and the UA below must be in place first.
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import StoreBadges from "./StoreBadges";

const ANDROID_UA =
	"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

beforeAll(() => {
	Object.defineProperty(navigator, "userAgent", {
		value: ANDROID_UA,
		configurable: true,
	});
	(
		globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
	).IS_REACT_ACT_ENVIRONMENT = true;
});

describe("StoreBadges hydration", () => {
	// The server cannot know the device, so its HTML carries both badges. The
	// phone must hydrate against that same HTML instead of tearing it down
	// (React error #418) and only then narrow to its own store.
	it("hydrates the desktop server HTML on a phone without a mismatch", async () => {
		const html = renderToString(<StoreBadges />);
		expect(html).toContain("Download on the App Store");
		expect(html).toContain("Get it on Google Play");

		const container = document.createElement("div");
		container.innerHTML = html;
		const recoverable: unknown[] = [];
		await act(async () => {
			hydrateRoot(container, <StoreBadges />, {
				onRecoverableError: (error) => recoverable.push(error),
			});
		});

		expect(recoverable).toEqual([]);
		expect(
			container.querySelector('img[alt="Download on the App Store"]'),
		).toBeNull();
		expect(
			container.querySelector('img[alt="Get it on Google Play"]'),
		).not.toBeNull();
	});
});
