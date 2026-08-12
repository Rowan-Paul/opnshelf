import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Platform } from "#/lib/platform";
import StoreBadges from "./StoreBadges";

const platform = (os: Platform["os"]): Platform => ({
	os,
	isMobile: os !== "other",
	isIosSafari: false,
});

function badges() {
	return {
		appStore: screen.queryByAltText("Download on the App Store"),
		play: screen.queryByAltText("Get it on Google Play"),
	};
}

describe("StoreBadges", () => {
	it("shows only the App Store badge on iOS", () => {
		render(<StoreBadges platform={platform("ios")} />);
		expect(badges().appStore).not.toBeNull();
		expect(badges().play).toBeNull();
	});

	it("shows only the Play badge on Android", () => {
		render(<StoreBadges platform={platform("android")} />);
		expect(badges().appStore).toBeNull();
		expect(badges().play).not.toBeNull();
	});

	it("shows both on desktop", () => {
		render(<StoreBadges platform={platform("other")} />);
		expect(badges().appStore).not.toBeNull();
		expect(badges().play).not.toBeNull();
	});

	it("links to storefront-less URLs so each visitor lands in their own store", () => {
		render(<StoreBadges platform={platform("other")} />);
		const hrefs = screen
			.getAllByRole("link")
			.map((a) => a.getAttribute("href") ?? "");
		expect(hrefs).toContain("https://apps.apple.com/app/opnshelf/id6758867162");
		expect(hrefs).toContain(
			"https://play.google.com/store/apps/details?id=com.rowanpaul.opnshelf",
		);
		expect(hrefs.some((h) => /\/[a-z]{2}\/app\//.test(h))).toBe(false);
	});
});
