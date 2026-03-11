import { describe, expect, it } from "vitest";
import {
	getProfileListDetailRoute,
	getProfileRoute,
	isOwnerProfile,
	normalizeProfileHandle,
} from "@/lib/profile-routes";

describe("profile-routes", () => {
	it("normalizes handles", () => {
		expect(normalizeProfileHandle(" @RowanPaulFlynn ")).toBe("rowanpaulflynn");
	});

	it("builds canonical profile routes", () => {
		expect(getProfileRoute("@Rowan", "shelf", { page: 2 })).toEqual({
			to: "/profile/$handle/shelf",
			params: { handle: "rowan" },
			search: { page: 2 },
		});
		expect(getProfileRoute("Rowan", "up-next", { page: 3 })).toEqual({
			to: "/profile/$handle/up-next",
			params: { handle: "rowan" },
			search: { page: 3 },
		});
		expect(getProfileRoute("Rowan", "lists")).toEqual({
			to: "/profile/$handle/lists",
			params: { handle: "rowan" },
		});
		expect(getProfileListDetailRoute("@Rowan", "favorites")).toEqual({
			to: "/profile/$handle/list/$slug",
			params: { handle: "rowan", slug: "favorites" },
		});
	});

	it("matches ownership by did only", () => {
		expect(isOwnerProfile("did:plc:abc", "did:plc:abc")).toBe(true);
		expect(isOwnerProfile("did:plc:abc", "did:plc:def")).toBe(false);
		expect(isOwnerProfile(undefined, "did:plc:def")).toBe(false);
	});
});
