import { buildOAuthScopes, includesRequestedScopes } from "./oauth-scopes";

describe("progressive OAuth scopes", () => {
	it("keeps external ecosystems out of Core login", () => {
		const scopes = buildOAuthScopes();
		expect(scopes).toContain("blob:image/jpeg");
		expect(scopes).toContain("blob:image/png");
		expect(scopes).toContain("blob:image/webp");
		expect(scopes).not.toContain("repo:site.standard.document");
		expect(scopes).not.toContain("repo:app.bsky.feed.post");
		expect(scopes).not.toContain("include:fyi.atstore.authThirdPartyReviews");
	});

	it("adds only the selected cumulative integrations", () => {
		const blog = buildOAuthScopes({
			blogEnabled: true,
			reviewsMirrorFormat: "offprint",
		});
		expect(blog).toContain("repo:site.standard.document");
		expect(blog).toContain("repo:app.offprint.document.article");
		expect(blog).not.toContain("repo:app.bsky.feed.post");

		const both = buildOAuthScopes({
			blogEnabled: true,
			blueskyEnabled: true,
		});
		expect(both).toContain("repo:site.standard.document");
		expect(both).toContain(
			"repo:app.bsky.feed.post?action=create&action=update",
		);

		const atStoreReview = buildOAuthScopes({ atStoreReviewEnabled: true });
		expect(atStoreReview).toContain(
			"include:fyi.atstore.authThirdPartyReviews",
		);
		expect(atStoreReview).not.toContain("repo:site.standard.document");
	});

	it("rejects partial grants", () => {
		const required = buildOAuthScopes({ blueskyEnabled: true });
		expect(includesRequestedScopes(required.join(" "), required)).toBe(true);
		expect(
			includesRequestedScopes("atproto repo:app.bsky.feed.post", required),
		).toBe(false);
	});
});
