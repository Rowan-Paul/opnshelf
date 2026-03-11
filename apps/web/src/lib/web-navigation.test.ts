import { describe, expect, it } from "vitest";
import {
	getMyShelfRoute,
	getSignedInPrimaryNav,
	getSignedOutPrimaryNav,
	isGlobalNavItemActive,
	shouldHideMobileBottomNav,
} from "@/lib/web-navigation";

describe("web-navigation", () => {
	it("returns the signed-out primary nav model", () => {
		expect(getSignedOutPrimaryNav()).toEqual([
			{ id: "home", label: "Home" },
			{ id: "search", label: "Search" },
		]);
	});

	it("returns the signed-in primary nav model", () => {
		expect(getSignedInPrimaryNav()).toEqual([
			{ id: "home", label: "Home" },
			{ id: "search", label: "Search" },
			{ id: "my-shelf", label: "My Shelf" },
		]);
	});

	it("builds the canonical my shelf route", () => {
		expect(getMyShelfRoute("@Rowan")).toEqual({
			to: "/profile/$handle/shelf",
			params: { handle: "rowan" },
			search: { page: 1 },
		});
	});

	it("marks home active only on the exact home route", () => {
		expect(isGlobalNavItemActive("home", "/")).toBe(true);
		expect(isGlobalNavItemActive("home", "/search")).toBe(false);
	});

	it("marks search active on the search route", () => {
		expect(isGlobalNavItemActive("search", "/search")).toBe(true);
		expect(isGlobalNavItemActive("search", "/")).toBe(false);
	});

	it("marks my shelf active across the current user's profile sections", () => {
		const paths = [
			"/profile/rowan/shelf",
			"/profile/rowan/up-next",
			"/profile/rowan/lists",
			"/profile/rowan/calendar",
			"/profile/rowan/settings",
			"/profile/rowan/list/favorites",
		];

		for (const path of paths) {
			expect(isGlobalNavItemActive("my-shelf", path, "@Rowan")).toBe(true);
		}
	});

	it("keeps my shelf inactive for another user's profile", () => {
		expect(
			isGlobalNavItemActive("my-shelf", "/profile/other/shelf", "rowan"),
		).toBe(false);
	});

	it("hides mobile bottom nav on auth and onboarding routes", () => {
		expect(shouldHideMobileBottomNav("/login")).toBe(true);
		expect(shouldHideMobileBottomNav("/onboarding")).toBe(true);
		expect(shouldHideMobileBottomNav("/auth/complete")).toBe(true);
		expect(shouldHideMobileBottomNav("/")).toBe(false);
		expect(shouldHideMobileBottomNav("/search")).toBe(false);
	});
});
