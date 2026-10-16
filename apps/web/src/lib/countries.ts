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

/** IANA zone.tab countries and backward aliases, restricted to our country picker.
 * https://data.iana.org/time-zones/tzdb/zone.tab
 * Keep this table identical on Web and Mobile; offsets alone cannot identify a country.
 */
const COUNTRY_TIMEZONES: Record<string, string> = {
	AR: "America/Argentina/Buenos_Aires America/Argentina/Catamarca America/Argentina/ComodRivadavia America/Argentina/Cordoba America/Argentina/Jujuy America/Argentina/La_Rioja America/Argentina/Mendoza America/Argentina/Rio_Gallegos America/Argentina/Salta America/Argentina/San_Juan America/Argentina/San_Luis America/Argentina/Tucuman America/Argentina/Ushuaia America/Buenos_Aires America/Catamarca America/Cordoba America/Jujuy America/Mendoza America/Rosario",
	AT: "Europe/Vienna",
	AU: "Antarctica/Macquarie Australia/ACT Australia/Adelaide Australia/Brisbane Australia/Broken_Hill Australia/Canberra Australia/Currie Australia/Darwin Australia/Eucla Australia/Hobart Australia/LHI Australia/Lindeman Australia/Lord_Howe Australia/Melbourne Australia/NSW Australia/North Australia/Perth Australia/Queensland Australia/South Australia/Sydney Australia/Tasmania Australia/Victoria Australia/West Australia/Yancowinna",
	BE: "Europe/Brussels",
	BR: "America/Araguaina America/Bahia America/Belem America/Boa_Vista America/Campo_Grande America/Cuiaba America/Eirunepe America/Fortaleza America/Maceio America/Manaus America/Noronha America/Porto_Acre America/Porto_Velho America/Recife America/Rio_Branco America/Santarem America/Sao_Paulo Brazil/Acre Brazil/DeNoronha Brazil/East Brazil/West",
	CA: "America/Atikokan America/Blanc-Sablon America/Cambridge_Bay America/Creston America/Dawson America/Dawson_Creek America/Edmonton America/Fort_Nelson America/Glace_Bay America/Goose_Bay America/Halifax America/Inuvik America/Iqaluit America/Moncton America/Montreal America/Nipigon America/Pangnirtung America/Rainy_River America/Rankin_Inlet America/Regina America/Resolute America/St_Johns America/Swift_Current America/Thunder_Bay America/Toronto America/Vancouver America/Whitehorse America/Winnipeg America/Yellowknife Canada/Atlantic Canada/Central Canada/Eastern Canada/Mountain Canada/Newfoundland Canada/Pacific Canada/Saskatchewan Canada/Yukon",
	CH: "Europe/Zurich",
	CL: "America/Coyhaique America/Punta_Arenas America/Santiago Chile/Continental Chile/EasterIsland Pacific/Easter",
	CO: "America/Bogota",
	DE: "Europe/Berlin Europe/Busingen",
	DK: "Europe/Copenhagen",
	ES: "Africa/Ceuta Atlantic/Canary Europe/Madrid",
	FI: "Europe/Helsinki",
	FR: "Europe/Paris",
	GB: "Europe/Belfast Europe/London",
	HK: "Asia/Hong_Kong",
	ID: "Asia/Jakarta Asia/Jayapura Asia/Makassar Asia/Pontianak Asia/Ujung_Pandang",
	IN: "Asia/Calcutta Asia/Kolkata",
	IT: "Europe/Rome",
	JP: "Asia/Tokyo",
	KR: "Asia/Seoul",
	MX: "America/Bahia_Banderas America/Cancun America/Chihuahua America/Ciudad_Juarez America/Ensenada America/Hermosillo America/Matamoros America/Mazatlan America/Merida America/Mexico_City America/Monterrey America/Ojinaga America/Santa_Isabel America/Tijuana Mexico/BajaNorte Mexico/BajaSur Mexico/General",
	MY: "Asia/Kuala_Lumpur Asia/Kuching",
	NL: "Europe/Amsterdam",
	NO: "Europe/Oslo",
	NZ: "Pacific/Auckland Pacific/Chatham",
	PH: "Asia/Manila",
	PL: "Europe/Warsaw",
	PT: "Atlantic/Azores Atlantic/Madeira Europe/Lisbon",
	SE: "Europe/Stockholm",
	SG: "Asia/Singapore",
	TH: "Asia/Bangkok",
	TR: "Asia/Istanbul Europe/Istanbul",
	US: "America/Adak America/Anchorage America/Atka America/Boise America/Chicago America/Denver America/Detroit America/Fort_Wayne America/Indiana/Indianapolis America/Indiana/Knox America/Indiana/Marengo America/Indiana/Petersburg America/Indiana/Tell_City America/Indiana/Vevay America/Indiana/Vincennes America/Indiana/Winamac America/Indianapolis America/Juneau America/Kentucky/Louisville America/Kentucky/Monticello America/Knox_IN America/Los_Angeles America/Louisville America/Menominee America/Metlakatla America/New_York America/Nome America/North_Dakota/Beulah America/North_Dakota/Center America/North_Dakota/New_Salem America/Phoenix America/Shiprock America/Sitka America/Yakutat Pacific/Honolulu Pacific/Johnston US/Alaska US/Aleutian US/Arizona US/Central US/East-Indiana US/Eastern US/Hawaii US/Indiana-Starke US/Michigan US/Mountain US/Pacific",
	ZA: "Africa/Johannesburg",
};

function countryFromTimezone(timezone?: string): string | undefined {
	try {
		const zone = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
		return Object.entries(COUNTRY_TIMEZONES).find(([, zones]) =>
			zones.split(" ").includes(zone),
		)?.[0];
	} catch {
		return undefined;
	}
}

/** Guess from the timezone first, then browser language, then US.
 * Call from an effect only so server rendering does not affect hydration.
 */
export function guessWatchCountry(timezone?: string): string {
	const country = countryFromTimezone(timezone);
	if (country) return country;
	if (typeof navigator === "undefined") return "US";
	try {
		const region = new Intl.Locale(navigator.language).maximize().region;
		return region && region in COUNTRY_NAMES ? region : "US";
	} catch {
		return "US";
	}
}
