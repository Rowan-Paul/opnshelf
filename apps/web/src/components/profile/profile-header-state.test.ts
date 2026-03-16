import { describe, expect, it } from "vitest";
import {
	canClickRelationshipCounts,
	getFollowLabel,
	shouldShowFollowButton,
} from "@/components/profile/profile-header-state";

describe("profile-header-state", () => {
	it("only makes relationship counts clickable for signed-in viewers", () => {
		expect(canClickRelationshipCounts(true)).toBe(true);
		expect(canClickRelationshipCounts(false)).toBe(false);
	});

	it("shows the follow button only for signed-in non-owners", () => {
		expect(shouldShowFollowButton({ isSignedIn: true, isOwner: false })).toBe(
			true,
		);
		expect(shouldShowFollowButton({ isSignedIn: true, isOwner: true })).toBe(
			false,
		);
		expect(shouldShowFollowButton({ isSignedIn: false, isOwner: false })).toBe(
			false,
		);
	});

	it("chooses the correct follow button label", () => {
		expect(getFollowLabel({ isFollowing: false, isFollowedBy: false })).toBe(
			"Follow",
		);
		expect(getFollowLabel({ isFollowing: true, isFollowedBy: false })).toBe(
			"Following",
		);
		expect(getFollowLabel({ isFollowing: false, isFollowedBy: true })).toBe(
			"Follow back",
		);
	});
});
