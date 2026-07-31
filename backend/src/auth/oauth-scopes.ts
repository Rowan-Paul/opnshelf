/**
 * The scopes Opnshelf needs to operate its own repository.  Keep this list
 * deliberately boring and explicit: optional ecosystems must never leak into
 * the sign-in consent screen.
 */
export const CORE_OAUTH_SCOPES = [
	"atproto",
	"include:xyz.opnshelf.core",
	"blob:image/jpeg",
	"blob:image/png",
	"blob:image/webp",
] as const;

export type BlogMirrorFormat = "markdown" | "leaflet" | "offprint" | "pckt";
export type OAuthIntegration = "atstore" | "blog" | "bluesky";

export const BLOG_OAUTH_SCOPES = ["repo:site.standard.document"] as const;
export const OFFPRINT_OAUTH_SCOPE = "repo:app.offprint.document.article";
export const BLUESKY_OAUTH_SCOPES = [
	"repo:app.bsky.feed.post?action=create&action=update",
] as const;
export const ATSTORE_REVIEW_OAUTH_SCOPES = [
	"include:fyi.atstore.authThirdPartyReviews",
] as const;

export interface OAuthScopePreferences {
	blogEnabled?: boolean;
	blueskyEnabled?: boolean;
	atStoreReviewEnabled?: boolean;
	reviewsMirrorFormat?: BlogMirrorFormat | null;
}

export function buildOAuthScopes(
	preferences: OAuthScopePreferences = {},
): string[] {
	const scopes: string[] = [...CORE_OAUTH_SCOPES];
	if (preferences.blogEnabled) {
		scopes.push(...BLOG_OAUTH_SCOPES);
		if (preferences.reviewsMirrorFormat === "offprint") {
			scopes.push(OFFPRINT_OAUTH_SCOPE);
		}
	}
	if (preferences.blueskyEnabled) scopes.push(...BLUESKY_OAUTH_SCOPES);
	if (preferences.atStoreReviewEnabled) {
		scopes.push(...ATSTORE_REVIEW_OAUTH_SCOPES);
	}
	return scopes;
}

export function buildOAuthScope(
	preferences: OAuthScopePreferences = {},
): string {
	return buildOAuthScopes(preferences).join(" ");
}

export function includesRequestedScopes(
	grantedScope: string | string[] | undefined,
	requiredScopes: readonly string[],
): boolean {
	if (!grantedScope) return false;
	const granted = new Set(
		(Array.isArray(grantedScope)
			? grantedScope
			: grantedScope.split(/\s+/)
		).filter(Boolean),
	);
	return requiredScopes.every((scope) => granted.has(scope));
}
