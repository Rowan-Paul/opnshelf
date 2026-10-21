import { describe, expect, it } from "vitest";
import {
	shouldRunTour,
	TOUR_STEPS,
	TOUR_VERSION,
	tourCardTop,
	tourScrollOffset,
} from "./welcome-tour";

describe("tourCardTop", () => {
	it("keeps the poster step visible on the Duo outer screen", () => {
		expect(
			tourCardTop({
				hole: { top: 150, height: 250 },
				cardHeight: 240,
				top: 60,
				bottom: 666,
			}),
		).toBe(412);
	});
	it("clamps to the safe area when neither side fits", () => {
		expect(
			tourCardTop({
				hole: { top: 150, height: 250 },
				cardHeight: 350,
				top: 60,
				bottom: 666,
			}),
		).toBe(316);
	});
	it("uses the space above a low anchor", () => {
		expect(
			tourCardTop({
				hole: { top: 500, height: 80 },
				cardHeight: 240,
				top: 60,
				bottom: 666,
			}),
		).toBe(248);
	});
	it("keeps an oversized unanchored card at the safe top", () => {
		expect(
			tourCardTop({ hole: null, cardHeight: 800, top: 60, bottom: 666 }),
		).toBe(60);
	});
});

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
	it("is five steps, each with an anchor", () => {
		expect(TOUR_STEPS).toHaveLength(5);
		for (const step of TOUR_STEPS) expect(step.anchor).not.toBe("");
	});

	it("replaces Connections and Activity with Social without bumping the version", () => {
		expect(TOUR_VERSION).toBe(1);
		expect(TOUR_STEPS.filter((step) => step.anchor === "social")).toHaveLength(
			1,
		);
		expect(TOUR_STEPS.some((step) => step.anchor === "connections")).toBe(
			false,
		);
		expect(TOUR_STEPS.some((step) => step.anchor === "activity")).toBe(false);
	});
});

describe("Home tour scrolling", () => {
	it("does not move an already visible section", () => {
		expect(
			tourScrollOffset({
				y: 100,
				height: 200,
				viewportHeight: 678,
				offsetY: 0,
				safeTop: 72,
			}),
		).toBeNull();
	});
	it("places an offscreen heading below the safe area", () => {
		expect(
			tourScrollOffset({
				y: 600,
				height: 200,
				viewportHeight: 678,
				offsetY: 0,
				safeTop: 72,
			}),
		).toBe(528);
	});
	it("moves a heading out of the top inset", () => {
		expect(
			tourScrollOffset({
				y: 24,
				height: 200,
				viewportHeight: 678,
				offsetY: 500,
				safeTop: 72,
			}),
		).toBe(452);
	});
});
