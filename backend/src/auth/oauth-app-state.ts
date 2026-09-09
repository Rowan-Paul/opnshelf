import { createHash } from "node:crypto";
import type { OAuthIntegration, OAuthScopePreferences } from "./oauth-scopes";

/**
 * Application state carried through the OAuth `state` parameter. It survives
 * the redirect round trip on its own (cookies do not inside an iOS auth
 * session), so the callback reads platform, timezone and permission intent
 * from here first and only falls back to cookies.
 */
export interface OAuthAppState {
	platform?: "mobile";
	timezone?: string;
	permissionChange?: OAuthIntegration;
	requestedPreferences?: OAuthScopePreferences;
	accountDid?: string;
	accountHandle?: string;
	/**
	 * S256 challenge for the Mobile Handoff Code (ADR 0026). When present, the
	 * mobile callback hands the app a single-use code instead of the session id.
	 */
	codeChallenge?: string;
}

/** base64url of 32 random bytes: exactly 43 characters, no padding. */
const CODE_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isValidCodeChallenge(value: unknown): value is string {
	return typeof value === "string" && CODE_CHALLENGE_PATTERN.test(value);
}

/** S256 as in RFC 7636: base64url(sha256(ascii(verifier))). */
export function computeCodeChallenge(codeVerifier: string): string {
	return createHash("sha256").update(codeVerifier, "ascii").digest("base64url");
}

/**
 * Parse the raw `state` string the authorization server echoed back. Anything
 * malformed or unexpected is dropped field by field; an unparseable payload
 * yields an empty state rather than an error, because the callback must still
 * be able to redirect the user somewhere sensible.
 */
export function parseOAuthAppState(
	rawState: string | null | undefined,
): OAuthAppState {
	if (!rawState) {
		return {};
	}

	try {
		const parsed = JSON.parse(rawState) as {
			platform?: unknown;
			timezone?: unknown;
			permissionChange?: unknown;
			requestedPreferences?: OAuthScopePreferences;
			accountDid?: unknown;
			accountHandle?: unknown;
			codeChallenge?: unknown;
		};

		const platform = parsed.platform === "mobile" ? "mobile" : undefined;
		const timezone =
			typeof parsed.timezone === "string" && parsed.timezone.trim() !== ""
				? parsed.timezone
				: undefined;

		const permissionChange =
			parsed.permissionChange === "atstore" ||
			parsed.permissionChange === "blog" ||
			parsed.permissionChange === "bluesky"
				? parsed.permissionChange
				: undefined;
		return {
			platform,
			timezone,
			permissionChange,
			requestedPreferences: parsed.requestedPreferences,
			accountDid:
				typeof parsed.accountDid === "string" ? parsed.accountDid : undefined,
			accountHandle:
				typeof parsed.accountHandle === "string"
					? parsed.accountHandle
					: undefined,
			codeChallenge: isValidCodeChallenge(parsed.codeChallenge)
				? parsed.codeChallenge
				: undefined,
		};
	} catch {
		return {};
	}
}

/**
 * Serialize app state for the `state` parameter. Returns undefined when there
 * is nothing worth carrying, so the authorize call sends no state at all.
 */
export function serializeOAuthAppState(
	appState?: OAuthAppState,
): string | undefined {
	if (!appState) {
		return undefined;
	}
	const payload: OAuthAppState = {};
	if (appState.platform === "mobile") {
		payload.platform = "mobile";
	}
	if (appState.timezone && appState.timezone.trim() !== "") {
		payload.timezone = appState.timezone;
	}
	if (appState.permissionChange)
		payload.permissionChange = appState.permissionChange;
	if (appState.requestedPreferences) {
		payload.requestedPreferences = appState.requestedPreferences;
	}
	if (appState.accountDid) payload.accountDid = appState.accountDid;
	if (appState.accountHandle) payload.accountHandle = appState.accountHandle;
	if (isValidCodeChallenge(appState.codeChallenge)) {
		payload.codeChallenge = appState.codeChallenge;
	}
	if (
		!payload.platform &&
		!payload.timezone &&
		!payload.permissionChange &&
		!payload.requestedPreferences &&
		!payload.codeChallenge
	) {
		return undefined;
	}
	return JSON.stringify(payload);
}
