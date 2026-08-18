import { onboardingDiscoveryOptions } from "@opnshelf/api";
import { describe, expect, it } from "vitest";
import {
	isSwipeAccepted,
	onboardingCardWidth,
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

	it("shrinks the card to fit short screens", () => {
		expect(onboardingCardWidth(375, 667)).toBe(218);
		expect(onboardingCardWidth(390, 844)).toBe(280);
		expect(onboardingCardWidth(320, 568)).toBe(184);
	});
});
