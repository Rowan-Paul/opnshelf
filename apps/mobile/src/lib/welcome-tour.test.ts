import { describe, expect, it } from "vitest";
import { shouldRunTour, TOUR_STEPS, TOUR_VERSION } from "./welcome-tour";

const base = {
	isAuthenticated: true,
	needsOnboarding: false,
	seenVersion: 0,
	pathname: "/",
};

describe("shouldRunTour", () => {
	it("runs for a user who has never taken it", () => {
		expect(shouldRunTour(base)).toBe(true);
	});

	it("does not run once the current version is stamped", () => {
		expect(shouldRunTour({ ...base, seenVersion: TOUR_VERSION })).toBe(false);
	});

	it("runs again when the version is bumped past what they took", () => {
		expect(shouldRunTour({ ...base, seenVersion: TOUR_VERSION - 1 })).toBe(
			true,
		);
	});

	it("waits for settings to load rather than assuming never-taken", () => {
		expect(shouldRunTour({ ...base, seenVersion: undefined })).toBe(false);
	});

	it("stays out of the way of guests, onboarding and the login flow", () => {
		expect(shouldRunTour({ ...base, isAuthenticated: false })).toBe(false);
		expect(shouldRunTour({ ...base, needsOnboarding: true })).toBe(false);
		expect(shouldRunTour({ ...base, pathname: "/onboarding" })).toBe(false);
		expect(shouldRunTour({ ...base, pathname: "/verify-email" })).toBe(false);
		expect(shouldRunTour({ ...base, pathname: "/auth/complete" })).toBe(false);
	});
});

describe("TOUR_STEPS", () => {
	it("is six steps, each with an anchor", () => {
		expect(TOUR_STEPS).toHaveLength(6);
		for (const step of TOUR_STEPS) expect(step.anchor).not.toBe("");
	});
});
