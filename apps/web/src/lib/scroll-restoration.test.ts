import type { ParsedLocation } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { getScrollRestorationKey } from "./scroll-restoration";

function location(pathname: string, search = "", key?: string): ParsedLocation {
	return {
		pathname,
		href: `${pathname}${search}`,
		state: key ? { __TSR_key: key } : {},
	} as unknown as ParsedLocation;
}

describe("getScrollRestorationKey", () => {
	it("keys Social by URL so a return visit restores the feed position", () => {
		expect(getScrollRestorationKey(location("/social", "", "k1"))).toBe(
			"/social",
		);
		expect(getScrollRestorationKey(location("/social", "", "k2"))).toBe(
			"/social",
		);
	});

	it("gives each selected Circle its own key", () => {
		expect(getScrollRestorationKey(location("/social", "?circleId=a"))).toBe(
			"/social?circleId=a",
		);
	});

	it("treats /social/ and /social as the same page", () => {
		expect(getScrollRestorationKey(location("/social/"))).toBe("/social");
		expect(getScrollRestorationKey(location("/social/", "?circleId=a"))).toBe(
			"/social?circleId=a",
		);
	});

	it("keeps the per-history-entry key everywhere else", () => {
		expect(getScrollRestorationKey(location("/social/find", "", "k3"))).toBe(
			"k3",
		);
		expect(getScrollRestorationKey(location("/", ""))).toBe("/");
	});
});
