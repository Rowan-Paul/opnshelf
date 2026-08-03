import { getLocales } from "expo-localization";

/**
 * Streaming-availability countries. Copied verbatim from the web app
 * (`apps/web/src/lib/countries.ts`) — a static code→name map with no runtime
 * deps, kept in sync by hand rather than promoted to a shared package.
 */
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
 * Guess the streaming country from the device region (Settings › Language &
 * Region), falling back to "US" when the region is missing or is a country
 * TMDB has no provider data for.
 *
 * ponytail: device region only. A timezone→country table or an IP lookup would
 * catch travellers with a stale region setting; add one if people complain.
 */
export function guessWatchCountry(): string {
	const region = getLocales()[0]?.regionCode;
	return region && region in COUNTRY_NAMES ? region : "US";
}
