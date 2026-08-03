export const COUNTRY_NAMES: Record<string, string> = {
	AR: "Argentina",
	AT: "Austria",
	AU: "Australia",
	BE: "Belgium",
	BR: "Brazil",
	CA: "Canada",
	CH: "Switzerland",
	CL: "Chile",
	CO: "Colombia",
	DE: "Germany",
	DK: "Denmark",
	ES: "Spain",
	FI: "Finland",
	FR: "France",
	GB: "United Kingdom",
	HK: "Hong Kong",
	ID: "Indonesia",
	IN: "India",
	IT: "Italy",
	JP: "Japan",
	KR: "South Korea",
	MX: "Mexico",
	MY: "Malaysia",
	NL: "Netherlands",
	NO: "Norway",
	NZ: "New Zealand",
	PH: "Philippines",
	PL: "Poland",
	PT: "Portugal",
	SE: "Sweden",
	SG: "Singapore",
	TH: "Thailand",
	TR: "Turkey",
	US: "United States",
	ZA: "South Africa",
};

export const SORTED_COUNTRIES = Object.entries(COUNTRY_NAMES).sort(
	([, a], [, b]) => a.localeCompare(b),
);

/**
 * Guess the streaming country from the browser language, falling back to "US"
 * when there is no region, the browser is server-rendered, or the region is a
 * country TMDB has no provider data for. Call this from an effect only: it
 * reads `navigator`, so using it as initial state would break hydration.
 *
 * ponytail: browser language only, so a Dutch user running an en-US browser
 * still gets the US. Mobile reads the device region instead, which is a better
 * signal. Add a timezone→country table here if people complain.
 */
export function guessWatchCountry(): string {
	if (typeof navigator === "undefined") return "US";
	try {
		const region = new Intl.Locale(navigator.language).maximize().region;
		return region && region in COUNTRY_NAMES ? region : "US";
	} catch {
		return "US";
	}
}
