import {
	CloudDownload,
	Sparkles,
	UserCircle2,
	WandSparkles,
} from "lucide-react-native";

export const ONBOARDING_STEPS = [
	{
		title: "Briefing",
		description: "See how your shelf gets calibrated.",
		Icon: Sparkles,
	},
	{
		title: "Identity",
		description: "Tune your profile card and local time.",
		Icon: UserCircle2,
	},
	{
		title: "Import",
		description: "Bring your watch history from Trakt or CSV.",
		Icon: CloudDownload,
	},
	{
		title: "Launch",
		description: "Review import status and open your shelf.",
		Icon: WandSparkles,
	},
] as const;

export const TIMEZONE_GROUPS = [
	{ region: "UTC", zones: ["UTC"] },
	{
		region: "Americas",
		zones: [
			"America/New_York",
			"America/Chicago",
			"America/Denver",
			"America/Los_Angeles",
			"America/Toronto",
			"America/Vancouver",
			"America/Mexico_City",
			"America/Sao_Paulo",
			"America/Buenos_Aires",
		],
	},
	{
		region: "Europe",
		zones: [
			"Europe/London",
			"Europe/Paris",
			"Europe/Berlin",
			"Europe/Rome",
			"Europe/Madrid",
			"Europe/Amsterdam",
			"Europe/Zurich",
			"Europe/Stockholm",
			"Europe/Oslo",
			"Europe/Copenhagen",
			"Europe/Helsinki",
			"Europe/Warsaw",
			"Europe/Prague",
			"Europe/Vienna",
			"Europe/Budapest",
			"Europe/Moscow",
			"Europe/Istanbul",
		],
	},
	{
		region: "Asia & Pacific",
		zones: [
			"Asia/Tokyo",
			"Asia/Seoul",
			"Asia/Shanghai",
			"Asia/Hong_Kong",
			"Asia/Singapore",
			"Asia/Taipei",
			"Asia/Manila",
			"Asia/Bangkok",
			"Asia/Jakarta",
			"Asia/Kuala_Lumpur",
			"Asia/Ho_Chi_Minh",
			"Asia/Dubai",
			"Asia/Mumbai",
			"Asia/Kolkata",
			"Asia/Dhaka",
			"Asia/Karachi",
			"Pacific/Auckland",
			"Pacific/Sydney",
			"Pacific/Melbourne",
			"Pacific/Perth",
		],
	},
	{
		region: "Middle East & Africa",
		zones: [
			"Africa/Cairo",
			"Africa/Johannesburg",
			"Africa/Lagos",
			"Africa/Nairobi",
			"Asia/Jerusalem",
			"Asia/Riyadh",
			"Asia/Tehran",
		],
	},
] as const;

export const ALL_ZONES = TIMEZONE_GROUPS.flatMap((group) =>
	group.zones.map((zone) => ({ zone, region: group.region })),
);
