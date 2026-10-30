import { describe, expect, it } from "vitest";
import { isOwnProfileSegment } from "./own-profile-segment";

const user = { handle: "local.test", did: "did:plc:abc" };

describe("isOwnProfileSegment", () => {
	it.each([
		"local.test",
		"Local.Test",
		"did:plc:abc",
		"did%3Aplc%3Aabc",
	])("matches the signed-in user for %s", (segment) => {
		expect(isOwnProfileSegment(segment, user)).toBe(true);
	});

	it("rejects someone else's handle or DID", () => {
		expect(isOwnProfileSegment("other.test", user)).toBe(false);
		expect(isOwnProfileSegment("did:plc:xyz", user)).toBe(false);
	});

	it("rejects every segment when signed out", () => {
		expect(isOwnProfileSegment("local.test", null)).toBe(false);
	});
});
