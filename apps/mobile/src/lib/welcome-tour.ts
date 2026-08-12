import type { Href } from "expo-router";

/**
 * Welcome Tour data and gate (ADR 0024). Kept apart from the overlay component
 * so the gate can be tested without a React Native runtime.
 *
 * Seen-state is `welcomeTourMobileVersion` on the User, separate from the web
 * one because only this tour carries the gestures. Bumping TOUR_VERSION replays
 * the whole tour; skipping counts as finishing.
 */
export const TOUR_VERSION = 1;

/** How long a step waits for its anchor before showing its card unanchored. */
export const ANCHOR_TIMEOUT_MS = 1500;

/** Interval between anchor measurements while a step is open, in ms. */
export const MEASURE_MS = 200;

/** Padding around the spotlighted element, in px. */
export const HOLE_PAD = 8;

/** Where a scrolled-to anchor lands from the top of the window, in px. */
export const SCROLL_TARGET_Y = 160;

interface TourStep {
	route: Href;
	anchor: string;
	title: string;
	body: string;
}

export const TOUR_STEPS: readonly TourStep[] = [
	{
		route: "/search",
		anchor: "discover",
		title: "Start on Discover",
		body: "Search for a film, a show or a person. Below the box are the things trending now and what the people you follow have been watching.",
	},
	{
		route: "/search",
		anchor: "media-card",
		title: "Hold a poster",
		body: "Long-press any poster for quick actions: mark it watched, rate it, or drop it in a list. And anywhere in the app, shake your phone to send us feedback.",
	},
	{
		route: "/connections",
		anchor: "connections",
		title: "Find people",
		body: "Follow the people whose taste you trust, and group them into circles when your feed gets busy.",
	},
	{
		route: "/activity",
		anchor: "activity",
		title: "See what they watch",
		body: "Every watch and review from the people you follow, newest first. It fills in once you follow someone.",
	},
	{
		route: "/",
		anchor: "up-next",
		title: "Up Next",
		body: "The next episode of every show you are part-way through. It fills in as you watch shows.",
	},
	{
		route: "/",
		anchor: "shelf",
		title: "Your Shelf",
		body: "Everything you have watched, newest first. Mark a film or an episode watched and it lands here.",
	},
] as const;

/** Screens that own the whole screen: the tour must not walk out from under one. */
function isTourBlockedPath(pathname: string): boolean {
	return (
		pathname === "/login" ||
		pathname === "/signup" ||
		pathname === "/onboarding" ||
		pathname === "/verify-email" ||
		pathname === "/trakt-import" ||
		pathname === "/atstore-review" ||
		pathname.startsWith("/auth")
	);
}

/** Whether the tour should start. Exported for the unit test. */
export function shouldRunTour(input: {
	isAuthenticated: boolean;
	needsOnboarding: boolean | undefined;
	seenVersion: number | undefined;
	pathname: string;
}): boolean {
	if (!input.isAuthenticated || input.needsOnboarding) return false;
	if (input.seenVersion === undefined) return false;
	if (isTourBlockedPath(input.pathname)) return false;
	return input.seenVersion < TOUR_VERSION;
}
