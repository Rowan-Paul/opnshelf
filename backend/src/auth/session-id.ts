const BEARER_AUTHORIZATION = /^Bearer[\t ]+(\S+)$/i;

/**
 * The current web cookie is deliberately host-only. A parent-domain cookie
 * from production is also sent to api.staging.opnshelf.xyz, so reusing the old
 * `session` name made staging read the production token and reject the newly
 * created staging session.
 */
export const SESSION_COOKIE_NAME = "opnshelf_session";
export const LEGACY_SESSION_COOKIE_NAME = "session";

export interface SessionIdRequestFields {
	headers?: {
		authorization?: string;
	};
	cookies?: Record<string, string | undefined>;
}

/** Extract the bearer credential used by native clients, then fall back to web's cookie. */
export function extractSessionId(
	request: SessionIdRequestFields,
): string | undefined {
	const authorization = request.headers?.authorization?.trim();
	const bearer = authorization?.match(BEARER_AUTHORIZATION)?.[1]?.trim();
	if (bearer) return bearer;

	// Prefer the host-only cookie. Keep the old name as a migration fallback for
	// sessions minted before the cookie isolation fix.
	const cookie =
		request.cookies?.[SESSION_COOKIE_NAME]?.trim() ||
		request.cookies?.[LEGACY_SESSION_COOKIE_NAME]?.trim();
	return cookie || undefined;
}
