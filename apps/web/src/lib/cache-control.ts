import { ssrCanResolveSession } from "./api";

export const PUBLIC_MEDIA_CACHE_CONTROL =
	"public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";

/**
 * Media HTML can be shared when SSR has no session to render. A request whose
 * session is visible to the Web server must never enter a shared cache.
 */
export function publicMediaPageHeaders(
	hasPublicContent: boolean,
	canResolveSession = ssrCanResolveSession(),
): Record<string, string> {
	return {
		"Cache-Control":
			!hasPublicContent || canResolveSession
				? "private, no-store"
				: PUBLIC_MEDIA_CACHE_CONTROL,
	};
}
