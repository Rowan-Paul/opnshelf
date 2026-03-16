import { describe, expect, it } from "vitest";
import {
	getProfileListDetailRoute,
	getProfilePeopleRoute,
	getProfileRoute,
	getVisibleProfileSections,
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
		expect(getProfileRoute("Rowan", "people")).toEqual({
			to: "/profile/$handle/people",
			params: { handle: "rowan" },
			search: {
				tab: "following",
				q: "",
				discoverPage: 1,
				followingPage: 1,
				followersPage: 1,
			},
		});
		expect(getProfileRoute("Rowan", "followers", { page: 4 })).toEqual({
			to: "/profile/$handle/followers",
			params: { handle: "rowan" },
			search: { page: 4 },
		});
		expect(getProfileRoute("Rowan", "following", { page: 5 })).toEqual({
			to: "/profile/$handle/following",
			params: { handle: "rowan" },
			search: { page: 5 },
		});
		expect(getProfileListDetailRoute("@Rowan", "favorites")).toEqual({
			to: "/profile/$handle/list/$slug",
			params: { handle: "rowan", slug: "favorites" },
		});
		expect(getProfilePeopleRoute("@Rowan", { tab: "followers" })).toEqual({
			to: "/profile/$handle/people",
			params: { handle: "rowan" },
			search: {
				tab: "followers",
				q: "",
				discoverPage: 1,
				followingPage: 1,
				followersPage: 1,
			},
		});
	});

	it("matches ownership by did only", () => {
		expect(isOwnerProfile("did:plc:abc", "did:plc:abc")).toBe(true);
		expect(isOwnerProfile("did:plc:abc", "did:plc:def")).toBe(false);
		expect(isOwnerProfile(undefined, "did:plc:def")).toBe(false);
	});

	it("only shows up next in the owner profile nav", () => {
		expect(
			getVisibleProfileSections({
				isOwner: true,
				isSignedIn: true,
			}),
		).toEqual(["shelf", "up-next", "lists", "people", "calendar", "settings"]);

		expect(
			getVisibleProfileSections({
				isOwner: false,
				isSignedIn: true,
			}),
		).toEqual(["shelf", "lists", "followers", "following"]);

		expect(
			getVisibleProfileSections({
				isOwner: false,
				isSignedIn: false,
			}),
		).toEqual(["shelf", "lists"]);
	});
});
