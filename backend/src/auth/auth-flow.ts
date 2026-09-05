import type { ConfigService } from "@nestjs/config";

/** Tells the OAuth callback the flow started in the Mobile App. */
export const PLATFORM_COOKIE_NAME = "auth_platform";
/** Carries the browser timezone to the callback for first-time users. */
export const TIMEZONE_COOKIE_NAME = "auth_timezone";

export type OAuthErrorCode =
	| "handle_required"
	| "auth_failed"
	| "callback_failed"
	| "permission_declined";
export type AuthPlatform = "mobile" | undefined;

export function isProduction(configService: ConfigService): boolean {
	return configService.get<string>("NODE_ENV") === "production";
}

export function getFrontendUrl(configService: ConfigService): string {
	return configService.get<string>("FRONTEND_URL") || "http://127.0.0.1:3000";
}

/**
 * Options for the short-lived platform/timezone cookies that carry state
 * across an OAuth redirect. Same secure/sameSite posture as the session.
 */
export function flowCookieOptions(configService: ConfigService) {
	return {
		httpOnly: true,
		secure: isProduction(configService),
		sameSite: "lax" as const,
		maxAge: 5 * 60 * 1000, // 5 minutes
	};
}

/**
 * The session cookie. Kept host-only to isolate api.opnshelf.xyz from
 * api.staging.opnshelf.xyz: the frontend sends it to the API with
 * credentials: include and never needs to receive the cookie itself. Its
 * maxAge is the absolute session lifetime (SESSION_TTL_MS).
 */
export function sessionCookieOptions(configService: ConfigService) {
	return {
		httpOnly: true,
		secure: isProduction(configService),
		sameSite: "lax" as const,
		maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
		path: "/",
	};
}

/**
 * Scope used only to clear session cookies issued before sessions became
 * host-only. New session cookies must never use this domain.
 */
export function getCookieDomain(
	configService: ConfigService,
): string | undefined {
	if (!isProduction(configService)) return undefined;
	const frontendUrl = configService.get<string>("FRONTEND_URL") || "";
	try {
		const host = new URL(frontendUrl).hostname;
		if (host && !host.startsWith("localhost") && !host.startsWith("127.")) {
			// Bare domain (e.g. opnshelf.xyz) works for apex + subdomains; leading dot can be unreliable on apex
			return host.startsWith(".") ? host.slice(1) : host;
		}
	} catch {
		// ignore invalid FRONTEND_URL
	}
	return undefined;
}

export function buildWebErrorUrl(
	frontendUrl: string,
	errorCode: OAuthErrorCode,
): string {
	// Pass the error code so the /login route can show a friendly toast.
	const url = new URL("/login", frontendUrl);
	url.searchParams.set("error", errorCode);
	return url.toString();
}

export function buildMobileErrorUrl(errorCode: OAuthErrorCode): string {
	return `opnshelf://auth/complete?error=${encodeURIComponent(errorCode)}`;
}

/** Where a failed OAuth flow lands: the Mobile App's deep link or the web login page. */
export function resolveErrorRedirect(
	frontendUrl: string,
	errorCode: OAuthErrorCode,
	platform: AuthPlatform,
): string {
	if (platform === "mobile") {
		return buildMobileErrorUrl(errorCode);
	}
	return buildWebErrorUrl(frontendUrl, errorCode);
}
