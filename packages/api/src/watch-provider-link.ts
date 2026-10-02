// TMDB supplies availability and a country watch page, not service deep links.
// Keep explicit IDs: standalone subscriptions and third-party channels can
// require different apps/accounts. These HTTPS homepages work without an app;
// the operating system may hand them to the service's installed app.
const SERVICE_URLS: Readonly<Record<number, string>> = {
	2: "https://tv.apple.com/", // Apple TV Store
	8: "https://www.netflix.com/",
	9: "https://www.primevideo.com/",
	10: "https://www.primevideo.com/", // Amazon Video rentals/purchases
	15: "https://www.hulu.com/",
	119: "https://www.primevideo.com/", // Regional Prime Video provider
	175: "https://www.netflix.com/", // Netflix Kids
	337: "https://www.disneyplus.com/",
	350: "https://tv.apple.com/", // Apple TV subscription
	531: "https://www.paramountplus.com/",
	582: "https://www.primevideo.com/", // Paramount+ Amazon Channel
	613: "https://www.primevideo.com/", // Prime Video Free with Ads
	1796: "https://www.netflix.com/", // Netflix with Ads
	1825: "https://www.primevideo.com/", // HBO Max Amazon Channel
	1853: "https://tv.apple.com/", // Paramount Plus Apple TV channel
	1899: "https://www.hbomax.com/",
	2100: "https://www.primevideo.com/", // Prime Video with Ads
	2303: "https://www.paramountplus.com/", // Premium
	2616: "https://www.paramountplus.com/", // Essential
};

/** Open a known service, keeping TMDB's title/country page for unknown ones. */
export function getWatchProviderLink(
	providerId: number,
	fallback?: string,
): string | undefined {
	return SERVICE_URLS[providerId] ?? fallback;
}
