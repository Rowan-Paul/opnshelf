/**
 * Public TMDB catalogue responses are identical for every viewer. Keep them
 * out of browser caches so client-side refetches can still revalidate, while
 * allowing the CDN to collapse repeated crawler and SSR requests.
 */
export const PUBLIC_CATALOGUE_CACHE_CONTROL =
	"public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";
