import { onboardingDiscoveryOptions } from "@opnshelf/api";
import { describe, expect, it } from "vitest";
import {
	isSwipeAccepted,
	onboardingCardLayout,
	toOnboardingMediaItem,
} from "./onboarding-media";

describe("onboarding media", () => {
	it("uses the shared mixed discovery deck", () => {
		expect(onboardingDiscoveryOptions().queryKey[0]).toMatchObject({
			_id: "discoverControllerOnboarding",
		});
	});

	it("normalizes movies and shows", () => {
		expect(
			toOnboardingMediaItem({
				id: 1,
				media_type: "movie",
				title: "Arrival",
				release_date: "2016-11-11",
				popularity: 1,
				vote_average: 8,
				vote_count: 1,
			}),
		).toMatchObject({ id: 1, type: "movie", title: "Arrival", year: "2016" });
		expect(
			toOnboardingMediaItem({
				id: 2,
				media_type: "tv",
				name: "Severance",
				first_air_date: "2022-02-18",
				popularity: 1,
				vote_average: 8,
				vote_count: 1,
			}),
		).toMatchObject({ id: 2, type: "show", title: "Severance", year: "2022" });
	});

	it("accepts a swipe at one quarter of the card width", () => {
		expect(isSwipeAccepted(79, 320)).toBe(false);
		expect(isSwipeAccepted(80, 320)).toBe(true);
		expect(isSwipeAccepted(-100, 320)).toBe(true);
	});

	it("shrinks the card to fit the measured stack height", () => {
		expect(onboardingCardLayout(390, 600, false, 1)).toEqual({
			width: 280,
			showPoster: true,
		});
		expect(onboardingCardLayout(394, 420, true, 1)).toEqual({
			width: 208,
			showPoster: true,
		});
		expect(onboardingCardLayout(320, 900, false, 1)).toEqual({
			width: 256,
			showPoster: true,
		});
	});

	it("reserves more title room as the font scale grows", () => {
		expect(onboardingCardLayout(394, 420, true, 1.5).width).toBe(184);
	});

	it("drops the poster when it would be too narrow to read", () => {
		expect(onboardingCardLayout(394, 250, true, 2)).toEqual({
			width: 280,
			showPoster: false,
		});
	});
});
