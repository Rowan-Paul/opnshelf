import { describe, expect, it } from "vitest";
import { isUpdateBannerSuppressed } from "./update-banner-routes";

describe("isUpdateBannerSuppressed", () => {
	it.each([
		"/login",
		"/signup",
		"/verify-email",
		"/onboarding",
		"/onboarding/",
		"/auth",
		"/auth/complete",
	])("hides the banner on %s", (pathname) => {
		expect(isUpdateBannerSuppressed(pathname)).toBe(true);
	});

	it.each([
		"/",
		"/search",
		"/profile",
		"/settings",
		"/settings/account",
		"/movies/123/some-title",
		"/lists/watchlist",
		"/login-help",
		"/signup-bonus",
		"/authors",
	])("shows the banner on %s", (pathname) => {
		expect(isUpdateBannerSuppressed(pathname)).toBe(false);
	});
});
