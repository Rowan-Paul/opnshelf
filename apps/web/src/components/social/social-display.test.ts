import { describe, expect, it } from "vitest";
import { getHandleDisplayName, getSocialDisplayName } from "./social-display";

describe("social-display", () => {
	it("derives a fallback display name from the first handle segment", () => {
		expect(getHandleDisplayName("rowanpaul.opnshelf.social")).toBe("rowanpaul");
	});

	it("keeps undotted handles unchanged", () => {
		expect(getHandleDisplayName("rowanpaul")).toBe("rowanpaul");
	});

	it("preserves an explicit display name", () => {
		expect(
			getSocialDisplayName("Rowan Paul", "rowanpaul.opnshelf.social"),
		).toBe("Rowan Paul");
	});
});
