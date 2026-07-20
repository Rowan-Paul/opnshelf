const BEARER_AUTHORIZATION = /^Bearer[\t ]+(\S+)$/i;

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

	const cookie = request.cookies?.session?.trim();
	return cookie || undefined;
}
