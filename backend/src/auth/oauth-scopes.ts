/**
 * The scopes Opnshelf needs to operate its own repository.  Keep this list
 * deliberately boring and explicit: optional ecosystems must never leak into
 * the sign-in consent screen.
 */
export const CORE_PERMISSION_SET_SCOPE = "include:xyz.opnshelf.core";

export const CORE_OAUTH_SCOPES = [
	"atproto",
	CORE_PERMISSION_SET_SCOPE,
	"blob:image/jpeg",
	"blob:image/png",
	"blob:image/webp",
] as const;

const CORE_REPO_COLLECTIONS = [
	"xyz.opnshelf.movie",
	"xyz.opnshelf.episode",
	"xyz.opnshelf.list",
	"xyz.opnshelf.list.item",
	"xyz.opnshelf.library.item",
	"xyz.opnshelf.follow",
	"xyz.opnshelf.profile",
	"xyz.opnshelf.note",
	"xyz.opnshelf.review",
	"xyz.opnshelf.review.like",
	"xyz.opnshelf.rating",
] as const;

const REPO_ACTIONS = ["create", "update", "delete"] as const;

/** Granular scopes returned by authorization servers after resolving Core. */
export const CORE_GRANTED_SCOPES = CORE_REPO_COLLECTIONS.flatMap((collection) =>
	REPO_ACTIONS.map((action) => `repo:${collection}?action=${action}`),
);

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
export const ATSTORE_REVIEW_GRANTED_SCOPES = [
	"repo:fyi.atstore.profile?action=create",
	"repo:fyi.atstore.listing.review?action=create",
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
	const granted = new Set(scopeValues(grantedScope));
	return requiredScopes.every((scope) => granted.has(scope));
}

function scopeValues(grantedScope: string | string[] | undefined): string[] {
	if (!grantedScope) return [];
	return (Array.isArray(grantedScope) ? grantedScope : [grantedScope])
		.flatMap((scope) => scope.split(/\s+/))
		.filter(Boolean);
}

interface RepoPermission {
	collections: Set<string>;
	actions: Set<string>;
}

function parseRepoPermission(scope: string): RepoPermission | undefined {
	if (!scope.startsWith("repo:")) return undefined;

	const queryIndex = scope.indexOf("?");
	const positional = scope.slice(5, queryIndex === -1 ? undefined : queryIndex);
	const params = new URLSearchParams(
		queryIndex === -1 ? undefined : scope.slice(queryIndex + 1),
	);
	for (const key of params.keys()) {
		if (key !== "collection" && key !== "action") return undefined;
	}
	if (positional && params.has("collection")) return undefined;

	const collections = new Set(
		positional ? [positional] : params.getAll("collection"),
	);
	const explicitActions = params.getAll("action");
	const actions = new Set(
		explicitActions.length > 0 ? explicitActions : REPO_ACTIONS,
	);
	if (
		collections.size === 0 ||
		[...actions].some(
			(action) => !REPO_ACTIONS.some((allowed) => allowed === action),
		)
	) {
		return undefined;
	}

	return { collections, actions };
}

function grantsRepoPermission(granted: string, required: string): boolean {
	if (granted === required) return true;
	const grantedPermission = parseRepoPermission(granted);
	const requiredPermission = parseRepoPermission(required);
	if (!grantedPermission || !requiredPermission) return false;

	return (
		[...requiredPermission.collections].every(
			(collection) =>
				grantedPermission.collections.has("*") ||
				grantedPermission.collections.has(collection),
		) &&
		[...requiredPermission.actions].every((action) =>
			grantedPermission.actions.has(action),
		)
	);
}

export function includesPermissionSetGrant(
	grantedScope: string | string[] | undefined,
	includeScope: string,
	expandedScopes: readonly string[],
): boolean {
	const granted = scopeValues(grantedScope);
	return (
		granted.includes(includeScope) ||
		expandedScopes.every((required) =>
			granted.some((candidate) => grantsRepoPermission(candidate, required)),
		)
	);
}

/**
 * Verify callback capabilities rather than the literal request tokens.
 * Authorization servers resolve `include:` permission sets and return their
 * granular permissions in the token response, so either representation is
 * valid evidence of the grant.
 */
export function includesOAuthCapabilities(
	grantedScope: string | string[] | undefined,
	preferences: OAuthScopePreferences = {},
): boolean {
	const directScopes: string[] = CORE_OAUTH_SCOPES.filter(
		(scope) => scope !== CORE_PERMISSION_SET_SCOPE,
	);
	if (preferences.blogEnabled) {
		directScopes.push(...BLOG_OAUTH_SCOPES);
		if (preferences.reviewsMirrorFormat === "offprint") {
			directScopes.push(OFFPRINT_OAUTH_SCOPE);
		}
	}
	if (preferences.blueskyEnabled) {
		directScopes.push(...BLUESKY_OAUTH_SCOPES);
	}

	return (
		includesRequestedScopes(grantedScope, directScopes) &&
		includesPermissionSetGrant(
			grantedScope,
			CORE_PERMISSION_SET_SCOPE,
			CORE_GRANTED_SCOPES,
		) &&
		(!preferences.atStoreReviewEnabled ||
			includesPermissionSetGrant(
				grantedScope,
				ATSTORE_REVIEW_OAUTH_SCOPES[0],
				ATSTORE_REVIEW_GRANTED_SCOPES,
			))
	);
}
